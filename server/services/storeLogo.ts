/*
 * Logo de la tienda: el vendedor sube una imagen (PNG, JPEG o WEBP, hasta 5 MiB)
 * y se muestra en su tienda, junto a sus productos y en el panel de
 * administración. Sin logo se ven las iniciales de la tienda.
 */
import express, { type Express, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut, storageRemove } from "../storage";
import { czStores } from "../../drizzle/catalog-schema";
import { validateCatalogImageBytes } from "./catalogImages";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Carpeta del logo de una tienda dentro del almacenamiento. */
export const storeLogoFolder = (storeId: number) => `catalog/stores/${storeId}`;

/** Solo se borra un logo anterior si está en la carpeta de esa misma tienda. */
export function ownedLogoKey(storeId: number, url: string | null | undefined) {
  const prefix = `/media/${storeLogoFolder(storeId)}/`;
  if (!url || !url.startsWith(prefix)) return null;
  const key = url.slice("/media/".length);
  return /^[A-Za-z0-9._/-]+$/.test(key) && !key.includes("..") ? key : null;
}

class LogoError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function myStore(req: Request) {
  if (req.headers["x-cz-request"] !== "1")
    throw new LogoError(412, "Falta la cabecera x-cz-request: 1");
  const user = await sdk.authenticateRequest(req).catch(() => null);
  if (!user) throw new LogoError(401, "Inicia sesión");
  const db = await getDb();
  if (!db) throw new LogoError(503, "La base de datos no está disponible");
  const rows = await db
    .select({ id: czStores.id, logoUrl: czStores.logoUrl })
    .from(czStores)
    .where(eq(czStores.userId, user.id))
    .limit(1);
  if (!rows.length)
    throw new LogoError(404, "Primero guarda los datos de tu tienda");
  return { db, store: rows[0]! };
}

async function removeOldLogo(storeId: number, url: string | null) {
  const key = ownedLogoKey(storeId, url);
  if (key)
    await storageRemove(key).catch(error =>
      console.error("[Logo] No se pudo borrar el logo anterior:", error)
    );
}

function sendError(res: Response, error: unknown) {
  if (error instanceof LogoError)
    return res.status(error.status).json({ error: error.message });
  const code = (error as { code?: string }).code;
  if (code === "PAYLOAD_TOO_LARGE")
    return res.status(413).json({ error: "El logo supera 5 MiB" });
  if (code === "UNSUPPORTED_MEDIA_TYPE" || code === "BAD_REQUEST")
    return res
      .status(400)
      .json({ error: "El logo debe ser una imagen PNG, JPEG o WEBP" });
  console.error("[Logo]", error);
  return res.status(500).json({ error: "No se pudo guardar el logo" });
}

async function uploadLogo(req: Request, res: Response) {
  try {
    const { db, store } = await myStore(req);
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]!
      .toLowerCase();
    if (!EXT[mimeType])
      throw new LogoError(400, "El logo debe ser una imagen PNG, JPEG o WEBP");
    validateCatalogImageBytes(req.body, mimeType);
    const saved = await storagePut(
      `${storeLogoFolder(store.id)}/${randomUUID()}.${EXT[mimeType]}`,
      req.body,
      mimeType
    );
    await db
      .update(czStores)
      .set({ logoUrl: saved.url })
      .where(eq(czStores.id, store.id));
    await removeOldLogo(store.id, store.logoUrl);
    return res.status(201).json({ logoUrl: saved.url });
  } catch (error) {
    return sendError(res, error);
  }
}

async function deleteLogo(req: Request, res: Response) {
  try {
    const { db, store } = await myStore(req);
    await db
      .update(czStores)
      .set({ logoUrl: null })
      .where(eq(czStores.id, store.id));
    await removeOldLogo(store.id, store.logoUrl);
    return res.json({ logoUrl: null });
  } catch (error) {
    return sendError(res, error);
  }
}

export function registerStoreLogoRoutes(app: Express) {
  const raw = (req: Request, res: Response, next: () => void) =>
    express.raw({ type: () => true, limit: MAX_LOGO_BYTES })(
      req,
      res,
      error =>
        error
          ? res.status(413).json({ error: "El logo supera 5 MiB" })
          : next()
    );
  app.post("/api/stores/mine/logo", raw, uploadLogo);
  app.delete("/api/stores/mine/logo", deleteLogo);
}
