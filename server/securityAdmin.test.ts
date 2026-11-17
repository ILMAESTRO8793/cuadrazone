import { afterEach, describe, expect, it, vi } from "vitest";
import { adminCheck } from "./_core/sdk";
import { ADMIN_SESSION_MS } from "@shared/const";

const base = {
  id: 1,
  openId: "email_x",
  name: "Admin",
  email: "admin@ejemplo.com",
  phone: null,
  loginMethod: "email",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
} as any;

describe("seguridad de la cuenta de administrador", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("una sesión de admin vence a las 12 horas aunque la cookie diga otra cosa", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@ejemplo.com");
    const now = Date.now();
    const fresh = Math.floor((now - 60_000) / 1000);
    const old = Math.floor((now - ADMIN_SESSION_MS - 60_000) / 1000);
    expect(adminCheck(base, fresh, now).role).toBe("admin");
    expect(() => adminCheck(base, old, now)).toThrow();
    expect(() => adminCheck(base, undefined, now)).toThrow();
  });

  it("si el correo ya no está en ADMIN_EMAILS, deja de ser admin al instante", () => {
    vi.stubEnv("ADMIN_EMAILS", "otra@ejemplo.com");
    expect(adminCheck(base, Math.floor(Date.now() / 1000)).role).toBe("user");
  });

  it("no toca a los usuarios normales", () => {
    const user = { ...base, role: "user" };
    expect(adminCheck(user, undefined)).toBe(user);
  });
});

describe("protecciones globales de la API", () => {
  it("toda operación que cambia datos exige la cabecera anti-CSRF", async () => {
    const { appRouter } = await import("./routers");
    const api = appRouter.createCaller({ user: null, req: { headers: {} } as any, res: { clearCookie() {} } as any });
    await expect(api.auth.logout()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("los errores inesperados no muestran el detalle (p. ej. la consulta SQL)", async () => {
    const { isUnexpectedError } = await import("./_core/trpc");
    const { TRPCError } = await import("@trpc/server");
    const leaked = new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: new Error("Failed query: select * from users") });
    const intended = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La base de datos no está disponible" });
    expect(isUnexpectedError(leaked)).toBe(true);
    expect(isUnexpectedError(intended)).toBe(false);
  });
});

describe("respaldo de la base de datos", () => {
  it("el permiso de descarga vale una sola vez, para el mismo admin y por 60 segundos", async () => {
    const { issueBackupTicket, useBackupTicket } = await import("./_core/backup");
    const now = Date.now();
    const t = issueBackupTicket(1, now);
    expect(useBackupTicket(t, 2, now)).toBe(false); // otro admin: no (y se gasta)
    const t2 = issueBackupTicket(1, now);
    expect(useBackupTicket(t2, 1, now + 61_000)).toBe(false); // vencido
    const t3 = issueBackupTicket(1, now);
    expect(useBackupTicket(t3, 1, now + 1000)).toBe(true);
    expect(useBackupTicket(t3, 1, now + 1000)).toBe(false); // ya usado
    expect(useBackupTicket(undefined, 1, now)).toBe(false);
  });
});
