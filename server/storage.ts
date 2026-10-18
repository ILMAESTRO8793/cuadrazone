// Almacenamiento de fotos públicas del catálogo en disco local.
// En Railway, STORAGE_DIR debe apuntar a un volumen persistente (p. ej. /data/storage);
// sin volumen, las fotos se perderían en cada despliegue.
// Los documentos privados (cédulas, cartas pastorales) NO pasan por aquí: viven
// en la base de datos y solo se sirven tras autorización (privateDocuments.ts).
import express, { type Express } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

export const MEDIA_PREFIX = "/media/";
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

export function isSafeStorageKey(key: string): boolean {
  return key.length > 0 && key.length <= 300 && SAFE_KEY.test(key) && !key.split("/").some(part => part === "." || part === "..");
}

function storageRoot() {
  return path.resolve(ENV.storageDir);
}

/** Ruta absoluta dentro de la carpeta de almacenamiento; nunca fuera de ella. */
function resolveKey(key: string) {
  if (!isSafeStorageKey(key)) throw new Error("Clave de almacenamiento inválida");
  const root = storageRoot();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Clave de almacenamiento fuera de la carpeta");
  return full;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  // "wx": nunca sobrescribe; las claves llevan un UUID aleatorio.
  await writeFile(full, data, { flag: "wx" });
  return { key, url: `${MEDIA_PREFIX}${key}` };
}

export function storageUrl(key: string) {
  return `${MEDIA_PREFIX}${key}`;
}

/** Sirve únicamente las fotos públicas del catálogo, con caché larga e inmutable. */
export function registerMediaRoutes(app: Express) {
  app.use(
    "/media/catalog",
    express.static(path.join(storageRoot(), "catalog"), {
      dotfiles: "deny",
      index: false,
      fallthrough: false,
      immutable: true,
      maxAge: "365d",
      setHeaders: res => res.setHeader("X-Content-Type-Options", "nosniff"),
    }),
  );
}
