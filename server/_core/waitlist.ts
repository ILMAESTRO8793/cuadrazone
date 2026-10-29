// Lista de espera por país: quien está fuera de Panamá deja su correo para
// recibir un aviso cuando CuadraZone abra en su país.
import { and, eq, gt, sql } from "drizzle-orm";
import express, { type Express } from "express";
import { countries } from "@shared/countries";
import { czCountryWaitlist } from "../../drizzle/schema";
import { getDb } from "../db";
import { normalizeEmail } from "../services/authCodes";
import { adminProcedure } from "./trpc";

const MAX_PER_IP_HOUR = 10;

export function registerWaitlistRoutes(app: Express) {
  app.post("/api/waitlist", express.json({ limit: "2kb" }), async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (req.headers["x-cz-request"] !== "1") return res.status(412).json({ error: "Falta la cabecera x-cz-request: 1" });
    const email = normalizeEmail(req.body?.email);
    const country = countries.find(c => c.code === req.body?.country && !c.active);
    if (!email) return res.status(400).json({ error: "Escribe un correo válido." });
    if (!country) return res.status(400).json({ error: "Elige un país de la lista." });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Inténtalo más tarde." });
    const ip = (req.ip || "desconocida").slice(0, 64);
    const recent = await db
      .select({ n: sql<number>`count(*)` })
      .from(czCountryWaitlist)
      .where(and(eq(czCountryWaitlist.ip, ip), gt(czCountryWaitlist.createdAt, new Date(Date.now() - 3_600_000))));
    if (Number(recent[0]?.n ?? 0) >= MAX_PER_IP_HOUR) return res.status(429).json({ error: "Demasiados intentos. Inténtalo más tarde." });
    await db
      .insert(czCountryWaitlist)
      .values({ email, country: country.code, ip })
      .onDuplicateKeyUpdate({ set: { email } });
    res.json({ ok: true, country: country.name });
  });
}

/** Totales por país para el administrador. */
export const waitlistSummary = adminProcedure.query(async () => {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ country: czCountryWaitlist.country, total: sql<number>`count(*)` })
    .from(czCountryWaitlist)
    .groupBy(czCountryWaitlist.country);
  return rows.map(r => ({ country: r.country, total: Number(r.total) }));
});
