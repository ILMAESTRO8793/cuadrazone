/**
 * Límites de peticiones en memoria (Railway corre una sola instancia).
 *
 * Cuenta por persona: la sesión si la hay, si no la IP. Así un abuso desde una
 * cuenta no bloquea a todos los que comparten una red, y alguien sin sesión no
 * puede esquivarlo cambiando de cuenta.
 */
import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Cuenta una petición. Devuelve los segundos de espera si se pasó del límite, o 0. */
export function hit(key: string, max: number, windowMs: number, now = Date.now()): number {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  bucket.count++;
  return bucket.count > max ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
}

/** Para las pruebas. */
export function resetRateLimits() {
  buckets.clear();
}

// Limpia los contadores vencidos para que la memoria no crezca.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 5 * 60 * 1000);
sweeper.unref?.();

export function clientKey(req: Request): string {
  const session = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (session) return `s:${createHash("sha256").update(session).digest("hex").slice(0, 24)}`;
  return `ip:${req.ip || req.socket?.remoteAddress || "?"}`;
}

const TOO_MANY = "Demasiadas peticiones. Espera un momento y vuelve a intentarlo.";

type Rule = {
  name: string;
  max: number;
  windowMs: number;
  /** Solo cuenta las peticiones que cumplen esto. */
  when?: (req: Request) => boolean;
  /** Por defecto: la persona (sesión o IP). */
  key?: (req: Request) => string;
};

export function rateLimit(rule: Rule) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (rule.when && !rule.when(req)) return next();
    const wait = hit(`${rule.name}:${(rule.key ?? clientKey)(req)}`, rule.max, rule.windowMs);
    if (!wait) return next();
    res.set("Retry-After", String(wait));
    return res.status(429).json({ error: TOO_MANY });
  };
}

/** Procedimientos tRPC de una petición (también en lote: «a.b,c.d»). */
export function trpcPaths(req: Request): string[] {
  const match = req.path.match(/^\/api\/trpc\/(.+)$/);
  return match ? decodeURIComponent(match[1]!).split(",") : [];
}

/** Lo que más se presta a spam: mensajes, preguntas, reseñas, contactos y postulaciones. */
export const SPAM_PRONE = new Set([
  "commerce.sendMessage",
  "commerce.askQuestion",
  "commerce.review",
  "listingReviews.save",
  "listingReviews.contact",
  "jobs.applyToJob",
  "services.requestService",
  "appointments.book",
]);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Todos los límites, en el orden en que se aplican. */
export function rateLimits() {
  return [
    // Cualquier llamada a la API: 300 por minuto por persona.
    rateLimit({ name: "api", max: 300, windowMs: MINUTE, when: req => req.path.startsWith("/api/") }),
    // Operaciones que cambian datos: 60 por minuto.
    rateLimit({
      name: "write",
      max: 60,
      windowMs: MINUTE,
      when: req => req.method !== "GET" && req.method !== "HEAD" && req.path.startsWith("/api/"),
    }),
    // Mensajes, preguntas, reseñas, contactos y postulaciones: 30 por hora.
    rateLimit({
      name: "spam",
      max: 30,
      windowMs: HOUR,
      when: req => req.method === "POST" && trpcPaths(req).some(p => SPAM_PRONE.has(p)),
    }),
    // Subidas de fotos, videos y documentos: 120 cada 10 minutos.
    rateLimit({
      name: "upload",
      max: 120,
      windowMs: 10 * MINUTE,
      when: req =>
        req.method === "POST" &&
        req.path.startsWith("/api/") &&
        !req.path.startsWith("/api/trpc/") &&
        !req.path.startsWith("/api/auth/") &&
        !req.path.startsWith("/api/account/"),
    }),
    // Leer un CV en PDF usa mucha CPU: 10 por hora.
    rateLimit({ name: "pdf", max: 10, windowMs: HOUR, when: req => req.method === "POST" && req.path === "/api/resume/import" }),
    // Inicio de sesión: además de los límites por correo o celular, 30 cada 10 minutos por IP.
    rateLimit({
      name: "auth",
      max: 30,
      windowMs: 10 * MINUTE,
      when: req => req.method === "POST" && (req.path.startsWith("/api/auth/") || req.path.startsWith("/api/account/")),
      key: req => `ip:${req.ip || "?"}`,
    }),
  ];
}
