// Respaldo completo de la base de datos para el administrador: un solo archivo
// .sql con la estructura y todos los datos, listo para restaurar en otro MySQL.
// Contiene datos personales y documentos privados: solo administradores.
import { randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import mysql from "mysql2/promise";
import { czMembershipAudit } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "./sdk";

/**
 * Para descargar el respaldo primero se pide un permiso de un solo uso que
 * vence en 60 segundos (POST con la cabecera anti-CSRF). Así un enlace en otra
 * página no puede disparar la descarga.
 */
const TICKET_MS = 60 * 1000;
const tickets = new Map<string, { adminId: number; expiresAt: number }>();

export function issueBackupTicket(adminId: number, now = Date.now()) {
  for (const [key, t] of tickets) if (t.expiresAt <= now) tickets.delete(key);
  const ticket = randomBytes(24).toString("base64url");
  tickets.set(ticket, { adminId, expiresAt: now + TICKET_MS });
  return ticket;
}

/** Usa el permiso: vale una sola vez, solo para el mismo administrador y antes de vencer. */
export function useBackupTicket(ticket: unknown, adminId: number, now = Date.now()) {
  if (typeof ticket !== "string") return false;
  const t = tickets.get(ticket);
  tickets.delete(ticket);
  return Boolean(t && t.adminId === adminId && t.expiresAt > now);
}

async function requestTicket(req: Request, res: Response) {
  res.set("Cache-Control", "no-store");
  if (req.headers["x-cz-request"] !== "1") return res.status(412).json({ error: "Falta la cabecera x-cz-request: 1" });
  const user = await sdk.authenticateRequest(req).catch(() => null);
  if (!user) return res.status(401).json({ error: "Inicia sesión como administrador." });
  if (user.role !== "admin") return res.status(403).json({ error: "Solo el administrador puede descargar el respaldo." });
  return res.json({ ticket: issueBackupTicket(user.id) });
}

const BATCH = 500;

/** Valor de una fila como literal SQL. */
export function sqlValue(conn: { escape: (v: unknown) => string }, value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (Buffer.isBuffer(value)) return value.length ? `X'${value.toString("hex")}'` : "''";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  // Las columnas JSON llegan como objeto: se guardan como texto JSON.
  if (typeof value === "object" && !(value instanceof Date)) return conn.escape(JSON.stringify(value));
  return conn.escape(value);
}

export async function writeBackup(databaseUrl: string, write: (chunk: string) => void) {
  const conn = await mysql.createConnection({ uri: databaseUrl, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
  try {
    const [[{ db }]] = (await conn.query("SELECT DATABASE() AS db")) as any;
    write(`-- Respaldo de CuadraZone\n-- Base de datos: ${db}\n-- Fecha: ${new Date().toISOString()}\n-- Contiene datos personales y documentos privados. Guárdalo en un lugar seguro.\n\n`);
    write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n");
    const [tables] = (await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")) as any;
    for (const row of tables) {
      const table = String(Object.values(row)[0]);
      const quoted = conn.escapeId(table);
      const [[create]] = (await conn.query(`SHOW CREATE TABLE ${quoted}`)) as any;
      write(`-- Tabla ${table}\nDROP TABLE IF EXISTS ${quoted};\n${create["Create Table"]};\n`);
      for (let offset = 0; ; offset += BATCH) {
        const [rows] = (await conn.query(`SELECT * FROM ${quoted} LIMIT ${BATCH} OFFSET ${offset}`)) as any;
        if (!rows.length) break;
        const columns = Object.keys(rows[0]).map(c => conn.escapeId(c)).join(", ");
        const values = rows.map((r: Record<string, unknown>) => `(${Object.values(r).map(v => sqlValue(conn, v)).join(", ")})`).join(",\n");
        write(`INSERT INTO ${quoted} (${columns}) VALUES\n${values};\n`);
        if (rows.length < BATCH) break;
      }
      write("\n");
    }
    write("SET FOREIGN_KEY_CHECKS=1;\n-- Fin del respaldo\n");
    return tables.length as number;
  } finally {
    await conn.end();
  }
}

async function download(req: Request, res: Response) {
  const user = await sdk.authenticateRequest(req).catch(() => null);
  if (!user) return res.status(401).send("Inicia sesión como administrador.");
  if (user.role !== "admin") return res.status(403).send("Solo el administrador puede descargar el respaldo.");
  if (!useBackupTicket(req.query.t, user.id))
    return res.status(403).send("El permiso de descarga venció. Vuelve a pulsar «Descargar respaldo».");
  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).send("La base de datos no está configurada.");
  const day = new Date().toISOString().slice(0, 10);
  res.set({
    "Content-Type": "application/sql; charset=utf-8",
    "Content-Disposition": `attachment; filename="cuadrazone-respaldo-${day}.sql"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  try {
    const tables = await writeBackup(url, chunk => res.write(chunk));
    console.log(`[Respaldo] El administrador #${user.id} descargó el respaldo (${tables} tablas)`);
    // Queda anotado quién lo descargó y cuándo.
    const db = await getDb();
    await db
      ?.insert(czMembershipAudit)
      .values({ applicationId: null, userId: user.id, actorUserId: user.id, action: "backup_downloaded", reason: null, metadata: { tables } })
      .catch(() => undefined);
    res.end();
  } catch (error) {
    console.error("[Respaldo] Error:", error instanceof Error ? error.message : error);
    if (!res.headersSent) res.status(500).send("No se pudo generar el respaldo.");
    else res.end("\n-- ERROR: el respaldo quedó incompleto. Vuelve a descargarlo.\n");
  }
}

export function registerBackupRoutes(app: Express) {
  app.post("/api/admin/respaldo/permiso", requestTicket);
  app.get("/api/admin/respaldo.sql", download);
}
