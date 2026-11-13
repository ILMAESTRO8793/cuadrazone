/*
 * Menú de restaurante (parte 1): el vendedor de comercio marca «Es un
 * restaurante», arma secciones y platos con tamaños, combos, quitar y extras,
 * y pone horario y tiempo de preparación. El público ve el menú en la página
 * de la tienda.
 */
import express, { type Express, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import {
  czMenuItems,
  czMenuSections,
  czRestaurants,
} from "../../drizzle/menu-schema";
import {
  defaultWeekHours,
  openStatus,
  type PublicMenuItem,
  type SaveMenuItemInput,
  type WeekHours,
} from "@shared/menu";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { validateCatalogImageBytes } from "./catalogImages";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
const list = <T>(v: unknown): T[] => {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? (v as T[]) : [];
};
const hoursOf = (v: unknown): WeekHours => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as WeekHours;
    } catch {
      return defaultWeekHours;
    }
  }
  return (v as WeekHours) ?? defaultWeekHours;
};

/** La tienda de comercio del usuario (los restaurantes son comercios). */
async function myCommerceStore(db: Db, userId: number) {
  const [store] = await db
    .select({ id: czStores.id, kind: czStores.storeKind })
    .from(czStores)
    .where(eq(czStores.userId, userId))
    .limit(1);
  if (!store)
    fail("PRECONDITION_FAILED", "Primero guarda los datos de tu tienda");
  if (store.kind !== "comercio")
    fail(
      "PRECONDITION_FAILED",
      "El menú de restaurante es para tiendas de comercio"
    );
  return store.id;
}

function itemDto(r: typeof czMenuItems.$inferSelect): PublicMenuItem {
  return {
    id: r.id,
    sectionId: r.sectionId,
    name: r.name,
    description: r.description,
    imageUrl: r.imageUrl ?? null,
    priceCents: r.priceCents,
    available: r.available === 1,
    tags: list<string>(r.tags),
    sizes: list(r.sizes),
    optionGroups: list(r.optionGroups),
  };
}

async function readMenu(db: Db, storeId: number) {
  const [restaurant] = await db
    .select()
    .from(czRestaurants)
    .where(eq(czRestaurants.storeId, storeId))
    .limit(1);
  const sections = await db
    .select({
      id: czMenuSections.id,
      name: czMenuSections.name,
      sortOrder: czMenuSections.sortOrder,
    })
    .from(czMenuSections)
    .where(eq(czMenuSections.storeId, storeId))
    .orderBy(asc(czMenuSections.sortOrder), asc(czMenuSections.id));
  const items = await db
    .select()
    .from(czMenuItems)
    .where(eq(czMenuItems.storeId, storeId))
    .orderBy(asc(czMenuItems.sortOrder), asc(czMenuItems.id));
  return {
    restaurant: restaurant
      ? {
          enabled: restaurant.enabled === 1,
          prepMinutes: restaurant.prepMinutes,
          hours: hoursOf(restaurant.hours),
        }
      : null,
    sections,
    items: items.map(itemDto),
  };
}

// ── Vendedor ──

export async function myMenu(userId: number) {
  const db = await requireDb();
  const [store] = await db
    .select({ id: czStores.id, kind: czStores.storeKind })
    .from(czStores)
    .where(eq(czStores.userId, userId))
    .limit(1);
  if (!store) return { status: "no_store" as const };
  if (store.kind !== "comercio") return { status: "not_commerce" as const };
  return { status: "ok" as const, ...(await readMenu(db, store.id)) };
}

export async function saveRestaurant(
  userId: number,
  input: { enabled: boolean; prepMinutes: number; hours: WeekHours }
) {
  const db = await requireDb();
  const storeId = await myCommerceStore(db, userId);
  const values = {
    enabled: input.enabled ? 1 : 0,
    prepMinutes: input.prepMinutes,
    hours: input.hours,
  };
  await db
    .insert(czRestaurants)
    .values({ storeId, ...values })
    .onDuplicateKeyUpdate({ set: values });
  return myMenu(userId);
}

export async function saveSection(
  userId: number,
  input: { id?: number; name: string; sortOrder: number }
) {
  const db = await requireDb();
  const storeId = await myCommerceStore(db, userId);
  if (input.id) {
    await db
      .update(czMenuSections)
      .set({ name: input.name, sortOrder: input.sortOrder })
      .where(
        and(
          eq(czMenuSections.id, input.id),
          eq(czMenuSections.storeId, storeId)
        )
      );
  } else {
    await db
      .insert(czMenuSections)
      .values({ storeId, name: input.name, sortOrder: input.sortOrder });
  }
  return myMenu(userId);
}

export async function deleteSection(userId: number, id: number) {
  const db = await requireDb();
  const storeId = await myCommerceStore(db, userId);
  // Los platos de la sección se borran con ella (cascade).
  await db
    .delete(czMenuSections)
    .where(and(eq(czMenuSections.id, id), eq(czMenuSections.storeId, storeId)));
  return myMenu(userId);
}

export async function saveMenuItem(userId: number, input: SaveMenuItemInput) {
  const db = await requireDb();
  const storeId = await myCommerceStore(db, userId);
  const [section] = await db
    .select({ id: czMenuSections.id })
    .from(czMenuSections)
    .where(
      and(
        eq(czMenuSections.id, input.sectionId),
        eq(czMenuSections.storeId, storeId)
      )
    )
    .limit(1);
  if (!section) fail("NOT_FOUND", "La sección no existe");
  const values = {
    sectionId: input.sectionId,
    name: input.name,
    description: input.description,
    priceCents: input.sizes.length
      ? Math.min(...input.sizes.map(s => s.priceCents))
      : input.priceCents,
    available: input.available ? 1 : 0,
    tags: input.tags,
    sizes: input.sizes,
    optionGroups: input.optionGroups,
    sortOrder: input.sortOrder,
  };
  if (input.id) {
    await db
      .update(czMenuItems)
      .set(values)
      .where(
        and(eq(czMenuItems.id, input.id), eq(czMenuItems.storeId, storeId))
      );
  } else {
    await db.insert(czMenuItems).values({ storeId, ...values });
  }
  return myMenu(userId);
}

export async function setItemAvailable(
  userId: number,
  id: number,
  available: boolean
) {
  const db = await requireDb();
  const storeId = await myCommerceStore(db, userId);
  await db
    .update(czMenuItems)
    .set({ available: available ? 1 : 0 })
    .where(and(eq(czMenuItems.id, id), eq(czMenuItems.storeId, storeId)));
  return myMenu(userId);
}

export async function deleteMenuItem(userId: number, id: number) {
  const db = await requireDb();
  const storeId = await myCommerceStore(db, userId);
  await db
    .delete(czMenuItems)
    .where(and(eq(czMenuItems.id, id), eq(czMenuItems.storeId, storeId)));
  return myMenu(userId);
}

// ── Público ──

/** Menú de una tienda por su slug; null si no es restaurante o lo apagó. */
export async function publicMenu(slug: string, now = new Date()) {
  const db = await getDb();
  if (!db) return null;
  const [store] = await db
    .select({ id: czStores.id, province: czStores.province })
    .from(czStores)
    .where(eq(czStores.slug, slug))
    .limit(1);
  if (!store) return null;
  const menu = await readMenu(db, store.id);
  if (!menu.restaurant?.enabled) return null;
  const sectionIds = new Set(menu.items.map(i => i.sectionId));
  return {
    province: store.province,
    prepMinutes: menu.restaurant.prepMinutes,
    hours: menu.restaurant.hours,
    status: openStatus(menu.restaurant.hours, now),
    sections: menu.sections.filter(s => sectionIds.has(s.id)),
    items: menu.items,
  };
}

// ── Foto de un plato ──

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function uploadItemPhoto(req: Request, res: Response) {
  try {
    if (req.headers["x-cz-request"] !== "1")
      return res
        .status(412)
        .json({ error: "Falta la cabecera x-cz-request: 1" });
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "Plato inválido" });
    const db = await requireDb();
    const storeId = await myCommerceStore(db, user.id).catch(() => null);
    if (!storeId)
      return res.status(403).json({ error: "No tienes un restaurante" });
    const [item] = await db
      .select({ id: czMenuItems.id })
      .from(czMenuItems)
      .where(and(eq(czMenuItems.id, id), eq(czMenuItems.storeId, storeId)))
      .limit(1);
    if (!item) return res.status(404).json({ error: "El plato no existe" });
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]!
      .toLowerCase();
    if (!EXT[mimeType])
      return res
        .status(400)
        .json({ error: "La foto debe ser PNG, JPEG o WEBP" });
    try {
      validateCatalogImageBytes(req.body, mimeType);
    } catch {
      return res
        .status(400)
        .json({ error: "La foto debe ser PNG, JPEG o WEBP" });
    }
    const saved = await storagePut(
      `catalog/menu/${storeId}/${randomUUID()}.${EXT[mimeType]}`,
      req.body,
      mimeType
    );
    await db
      .update(czMenuItems)
      .set({ imageUrl: saved.url })
      .where(eq(czMenuItems.id, id));
    return res.status(201).json({ imageUrl: saved.url });
  } catch (error) {
    console.error("[Menú] foto", error);
    return res.status(500).json({ error: "No se pudo guardar la foto" });
  }
}

export function registerMenuRoutes(app: Express) {
  const raw = (req: Request, res: Response, next: () => void) =>
    express.raw({ type: () => true, limit: MAX_PHOTO_BYTES })(
      req,
      res,
      error =>
        error ? res.status(413).json({ error: "La foto supera 5 MiB" }) : next()
    );
  app.post("/api/menu/items/:id/photo", raw, uploadItemPhoto);
}
