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
