// Códigos de 6 dígitos para entrar con correo o celular, o para verificar un
// contacto del perfil. Se guarda solo el HMAC del código (clave SESSION_SECRET),
// caducan a los 10 minutos y admiten 5 intentos.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { czAuthCodes } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { isSmsConfigured, sendSms } from "../_core/sms";
import { getDb } from "../db";
import { isEmailConfigured, renderEmail, sendViaBrevo } from "./email";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_WAIT_MS = 60 * 1000;
export const MAX_PER_DESTINATION_HOUR = 5;
export const MAX_PER_IP_HOUR = 20;

export type Channel = "email" | "phone";
export type Purpose = "login" | "verify_contact";

export class AuthCodeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Correo en minúsculas y sin espacios, o null si no es válido. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** Celular de Panamá como +5076XXXXXXX (acepta «6123-4567», «+507 6123 4567», «50761234567»). */
export function normalizePanamaMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("507")) digits = digits.slice(3);
  return /^6\d{7}$/.test(digits) ? `+507${digits}` : null;
}

export function normalizeDestination(channel: Channel, value: unknown) {
  return channel === "email" ? normalizeEmail(value) : normalizePanamaMobile(value);
}

export function maskDestination(channel: Channel, destination: string) {
  if (channel === "phone") return `+507 ••••-${destination.slice(-4)}`;
  const [user, domain] = destination.split("@");
  return `${user!.slice(0, 2)}•••@${domain}`;
}

export function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(destination: string, code: string) {
  const secret = ENV.cookieSecret;
  if (secret.length < 32) throw new Error("SESSION_SECRET no está configurado");
  return createHmac("sha256", secret).update(`${destination}:${code}`).digest("hex");
}

export function channelAvailable(channel: Channel) {
  return channel === "email" ? isEmailConfigured() : isSmsConfigured();
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new AuthCodeError(503, "La base de datos no está disponible");
  return db;
}

async function countSince(db: any, column: any, value: string, since: Date) {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(czAuthCodes)
    .where(and(eq(column, value), gt(czAuthCodes.createdAt, since)));
  return Number(rows[0]?.n ?? 0);
}

async function deliver(channel: Channel, destination: string, code: string, purpose: Purpose) {
  if (channel === "phone") {
    await sendSms(destination, `CuadraZone: tu código es ${code}. Vence en 10 minutos. No lo compartas con nadie.`);
    return;
  }
  const mail = renderEmail({
    subject: `${code} es tu código de CuadraZone`,
    title: purpose === "login" ? "Tu código para entrar" : "Tu código de verificación",
    paragraphs: [`Escribe este código en CuadraZone: ${code}`, "Vence en 10 minutos. Si no lo pediste, ignora este correo; nadie podrá entrar sin el código."],
  });
  await sendViaBrevo({ toEmail: destination, toName: null, subject: mail.subject, html: mail.html, textBody: mail.text });
}

/** Crea y envía un código, respetando los límites por destino y por IP. */
export async function requestCode(opts: { channel: Channel; destination: string; purpose: Purpose; userId?: number | null; ip: string }) {
  if (!channelAvailable(opts.channel))
    throw new AuthCodeError(503, opts.channel === "phone" ? "La entrada con celular todavía no está activa." : "La entrada con correo todavía no está activa.");
  const db = await requireDb();
  const now = Date.now();
  const latest = await db
    .select({ createdAt: czAuthCodes.createdAt })
    .from(czAuthCodes)
    .where(eq(czAuthCodes.destination, opts.destination))
    .orderBy(desc(czAuthCodes.createdAt))
    .limit(1);
  if (latest[0] && now - new Date(latest[0].createdAt).getTime() < RESEND_WAIT_MS)
    throw new AuthCodeError(429, "Espera un minuto antes de pedir otro código.");
  const hourAgo = new Date(now - 60 * 60 * 1000);
  if ((await countSince(db, czAuthCodes.destination, opts.destination, hourAgo)) >= MAX_PER_DESTINATION_HOUR)
    throw new AuthCodeError(429, "Pediste demasiados códigos. Inténtalo de nuevo en una hora.");
  if ((await countSince(db, czAuthCodes.ip, opts.ip, hourAgo)) >= MAX_PER_IP_HOUR)
    throw new AuthCodeError(429, "Demasiados intentos desde esta conexión. Inténtalo más tarde.");

  const code = generateCode();
  await db.insert(czAuthCodes).values({
    purpose: opts.purpose,
    channel: opts.channel,
    destination: opts.destination,
    userId: opts.userId ?? null,
    codeHash: hashCode(opts.destination, code),
    expiresAt: new Date(now + CODE_TTL_MS),
    ip: opts.ip.slice(0, 64),
  });
  try {
    await deliver(opts.channel, opts.destination, code, opts.purpose);
  } catch (error) {
    console.error(`[Códigos] No se pudo enviar por ${opts.channel}:`, error instanceof Error ? error.message : error);
    throw new AuthCodeError(502, "No pudimos enviar el código. Inténtalo de nuevo en unos minutos.");
  }
  return { masked: maskDestination(opts.channel, opts.destination) };
}

/** Comprueba el código más reciente y lo marca como usado. Devuelve true si es correcto. */
export async function verifyCode(opts: { channel: Channel; destination: string; purpose: Purpose; code: string; userId?: number | null }) {
  if (!/^\d{6}$/.test(opts.code)) throw new AuthCodeError(400, "El código tiene 6 dígitos.");
  const db = await requireDb();
  const rows = await db
    .select()
    .from(czAuthCodes)
    .where(and(
      eq(czAuthCodes.destination, opts.destination),
      eq(czAuthCodes.purpose, opts.purpose),
      eq(czAuthCodes.channel, opts.channel),
      isNull(czAuthCodes.consumedAt),
      gt(czAuthCodes.expiresAt, new Date()),
    ))
    .orderBy(desc(czAuthCodes.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row || (opts.purpose === "verify_contact" && row.userId !== (opts.userId ?? null)))
    throw new AuthCodeError(400, "El código venció o no existe. Pide uno nuevo.");
  if (row.attempts >= MAX_ATTEMPTS) throw new AuthCodeError(429, "Demasiados intentos. Pide un código nuevo.");
  // Cuenta el intento antes de comparar, para que no se pueda probar en paralelo.
  const counted: any = await db
    .update(czAuthCodes)
    .set({ attempts: row.attempts + 1 })
    .where(and(eq(czAuthCodes.id, row.id), eq(czAuthCodes.attempts, row.attempts), isNull(czAuthCodes.consumedAt)));
  const header = Array.isArray(counted) ? counted[0] : counted;
  if (Number(header?.affectedRows ?? 0) !== 1) throw new AuthCodeError(409, "Inténtalo de nuevo.");
  const expected = Buffer.from(row.codeHash, "hex");
  const given = Buffer.from(hashCode(opts.destination, opts.code), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new AuthCodeError(400, left > 0 ? `Código incorrecto. Te quedan ${left} intentos.` : "Código incorrecto. Pide un código nuevo.");
  }
  const consumed: any = await db
    .update(czAuthCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(czAuthCodes.id, row.id), isNull(czAuthCodes.consumedAt)));
  const consumedHeader = Array.isArray(consumed) ? consumed[0] : consumed;
  if (Number(consumedHeader?.affectedRows ?? 0) !== 1) throw new AuthCodeError(409, "El código ya se usó. Pide uno nuevo.");
  return true;
}
