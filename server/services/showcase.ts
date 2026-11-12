/*
 * Vitrina de cada sección: un reel o video grande, tiendas destacadas y
 * productos promocionados. El público la ve; solo un administrador la arma.
 */
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import express, { type Express, type Request, type Response } from "express";
import { czStores } from "../../drizzle/catalog-schema";
import { czApplications } from "../../drizzle/schema";
import { czShowcaseItems } from "../../drizzle/showcase-schema";
import {
  MAX_SHOWCASE_TILES,
  isShowcaseLive,
  type AdminShowcaseItem,
  type SaveShowcaseInput,
  type ShowcaseSection,
  type ShowcaseTile,
  type ShowcaseZone,
} from "@shared/showcase";
import { MAX_PRODUCT_VIDEO_BYTES } from "@shared/marketplace";
import { panamaDateKey } from "@shared/finance";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut, storageRemove } from "../storage";
import { validateCatalogImageBytes } from "./catalogImages";
import { validateVideoBytes } from "./catalogVideos";

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}

const folder = (id: number) => `catalog/showcase/${id}`;

type Row = typeof czShowcaseItems.$inferSelect & {
  storeName: string | null;
  storeSlug: string | null;
  storeLogo: string | null;
};

function toAdmin(r: Row): AdminShowcaseItem {
  const store = r.storeSlug
    ? {
        name: r.storeName ?? "",
        slug: r.storeSlug,
        logoUrl: r.storeLogo ?? null,
      }
    : null;
  return {
    id: r.id,
    section: r.section as ShowcaseSection,
    zone: r.zone as ShowcaseZone,
    title: r.title,
    subtitle: r.subtitle,
    mediaUrl: r.mediaUrl ?? null,
    mediaType: r.mediaType === "video" ? "video" : "image",
    // Sin enlace propio, una tienda destacada lleva a su página.
    linkUrl: r.linkUrl || (store ? `/tiendas/${store.slug}` : ""),
    store,
    storeId: r.storeId ?? null,
    active: r.active === 1,
    sortOrder: r.sortOrder,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
  };
}

async function selectItems(sections?: ShowcaseSection[]) {
  const db = await requireDb();
  const rows = await db
    .select({
      item: czShowcaseItems,
      storeName: czStores.name,
      storeSlug: czStores.slug,
      storeLogo: czStores.logoUrl,
    })
    .from(czShowcaseItems)
    .leftJoin(czStores, eq(czStores.id, czShowcaseItems.storeId))
    .where(sections ? inArray(czShowcaseItems.section, sections) : undefined)
    .orderBy(asc(czShowcaseItems.sortOrder), asc(czShowcaseItems.id));
  return rows.map(r =>
    toAdmin({
      ...r.item,
      storeName: r.storeName,
      storeSlug: r.storeSlug,
      storeLogo: r.storeLogo,
    })
  );
}

/** Lo que ve el público en una sección (más lo marcado para «todas»). */
export async function publicShowcase(
  section: ShowcaseSection,
  now = new Date()
) {
  const db = await getDb();
  if (!db) return { reel: null, stores: [], products: [] };
  const today = panamaDateKey(now);
  const items = (await selectItems([section, "todas"])).filter(i =>
    isShowcaseLive(i, today)
  );
  // Una tienda con el plan vencido no sale en la vitrina.
  const storeIds = Array.from(new Set(items.map(i => i.storeId).filter((id): id is number => id !== null)));
  const activeIds = new Set(
    storeIds.length
      ? (
          await db
            .select({ id: czStores.id })
            .from(czStores)
            .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
            .where(and(inArray(czStores.id, storeIds), eq(czApplications.subscriptionStatus, "active")))
        ).map(r => r.id)
      : []
  );
  const live = items.filter(i => i.storeId === null || activeIds.has(i.storeId));
  const tile = (i: AdminShowcaseItem): ShowcaseTile => ({
    id: i.id,
    zone: i.zone,
    title: i.title,
    subtitle: i.subtitle,
    mediaUrl: i.mediaUrl,
    mediaType: i.mediaType,
    linkUrl: i.linkUrl,
    store: i.store,
  });
  // Lo propio de la sección va antes que lo general.
  const ordered = [
    ...live.filter(i => i.section === section),
    ...live.filter(i => i.section !== section),
  ];
  return {
    reel:
      ordered.filter(i => i.zone === "reel" && i.mediaUrl).map(tile)[0] ?? null,
    stores: ordered
      .filter(i => i.zone === "tienda")
      .slice(0, MAX_SHOWCASE_TILES)
      .map(tile),
    products: ordered
      .filter(i => i.zone === "producto")
      .slice(0, MAX_SHOWCASE_TILES)
      .map(tile),
  };
}

export const adminListShowcase = () => selectItems();

export async function adminSaveShowcase(input: SaveShowcaseInput) {
  const db = await requireDb();
  if (input.storeId) {
    const store = await db
      .select({ id: czStores.id })
      .from(czStores)
      .where(eq(czStores.id, input.storeId))
      .limit(1);
    if (!store.length) fail("NOT_FOUND", "La tienda no existe");
  }
  const values = {
    section: input.section,
    zone: input.zone,
    title: input.title,
    subtitle: input.subtitle,
    linkUrl: input.linkUrl,
    storeId: input.storeId,
    active: input.active ? 1 : 0,
    sortOrder: input.sortOrder,
    ...(input.mediaUrl && !input.mediaUrl.startsWith("/media/catalog/showcase/")
      ? { mediaUrl: input.mediaUrl, mediaType: "image" }
      : {}),
    startsOn: input.startsOn,
    endsOn: input.endsOn,
  };
  if (!input.id) {
    const [res] = await db.insert(czShowcaseItems).values(values);
    return { id: Number((res as { insertId?: number }).insertId ?? 0) };
  }
  const exists = await db
    .select({ id: czShowcaseItems.id })
    .from(czShowcaseItems)
    .where(eq(czShowcaseItems.id, input.id))
    .limit(1);
  if (!exists.length)
    fail("NOT_FOUND", "No se encontró ese bloque de la vitrina");
  await db
    .update(czShowcaseItems)
    .set(values)
    .where(eq(czShowcaseItems.id, input.id));
  return { id: input.id };
}

export async function adminDeleteShowcase(id: number) {
  const db = await requireDb();
  await db.delete(czShowcaseItems).where(eq(czShowcaseItems.id, id));
  await storageRemove(folder(id)).catch(() => undefined);
  return { ok: true };
}

const MEDIA_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

async function uploadMedia(req: Request, res: Response) {
  try {
    if (req.headers["x-cz-request"] !== "1")
      return res
        .status(412)
        .json({ error: "Falta la cabecera x-cz-request: 1" });
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });
    if (user.role !== "admin")
      return res.status(403).json({ error: "Solo administradores" });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0)
      return res.status(400).json({ error: "Bloque inválido" });
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]!
      .toLowerCase();
    if (!MEDIA_EXT[mimeType])
      return res
        .status(415)
        .json({
          error: "Sube una foto (JPG, PNG, WEBP) o un video (MP4, WEBM, MOV)",
        });
    const isVideo = mimeType.startsWith("video/");
    if (isVideo) validateVideoBytes(req.body, mimeType);
    else {
      if (req.body.length > 5 * 1024 * 1024)
        return res.status(413).json({ error: "La foto supera 5 MB" });
      validateCatalogImageBytes(req.body, mimeType);
    }
    const db = await requireDb();
    const rows = await db
      .select({ id: czShowcaseItems.id, mediaUrl: czShowcaseItems.mediaUrl })
      .from(czShowcaseItems)
      .where(eq(czShowcaseItems.id, id))
      .limit(1);
    if (!rows.length)
      return res
        .status(404)
        .json({ error: "No se encontró ese bloque de la vitrina" });
    const saved = await storagePut(
      `${folder(id)}/${randomUUID()}.${MEDIA_EXT[mimeType]}`,
      req.body,
      mimeType
    );
    await db
      .update(czShowcaseItems)
      .set({ mediaUrl: saved.url, mediaType: isVideo ? "video" : "image" })
      .where(and(eq(czShowcaseItems.id, id)));
    const old = rows[0]!.mediaUrl;
    if (old?.startsWith(`/media/${folder(id)}/`))
      await storageRemove(old.slice("/media/".length)).catch(() => undefined);
    return res.status(201).json({ url: saved.url });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return res
      .status(code === "PAYLOAD_TOO_LARGE" ? 413 : 400)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "No se pudo subir el archivo",
      });
  }
}

export function registerShowcaseMediaRoutes(app: Express) {
  app.post(
    "/api/admin/showcase/:id/media",
    (req, res, next) =>
      express.raw({ type: () => true, limit: MAX_PRODUCT_VIDEO_BYTES })(
        req,
        res,
        error =>
          error
            ? res.status(413).json({ error: "El archivo supera 40 MB" })
            : next()
      ),
    uploadMedia
  );
}
