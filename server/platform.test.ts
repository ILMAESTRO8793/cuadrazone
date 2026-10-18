import express from "express";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME, OAUTH_STATE_COOKIE, safeReturnPath } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { buildGoogleAuthorizeUrl, googleOpenId, parseGoogleProfile, roleForProfile } from "./_core/google";
import { registerOAuthRoutes } from "./_core/oauth";
import { sdk } from "./_core/sdk";
import { isSafeStorageKey, storagePut } from "./storage";

const SECRET = "unit-test-signing-key-never-deployed-0123456789";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function listen(app: express.Express): Promise<{ server: Server; base: string }> {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

describe("sesiones propias", () => {
  it("firma y verifica sesiones de esta aplicación y rechaza otras", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const token = await sdk.createSessionToken("google_123", { name: "" });
    expect(await sdk.verifySession(token)).toMatchObject({ openId: "google_123", appId: "cuadrazone" });
    const foreign = await sdk.signSession({ openId: "google_123", appId: "otra-app", name: "" });
    expect(await sdk.verifySession(foreign)).toBeNull();
    vi.stubEnv("SESSION_SECRET", SECRET.replace("unit", "otro"));
    expect(await sdk.verifySession(token)).toBeNull();
  });
  it("exige un secreto de al menos 32 caracteres", async () => {
    vi.stubEnv("SESSION_SECRET", "corto");
    await expect(sdk.createSessionToken("google_1")).rejects.toThrow("SESSION_SECRET");
  });
  it("usa cookie httpOnly SameSite=Lax y Secure detrás de HTTPS", () => {
    expect(COOKIE_NAME).toBe("cz_session");
    vi.stubEnv("NODE_ENV", "development");
    expect(getSessionCookieOptions({ protocol: "http", headers: {} } as never)).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false });
    expect(getSessionCookieOptions({ protocol: "http", headers: { "x-forwarded-proto": "https" } } as never)).toMatchObject({ secure: true });
    vi.stubEnv("NODE_ENV", "production");
    expect(getSessionCookieOptions({ protocol: "http", headers: {} } as never)).toMatchObject({ secure: true });
  });
});

describe("retorno tras iniciar sesión", () => {
  it("solo admite rutas internas", () => {
    expect(safeReturnPath("/vendedor/plan?plan=normal")).toBe("/vendedor/plan?plan=normal");
    expect(safeReturnPath("/carrito-guardado")).toBe("/carrito-guardado");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/api/auth/google", "", null, "javascript:alert(1)", "/a b"]) {
      expect(safeReturnPath(bad)).toBe("/");
    }
  });
});

describe("Google", () => {
  it("construye la autorización con alcance OpenID", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-test");
    const url = new URL(buildGoogleAuthorizeUrl("https://cuadrazone.com/api/auth/google/callback", "estado"));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("client_id")).toBe("client-test");
    expect(url.searchParams.get("state")).toBe("estado");
  });
  it("valida el perfil y asigna administrador solo con correo verificado de la lista", () => {
    vi.stubEnv("ADMIN_EMAILS", "Admin@Ejemplo.com, otro@ejemplo.com");
    const verified = parseGoogleProfile({ sub: "1234567890", email: "admin@ejemplo.com", email_verified: true, name: "Admin" });
    expect(googleOpenId(verified.sub)).toBe("google_1234567890");
    expect(roleForProfile(verified)).toBe("admin");
    expect(roleForProfile({ ...verified, emailVerified: false })).toBe("user");
    expect(roleForProfile({ ...verified, email: "cliente@ejemplo.com" })).toBe("user");
    expect(() => parseGoogleProfile({ email: "x@y.com" })).toThrow();
    expect(() => parseGoogleProfile({ sub: "../1", email: "x@y.com" })).toThrow();
  });
  it("inicia el flujo con nonce en cookie y rechaza un regreso sin estado válido", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-test");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret-test");
    vi.stubEnv("PUBLIC_URL", "https://cuadrazone.com/");
    const app = express();
    registerOAuthRoutes(app);
    const { server, base } = await listen(app);
    try {
      const start = await fetch(`${base}/api/auth/google?returnTo=${encodeURIComponent("//evil.example")}`, { redirect: "manual" });
      expect(start.status).toBe(302);
      const location = new URL(start.headers.get("location")!);
      expect(location.searchParams.get("redirect_uri")).toBe("https://cuadrazone.com/api/auth/google/callback");
      const state = JSON.parse(Buffer.from(location.searchParams.get("state")!, "base64url").toString());
      expect(state.returnTo).toBe("/");
      expect(start.headers.get("set-cookie")).toContain(`${OAUTH_STATE_COOKIE}=${state.nonce}`);
      expect(start.headers.get("set-cookie")).toMatch(/HttpOnly/i);

      const request = vi.fn();
      const realFetch = globalThis.fetch;
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).startsWith(base) ? realFetch(input, init) : request(input, init));
      const forged = await fetch(`${base}/api/auth/google/callback?code=abc&state=${location.searchParams.get("state")}`, { redirect: "manual" });
      expect(forged.status).toBe(302);
      expect(forged.headers.get("location")).toBe("/?login_error=estado");
      expect(request).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });
  it("informa claramente cuando Google no está configurado", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    const app = express();
    registerOAuthRoutes(app);
    const { server, base } = await listen(app);
    try {
      expect((await fetch(`${base}/api/auth/google`, { redirect: "manual" })).status).toBe(503);
    } finally {
      server.close();
    }
  });
});

describe("almacenamiento de fotos", () => {
  it("rechaza claves que salen de la carpeta", () => {
    expect(isSafeStorageKey("catalog/products/1/abc.png")).toBe(true);
    for (const bad of ["../x.png", "catalog/../../x", "/abs.png", "catalog//x.png", "catalog/.env", ""]) {
      expect(isSafeStorageKey(bad)).toBe(false);
    }
  });
  it("guarda en STORAGE_DIR y devuelve la ruta pública /media/", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cz-storage-"));
    vi.stubEnv("STORAGE_DIR", dir);
    try {
      const saved = await storagePut("catalog/products/7/foto.png", Buffer.from([1, 2, 3]), "image/png");
      expect(saved).toEqual({ key: "catalog/products/7/foto.png", url: "/media/catalog/products/7/foto.png" });
      expect([...(await readFile(path.join(dir, saved.key)))]).toEqual([1, 2, 3]);
      await expect(storagePut("catalog/products/7/foto.png", Buffer.from([9]))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
