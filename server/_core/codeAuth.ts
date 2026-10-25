// Entrada con código por correo o celular, y verificación de contactos del perfil.
import { COOKIE_NAME, ONE_YEAR_MS, safeReturnPath } from "@shared/const";
import { createHash } from "node:crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import express, { type Express, type Request, type Response } from "express";
import { czMembershipAudit, czMembershipProfiles, users } from "../../drizzle/schema";
import * as db from "../db";
import { AuthCodeError, channelAvailable, normalizeDestination, requestCode, verifyCode, type Channel } from "../services/authCodes";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { isGoogleConfigured } from "./google";
import { sdk } from "./sdk";

function channelOf(value: unknown): Channel | null {
  return value === "email" || value === "phone" ? value : null;
}

function clientIp(req: Request) {
  return (req.ip || req.socket.remoteAddress || "desconocida").slice(0, 64);
}

function requireCsrf(req: Request) {
  if (req.headers["x-cz-request"] !== "1") throw new AuthCodeError(412, "Falta la cabecera x-cz-request: 1");
}

function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    try {
      res.json(await fn(req, res));
    } catch (error) {
      if (error instanceof AuthCodeError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      console.error("[Códigos] Error:", error instanceof Error ? error.message : error);
      res.status(500).json({ error: "Ocurrió un error. Inténtalo de nuevo." });
    }
  };
}

/** Identificador estable para cuentas de correo: no expone el correo. */
export function emailOpenId(email: string) {
  return `email_${createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
}

export function phoneOpenId(phone: string) {
  return `phone_${phone}`;
}

/**
 * Busca la cuenta de ese correo o celular para no crear duplicados: quien entró
 * con Google y luego entra con el mismo correo usa la misma cuenta.
 */
async function signInWithContact(channel: Channel, destination: string) {
  const database = await db.getDb();
  if (!database) throw new AuthCodeError(503, "La base de datos no está disponible");
  if (channel === "email") {
    const existing = await database
      .select({ openId: users.openId, name: users.name })
      .from(users)
      .where(and(eq(users.email, destination), inArray(users.loginMethod, ["google", "email"])))
      .limit(1);
    const openId = existing[0]?.openId ?? emailOpenId(destination);
    await db.upsertUser({
      openId,
      email: destination,
      ...(existing[0] ? {} : { loginMethod: "email" }),
      role: ENV.adminEmails.includes(destination) ? "admin" : "user",
      lastSignedIn: new Date(),
    });
    return { openId, name: existing[0]?.name ?? "" };
  }
  const existing = await database.select({ openId: users.openId, name: users.name }).from(users).where(eq(users.phone, destination)).limit(1);
  const openId = existing[0]?.openId ?? phoneOpenId(destination);
  await db.upsertUser({ openId, phone: destination, ...(existing[0] ? {} : { loginMethod: "phone" }), lastSignedIn: new Date() });
  return { openId, name: existing[0]?.name ?? "" };
}

export function registerCodeAuthRoutes(app: Express) {
  const json = express.json({ limit: "4kb" });

  app.get("/api/auth/methods", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ google: isGoogleConfigured(), email: channelAvailable("email"), phone: channelAvailable("phone") });
  });

  app.post("/api/auth/code/request", json, handle(async req => {
    requireCsrf(req);
    const channel = channelOf(req.body?.channel);
    if (!channel) throw new AuthCodeError(400, "Elige correo o celular.");
    const destination = normalizeDestination(channel, req.body?.destination);
    if (!destination)
      throw new AuthCodeError(400, channel === "email" ? "Escribe un correo válido." : "Escribe un celular de Panamá (6 y 7 dígitos más).");
    return requestCode({ channel, destination, purpose: "login", ip: clientIp(req) });
  }));

  app.post("/api/auth/code/verify", json, handle(async (req, res) => {
    requireCsrf(req);
    const channel = channelOf(req.body?.channel);
    const destination = channel ? normalizeDestination(channel, req.body?.destination) : null;
    if (!channel || !destination) throw new AuthCodeError(400, "Datos incompletos.");
    await verifyCode({ channel, destination, purpose: "login", code: String(req.body?.code ?? "").trim() });
    const account = await signInWithContact(channel, destination);
    const token = await sdk.createSessionToken(account.openId, { name: account.name ?? "", expiresInMs: ONE_YEAR_MS });
    res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
    return { ok: true, returnTo: safeReturnPath(req.body?.returnTo) };
  }));

  // Verificar el correo o el celular guardados en el perfil (Mi cuenta).
  app.post("/api/account/contact/request", json, handle(async req => {
    requireCsrf(req);
    const user = await sdk.authenticateRequest(req).catch(() => { throw new AuthCodeError(401, "Inicia sesión."); });
    const channel = channelOf(req.body?.channel);
    if (!channel) throw new AuthCodeError(400, "Elige correo o celular.");
    const profile = await contactProfile(user.id);
    const destination = normalizeDestination(channel, channel === "email" ? profile?.email : profile?.phone);
    if (!destination) throw new AuthCodeError(400, "Guarda primero un correo o celular válido en tu perfil.");
    return requestCode({ channel, destination, purpose: "verify_contact", userId: user.id, ip: clientIp(req) });
  }));

  app.post("/api/account/contact/verify", json, handle(async req => {
    requireCsrf(req);
    const user = await sdk.authenticateRequest(req).catch(() => { throw new AuthCodeError(401, "Inicia sesión."); });
    const channel = channelOf(req.body?.channel);
    if (!channel) throw new AuthCodeError(400, "Elige correo o celular.");
    const profile = await contactProfile(user.id);
    const destination = normalizeDestination(channel, channel === "email" ? profile?.email : profile?.phone);
    if (!destination) throw new AuthCodeError(400, "Tu perfil cambió. Pide un código nuevo.");
    await verifyCode({ channel, destination, purpose: "verify_contact", userId: user.id, code: String(req.body?.code ?? "").trim() });
    await markContactVerified(user.id, channel, destination, String(channel === "email" ? profile!.email : profile!.phone));
    return { ok: true, channel };
  }));
}

async function contactProfile(userId: number) {
  const database = await db.getDb();
  if (!database) throw new AuthCodeError(503, "La base de datos no está disponible");
  const rows = await database.select().from(czMembershipProfiles).where(eq(czMembershipProfiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

async function markContactVerified(userId: number, channel: Channel, destination: string, storedValue: string) {
  const database = await db.getDb();
  if (!database) throw new AuthCodeError(503, "La base de datos no está disponible");
  await database.transaction(async (tx: any) => {
    if (channel === "phone") {
      const taken = await tx.select({ id: users.id }).from(users).where(and(eq(users.phone, destination), ne(users.id, userId))).limit(1);
      if (taken.length) throw new AuthCodeError(409, "Ese celular ya está registrado en otra cuenta de CuadraZone.");
      await tx.update(users).set({ phone: destination }).where(eq(users.id, userId));
    }
    // Solo marca el contacto si sigue siendo el mismo que se verificó.
    const contactColumn = channel === "email" ? czMembershipProfiles.email : czMembershipProfiles.phone;
    await tx
      .update(czMembershipProfiles)
      .set(channel === "email" ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() })
      .where(and(eq(czMembershipProfiles.userId, userId), eq(contactColumn, storedValue)));
    await tx.insert(czMembershipAudit).values({
      applicationId: null,
      userId,
      actorUserId: userId,
      action: channel === "email" ? "email_verified_code" : "phone_verified_code",
      reason: null,
      metadata: { last4: destination.slice(-4) },
    });
  });
}
