import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { sdk, type AuthenticatedUser } from "../_core/sdk";
import { storagePut } from "../storage";
import { CatalogError, assertCatalogImageOwner, persistCatalogImage } from "./catalog";
import { getDb } from "../db";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function errorStatus(error: unknown): number {
  if (!(error instanceof CatalogError)) return 500;
  return ({ BAD_REQUEST: 400, PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, PRECONDITION_FAILED: 412 } as Record<string, number>)[error.code] ?? 500;
}
function errorMessage(error: unknown): string {
  return error instanceof CatalogError ? error.message : "No se pudo procesar la foto";
}
export function validateCatalogImageBytes(bytes: Buffer, mimeType: string): void {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new CatalogError("BAD_REQUEST", "La foto está vacía o no es binaria");
  if (bytes.length > MAX_IMAGE_BYTES) throw new CatalogError("PAYLOAD_TOO_LARGE", "La foto supera el límite de 5 MiB");
  if (!MIME_TYPES.has(mimeType) || !signatureMatches(bytes, mimeType)) throw new CatalogError("UNSUPPORTED_MEDIA_TYPE", "El tipo MIME y la firma de la foto no coinciden");
}
function signatureMatches(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}
function requireRequestHeader(req: Request) {
  if (req.headers["x-cz-request"] !== "1") throw new CatalogError("PRECONDITION_FAILED", "Falta la cabecera x-cz-request: 1");
}
async function authenticate(req: Request): Promise<AuthenticatedUser> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user;
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError("UNAUTHORIZED", "Autenticación requerida");
  }
}
function rawBody(req: Request, res: Response, next: NextFunction) {
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES })(req, res, error => {
    if (!error) return next();
    const status = (error as { type?: string; status?: number }).type === "entity.too.large" || (error as { status?: number }).status === 413 ? 413 : 400;
    return res.status(status).json({ error: status === 413 ? "La foto supera el límite de 5 MiB" : "Carga raw inválida" });
  });
}

async function upload(req: Request, res: Response) {
  try {
    requireRequestHeader(req);
    const user = await authenticate(req);
    const productId = Number(req.params.id);
    if (!Number.isSafeInteger(productId) || productId <= 0) throw new CatalogError("BAD_REQUEST", "Producto inválido");
    const mimeType = String(req.headers["content-type"] ?? "").split(";", 1)[0].toLowerCase();
    if (!MIME_TYPES.has(mimeType)) throw new CatalogError("UNSUPPORTED_MEDIA_TYPE", "Solo se aceptan PNG, JPEG o WEBP");
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new CatalogError("BAD_REQUEST", "La carga debe enviarse como bytes raw");
    validateCatalogImageBytes(req.body, mimeType);
    const db = await getDb();
    if (!db) throw new CatalogError("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
    await assertCatalogImageOwner(db, user.id, productId);
    const key = `catalog/products/${productId}/${crypto.randomUUID()}.${extensions[mimeType]}`;
    const uploaded = await storagePut(key, req.body, mimeType);
    const saved = await persistCatalogImage(user.id, productId, { key: uploaded.key, url: uploaded.url, mimeType, size: req.body.length });
    return res.status(201).json(saved);
  } catch (error) {
    return res.status(errorStatus(error)).json({ error: errorMessage(error) });
  }
}

/** Parent server mounts this before its JSON parser, like privateDocuments. */
export function registerCatalogImageRoutes(app: Express) {
  app.post("/api/catalog/products/:id/images", rawBody, upload);
}
