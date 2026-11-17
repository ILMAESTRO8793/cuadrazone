import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { sessionVersion: 0 };
vi.mock("./db", () => ({
  getUserByOpenId: async (openId: string) => ({
    id: 5, openId, name: "Ana", email: "ana@ejemplo.com", phone: null, loginMethod: "email",
    role: "user", sessionVersion: state.sessionVersion, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  }),
  upsertUser: async () => undefined,
}));

describe("sesiones revocables", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    state.sessionVersion = 0;
  });

  it("«cerrar sesión en todos los dispositivos» invalida las sesiones anteriores", async () => {
    const { sdk } = await import("./_core/sdk");
    const { COOKIE_NAME } = await import("@shared/const");
    const token = await sdk.createSessionToken("email_ana", { name: "Ana" });
    const req = { headers: { cookie: `${COOKIE_NAME}=${token}` } } as any;
    await expect(sdk.authenticateRequest(req)).resolves.toMatchObject({ id: 5 });
    state.sessionVersion = 1; // se pulsó el botón
    await expect(sdk.authenticateRequest(req)).rejects.toThrow();
    const fresh = await sdk.createSessionToken("email_ana", { name: "Ana" });
    await expect(sdk.authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${fresh}` } } as any)).resolves.toMatchObject({ id: 5 });
  });

  it("las sesiones normales duran 90 días", async () => {
    const { sdk } = await import("./_core/sdk");
    const { decodeJwt } = await import("jose");
    const claims = decodeJwt(await sdk.createSessionToken("email_ana", { name: "Ana" }));
    const days = ((claims.exp ?? 0) - (claims.iat ?? 0)) / 86400;
    expect(Math.round(days)).toBe(90);
  });
});
