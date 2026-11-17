import { ADMIN_SESSION_MS, COOKIE_NAME, SESSION_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  /** Cuándo se emitió la sesión (segundos). */
  iat?: number;
  /** Versión de sesión de la cuenta al firmarla (ver users.sessionVersion). */
  sv?: number;
};

/** lastSignedIn se guarda como mucho una vez por hora (no en cada petición). */
const LAST_SEEN_EVERY_MS = 60 * 60 * 1000;

/** Usuario autenticado por una cookie de sesión firmada por este servidor. */
export type AuthenticatedUser = User;

const MIN_SECRET_LENGTH = 32;

class SessionService {
  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`SESSION_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
    }
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    const user = await db.getUserByOpenId(openId);
    return this.signSession(
      { openId, appId: ENV.appId, name: options.name || "", sv: user?.sessionVersion ?? 0 },
      options
    );
  }

  async signSession(payload: SessionPayload, options: { expiresInMs?: number } = {}): Promise<string> {
    const expiresInMs = options.expiresInMs ?? SESSION_MS;
    const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    return new SignJWT({ openId: payload.openId, appId: payload.appId, name: payload.name, sv: payload.sv ?? 0 })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), { algorithms: ["HS256"] });
      const { openId, appId, name, iat, sv } = payload as Record<string, unknown>;
      if (!isNonEmptyString(openId) || appId !== ENV.appId || typeof name !== "string") return null;
      return {
        openId,
        appId,
        name,
        iat: typeof iat === "number" ? iat : undefined,
        sv: typeof sv === "number" ? sv : 0,
      };
    } catch {
      return null;
    }
  }

  /** Solo acepta la cookie de sesión propia. Los usuarios se crean en el callback de Google. */
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    return (await this.authenticate(req)).user;
  }

  /** La cuenta y los datos de su sesión (para renovar la cookie). */
  async authenticate(req: Request): Promise<{ user: AuthenticatedUser; session: SessionPayload }> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const session = await this.verifySession(cookies[COOKIE_NAME]);
    if (!session) throw ForbiddenError("Invalid session cookie");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("User not found");
    // «Cerrar sesión en todos los dispositivos» sube la versión: las sesiones viejas dejan de valer.
    if ((session.sv ?? 0) !== (user.sessionVersion ?? 0)) throw ForbiddenError("Session revoked");

    const effective = adminCheck(user, session.iat);

    const last = user.lastSignedIn ? new Date(user.lastSignedIn).getTime() : 0;
    if (Date.now() - last > LAST_SEEN_EVERY_MS)
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    return { user: effective, session };
  }
}

/**
 * El rol de administrador se comprueba en cada petición:
 * - si su correo ya no está en ADMIN_EMAILS, se le trata como usuario normal;
 * - una sesión de administrador vence a las 12 horas, aunque la cookie diga otra cosa.
 */
export function adminCheck(user: User, issuedAtSeconds: number | undefined, now = Date.now()): User {
  if (user.role !== "admin") return user;
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email || !ENV.adminEmails.includes(email)) return { ...user, role: "user" };
  if (!issuedAtSeconds || now - issuedAtSeconds * 1000 > ADMIN_SESSION_MS)
    throw ForbiddenError("Admin session expired");
  return user;
}

export const sdk = new SessionService();
