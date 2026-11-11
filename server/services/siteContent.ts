// Etapa 6 · Portada administrable: banners del inicio y categorías de productos.
// Las funciones admin* solo se llaman desde adminProcedure; la subida de la foto
// del banner comprueba el rol en la propia ruta.
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";
import express, { type Express, type Request, type Response } from "express";
import {
  czBanners,
  czCatalogCategories,
  czProducts,
} from "../../drizzle/catalog-schema";
import {
  catalogCategories,
  legacyCatalogCategories,
} from "@shared/marketplace";
import {
  isBannerLive,
  MAX_ACTIVE_BANNERS,
  panamaDayOf,
  panamaDayRange,
  type AdminBannerDTO,
  type AdminCategoryDTO,
  type BannerDTO,
  type SaveBannerInput,
  type SaveCategoryInput,
} from "@shared/siteContent";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { validateCatalogImageBytes } from "./catalogImages";

const DAY_MS = 24 * 60 * 60 * 1000;
const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
function affected(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number })?.affectedRows ?? 0);
}

// ───────────── Categorías ─────────────

type CategoryRow = typeof czCatalogCategories.$inferSelect;

async function categoryRows(db: any): Promise<CategoryRow[]> {
  return db
    .select()
    .from(czCatalogCategories)
    .orderBy(asc(czCatalogCategories.sortOrder), asc(czCatalogCategories.name));
}

/**
 * Categorías que se ofrecen hoy al publicar y al filtrar el Mercado. Si la tabla
 * aún está vacía (antes de la migración), se usan las de siempre.
 */
export async function activeCatalogCategories(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [...catalogCategories];
  const rows = await categoryRows(db);
  if (!rows.length) return [...catalogCategories];
  return rows.filter(r => r.active).map(r => r.name);
}

/**
 * ¿Se puede guardar un producto con esta categoría? Las activas siempre; una
 * oculta solo si el producto ya la tenía (para no obligar a cambiarla al editar).
 */
export async function isAllowedProductCategory(
  db: any,
  category: string,
  previous?: string | null
) {
  if (previous && category === previous) return true;
  if ((legacyCatalogCategories as readonly string[]).includes(category))
    return previous === category;
  const rows = await categoryRows(db);
  if (!rows.length)
    return (catalogCategories as readonly string[]).includes(category);
  return rows.some(r => r.active && r.name === category);
}

export async function adminListCategories(): Promise<AdminCategoryDTO[]> {
  const db = await requireDb();
  const rows = await categoryRows(db);
  const counts: Array<{ category: string; n: number }> = await db
    .select({ category: czProducts.category, n: sql<number>`count(*)` })
    .from(czProducts)
    .groupBy(czProducts.category);
  const byName = new Map(counts.map(c => [c.category, Number(c.n)]));
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    active: Boolean(r.active),
    sortOrder: r.sortOrder,
    products: byName.get(r.name) ?? 0,
  }));
}

/**
 * Crea o edita una categoría. Al renombrarla, los productos que la usaban pasan
 * al nombre nuevo para que no queden sueltos.
 */
export async function adminSaveCategory(input: SaveCategoryInput) {
  const db = await requireDb();
  const name = input.name.trim().replace(/\s+/g, " ");
  return db.transaction(async (tx: any) => {
    const duplicate = await tx
      .select({ id: czCatalogCategories.id })
      .from(czCatalogCategories)
      .where(sql`lower(${czCatalogCategories.name}) = lower(${name})`)
      .limit(1);
    if (duplicate.length && duplicate[0].id !== input.id)
      fail("CONFLICT", "Ya existe una categoría con ese nombre");
    const values = {
      name,
      active: input.active ? 1 : 0,
      sortOrder: input.sortOrder,
    };
    if (input.id === undefined) {
      await tx.insert(czCatalogCategories).values(values);
      return { renamed: 0 };
    }
    const [current] = await tx
      .select()
      .from(czCatalogCategories)
      .where(eq(czCatalogCategories.id, input.id))
      .limit(1)
      .for("update");
    if (!current) fail("NOT_FOUND", "Categoría no encontrada");
    await tx
      .update(czCatalogCategories)
      .set(values)
      .where(eq(czCatalogCategories.id, input.id));
    if (current.name === name) return { renamed: 0 };
    const moved = await tx
      .update(czProducts)
      .set({ category: name })
      .where(eq(czProducts.category, current.name));
    return { renamed: affected(moved) };
  });
}

// ───────────── Banners ─────────────

type BannerRow = typeof czBanners.$inferSelect;

function toBanner(r: BannerRow): BannerDTO {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    imageUrl: r.imageUrl,
    linkUrl: r.linkUrl,
  };
}

/** Banners que se ven ahora en la portada (activos, con foto y en fecha). */
export async function liveBanners(
  now: Date = new Date()
): Promise<BannerDTO[]> {
  const db = await getDb();
  if (!db) return [];
  const rows: BannerRow[] = await db
    .select()
    .from(czBanners)
    .where(eq(czBanners.active, 1))
    .orderBy(asc(czBanners.sortOrder), asc(czBanners.id));
  return rows
    .filter(r => isBannerLive(r, now))
    .slice(0, MAX_ACTIVE_BANNERS)
    .map(toBanner);
}

export async function adminListBanners(
  now: Date = new Date()
): Promise<AdminBannerDTO[]> {
  const db = await requireDb();
  const rows: BannerRow[] = await db
    .select()
    .from(czBanners)
    .orderBy(asc(czBanners.sortOrder), asc(czBanners.id));
  return rows.map(r => ({
    ...toBanner(r),
    active: Boolean(r.active),
    sortOrder: r.sortOrder,
    startsOn: panamaDayOf(r.startsAt),
    // endsAt se guarda como el inicio del día siguiente (fin exclusivo).
    endsOn: r.endsAt
      ? panamaDayOf(new Date(new Date(r.endsAt).getTime() - DAY_MS))
      : "",
    live: isBannerLive(r, now),
  }));
}

export async function adminSaveBanner(input: SaveBannerInput) {
  const db = await requireDb();
  const values = {
    title: input.title,
    subtitle: input.subtitle,
    linkUrl: input.linkUrl,
    active: input.active ? 1 : 0,
    sortOrder: input.sortOrder,
    startsAt: input.startsOn ? panamaDayRange(input.startsOn).start : null,
    endsAt: input.endsOn ? panamaDayRange(input.endsOn).end : null,
  };
  if (input.id === undefined) {
    const result = await db.insert(czBanners).values(values);
    const header = Array.isArray(result) ? result[0] : result;
    return { id: Number((header as { insertId?: number }).insertId) };
  }
  const updated = await db
    .update(czBanners)
    .set(values)
    .where(eq(czBanners.id, input.id));
  if (!affected(updated)) {
    const exists = await db
      .select({ id: czBanners.id })
      .from(czBanners)
      .where(eq(czBanners.id, input.id))
      .limit(1);
    if (!exists.length) fail("NOT_FOUND", "Banner no encontrado");
  }
  return { id: input.id };
}

export async function adminDeleteBanner(id: number) {
  const db = await requireDb();
  const deleted = await db.delete(czBanners).where(eq(czBanners.id, id));
  if (!affected(deleted)) fail("NOT_FOUND", "Banner no encontrado");
  return { ok: true };
}

async function uploadBannerImage(req: Request, res: Response) {
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
      return res.status(400).json({ error: "Banner inválido" });
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]!
      .toLowerCase();
    validateCatalogImageBytes(req.body, mimeType);
    const db = await requireDb();
    const rows = await db
      .select({ id: czBanners.id })
      .from(czBanners)
      .where(eq(czBanners.id, id))
      .limit(1);
    if (!rows.length)
      return res.status(404).json({ error: "Banner no encontrado" });
    const saved = await storagePut(
      `catalog/banners/${id}/${randomUUID()}.${IMAGE_EXT[mimeType]}`,
      req.body,
      mimeType
    );
    await db
      .update(czBanners)
      .set({ imageUrl: saved.url })
      .where(eq(czBanners.id, id));
    return res.status(201).json({ url: saved.url });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return res.status(code === "PAYLOAD_TOO_LARGE" ? 413 : 400).json({
      error:
        error instanceof Error ? error.message : "No se pudo subir la foto",
    });
  }
}

export function registerBannerImageRoutes(app: Express) {
  app.post(
    "/api/admin/banners/:id/image",
    express.raw({ type: () => true, limit: 5 * 1024 * 1024 }),
    uploadBannerImage
  );
}
