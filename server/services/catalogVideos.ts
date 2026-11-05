// Videos de productos (solo tiendas de comercio). Igual que las fotos: se suben
// a la tienda, se devuelve la dirección y quedan en el producto al guardarlo.
import express, { type Express, type Request, type Response } from "express";
import { MAX_PRODUCT_VIDEO_BYTES } from "@shared/marketplace";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { CatalogError, assertCatalogImageOwner } from "./catalog";

const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

/** Revisa que el archivo de verdad sea un video del tipo que dice ser. */
export function validateVideoBytes(bytes: Buffer, mimeType: string) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 16) throw new CatalogError("BAD_REQUEST", "El video está vacío");
  if (bytes.length > MAX_PRODUCT_VIDEO_BYTES) throw new CatalogError("PAYLOAD_TOO_LARGE", "El video supera el límite de 40 MB");
  const ok =
    mimeType === "video/webm"
      ? bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
      : (mimeType === "video/mp4" || mimeType === "video/quicktime") && bytes.subarray(4, 8).toString("ascii") === "ftyp";
  if (!ok) throw new CatalogError("UNSUPPORTED_MEDIA_TYPE", "Solo se aceptan videos MP4, WEBM o MOV");
}

const status = (e: unknown) =>
  e instanceof CatalogError
    ? (({ BAD_REQUEST: 400, PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, PRECONDITION_FAILED: 412 } as Record<string, number>)[e.code] ?? 500)
    : 500;

async function upload(req: Request, res: Response) {
  try {
    if (req.headers["x-cz-request"] !== "1") throw new CatalogError("PRECONDITION_FAILED", "Falta la cabecera x-cz-request: 1");
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) throw new CatalogError("UNAUTHORIZED", "Inicia sesión");
    const productId = Number(req.params.id);
    if (!Number.isSafeInteger(productId) || productId <= 0) throw new CatalogError("BAD_REQUEST", "Producto inválido");
    const mimeType = String(req.headers["content-type"] ?? "").split(";", 1)[0]!.toLowerCase();
    if (!VIDEO_TYPES[mimeType]) throw new CatalogError("UNSUPPORTED_MEDIA_TYPE", "Solo se aceptan videos MP4, WEBM o MOV");
    validateVideoBytes(req.body, mimeType);
    const db = await getDb();
    if (!db) throw new CatalogError("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
    await assertCatalogImageOwner(db, user.id, productId);
    const saved = await storagePut(`catalog/products/${productId}/videos/${crypto.randomUUID()}.${VIDEO_TYPES[mimeType]}`, req.body, mimeType);
    return res.status(201).json({ url: saved.url });
  } catch (error) {
    return res.status(status(error)).json({ error: error instanceof CatalogError ? error.message : "No se pudo subir el video" });
  }
}

export function registerCatalogVideoRoutes(app: Express) {
  app.post(
    "/api/catalog/products/:id/videos",
    (req, res, next) =>
      express.raw({ type: () => true, limit: MAX_PRODUCT_VIDEO_BYTES })(req, res, error => {
        if (!error) return next();
        return res.status(413).json({ error: "El video supera el límite de 40 MB" });
      }),
    upload
  );
}
