/*
 * Marca de la tienda (Mayor Visibilidad): portada, lema y color propio, más la
 * insignia «Tienda Destacada». Solo se muestra mientras el plan esté pagado y
 * vigente; si vence, la tienda vuelve a verse como las demás (no se borra nada).
 */
import express, { type Express, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import { czApplications, type User } from "../../drizzle/schema";
import { czStoreBranding } from "../../drizzle/branding-schema";
import type { PublicBranding, SaveBrandingInput } from "@shared/branding";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut, storageRemove } from "../storage";
import { validateCatalogImageBytes } from "./catalogImages";

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const coverFolder = (storeId: number) => `catalog/stores/${storeId}/cover`;

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}

const featuredWhere = and(
  eq(czApplications.status, "approved"),
  eq(czApplications.subscriptionStatus, "active"),
  eq(czApplications.subscriptionPlanId, "mayor_visibilidad")
);

/** La tienda del usuario y si su plan Mayor Visibilidad está vigente. */
async function myStore(userId: number) {
  const db = await requireDb();
  const [store] = await db
    .select({
      id: czStores.id,
      planId: czApplications.subscriptionPlanId,
      status: czApplications.subscriptionStatus,
    })
    .from(czStores)
    .leftJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(eq(czStores.userId, userId))
    .limit(1);
  return {
    db,
    store: store ?? null,
    eligible:
      store?.planId === "mayor_visibilidad" && store.status === "active",
  };
}

export async function myBranding(user: User) {
  const { db, store, eligible } = await myStore(user.id);
  if (!store)
    return {
      hasStore: false,
      eligible: false,
      coverUrl: null,
      tagline: "",
      brandColor: "",
    };
  const [row] = await db
    .select()
    .from(czStoreBranding)
    .where(eq(czStoreBranding.storeId, store.id))
    .limit(1);
  return {
    hasStore: true,
    eligible,
    coverUrl: row?.coverUrl ?? null,
    tagline: row?.tagline ?? "",
    brandColor: row?.brandColor ?? "",
  };
}

export async function saveMyBranding(user: User, input: SaveBrandingInput) {
  const { db, store, eligible } = await myStore(user.id);
  if (!store)
    fail("PRECONDITION_FAILED", "Primero guarda los datos de tu tienda");
  if (!eligible)
    fail(
      "FORBIDDEN",
      "La marca de tu tienda es parte del plan Mayor Visibilidad"
    );
  const values = {
    tagline: input.tagline,
    brandColor: input.brandColor.toLowerCase(),
  };
  await db
    .insert(czStoreBranding)
    .values({ storeId: store.id, ...values })
    .onDuplicateKeyUpdate({ set: values });
  return myBranding(user);
}

/** Marca pública de varias tiendas: solo las que tienen Mayor Visibilidad vigente. */
export async function brandingForSlugs(
  slugs: string[]
): Promise<Record<string, PublicBranding>> {
  const unique = Array.from(new Set(slugs)).slice(0, 60);
  const out: Record<string, PublicBranding> = {};
  if (!unique.length) return out;
  const db = await getDb();
  if (!db) return out;
  const rows = await db
    .select({
      slug: czStores.slug,
      coverUrl: czStoreBranding.coverUrl,
      tagline: czStoreBranding.tagline,
      brandColor: czStoreBranding.brandColor,
    })
    .from(czStores)
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .leftJoin(czStoreBranding, eq(czStoreBranding.storeId, czStores.id))
    .where(and(inArray(czStores.slug, unique), featuredWhere));
  for (const r of rows)
    out[r.slug] = {
      featured: true,
      coverUrl: r.coverUrl ?? null,
      tagline: r.tagline ?? "",
      brandColor: r.brandColor ?? "",
    };
  return out;
}

// ───────────── Portada ─────────────

class CoverError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function coverContext(req: Request) {
  if (req.headers["x-cz-request"] !== "1")
    throw new CoverError(412, "Falta la cabecera x-cz-request: 1");
  const user = await sdk.authenticateRequest(req).catch(() => null);
  if (!user) throw new CoverError(401, "Inicia sesión");
  const { db, store, eligible } = await myStore(user.id);
  if (!store)
    throw new CoverError(404, "Primero guarda los datos de tu tienda");
  if (!eligible)
    throw new CoverError(403, "La portada es parte del plan Mayor Visibilidad");
  const [row] = await db
    .select({ coverUrl: czStoreBranding.coverUrl })
    .from(czStoreBranding)
    .where(eq(czStoreBranding.storeId, store.id))
    .limit(1);
  return { db, storeId: store.id, oldUrl: row?.coverUrl ?? null };
}

async function removeOld(storeId: number, url: string | null) {
  const prefix = `/media/${coverFolder(storeId)}/`;
  if (!url?.startsWith(prefix)) return;
  const key = url.slice("/media/".length);
  if (/^[A-Za-z0-9._/-]+$/.test(key) && !key.includes(".."))
    await storageRemove(key).catch(error =>
      console.error("[Portada] No se pudo borrar la anterior:", error)
    );
}

function sendError(res: Response, error: unknown) {
  if (error instanceof CoverError)
    return res.status(error.status).json({ error: error.message });
  const code = (error as { code?: string }).code;
  if (code === "PAYLOAD_TOO_LARGE")
    return res.status(413).json({ error: "La portada supera 5 MiB" });
  if (code === "UNSUPPORTED_MEDIA_TYPE" || code === "BAD_REQUEST")
    return res
      .status(400)
      .json({ error: "La portada debe ser una imagen PNG, JPEG o WEBP" });
  console.error("[Portada]", error);
  return res.status(500).json({ error: "No se pudo guardar la portada" });
}

async function uploadCover(req: Request, res: Response) {
  try {
    const { db, storeId, oldUrl } = await coverContext(req);
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]!
      .toLowerCase();
    if (!EXT[mimeType])
      throw new CoverError(
        400,
        "La portada debe ser una imagen PNG, JPEG o WEBP"
      );
    validateCatalogImageBytes(req.body, mimeType);
    const saved = await storagePut(
      `${coverFolder(storeId)}/${randomUUID()}.${EXT[mimeType]}`,
      req.body,
      mimeType
    );
    await db
      .insert(czStoreBranding)
      .values({ storeId, coverUrl: saved.url })
      .onDuplicateKeyUpdate({ set: { coverUrl: saved.url } });
    await removeOld(storeId, oldUrl);
    return res.status(201).json({ coverUrl: saved.url });
  } catch (error) {
    return sendError(res, error);
  }
}

async function deleteCover(req: Request, res: Response) {
  try {
    const { db, storeId, oldUrl } = await coverContext(req);
    await db
      .update(czStoreBranding)
      .set({ coverUrl: null })
      .where(eq(czStoreBranding.storeId, storeId));
    await removeOld(storeId, oldUrl);
    return res.json({ coverUrl: null });
  } catch (error) {
    return sendError(res, error);
  }
}

export function registerStoreCoverRoutes(app: Express) {
  const raw = (req: Request, res: Response, next: () => void) =>
    express.raw({ type: () => true, limit: MAX_COVER_BYTES })(
      req,
      res,
      error =>
        error
          ? res.status(413).json({ error: "La portada supera 5 MiB" })
          : next()
    );
  app.post("/api/stores/mine/cover", raw, uploadCover);
  app.delete("/api/stores/mine/cover", deleteCover);
}
