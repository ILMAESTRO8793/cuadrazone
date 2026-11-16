// Bienes raíces. Cualquier persona con cuenta puede crear anuncios; para
// publicarlos necesita el plan de Bienes raíces (ver sectionPlans.ts): la
// primera vez empieza su mes gratis. Si el plan vence, los anuncios dejan de
// mostrarse sin borrarse.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import express, { type Express, type Request, type Response } from "express";
import { czProperties } from "../../drizzle/catalog-schema";
import type { User } from "../../drizzle/schema";
import {
  MAX_PROPERTY_IMAGES,
  savePropertyInput,
  type OwnPropertyDTO,
  type PropertyDTO,
  type PropertyFilters,
  type SavePropertyInput,
} from "@shared/realEstate";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { validateCatalogImageBytes } from "./catalogImages";
import { NO_PLAN, assertCanPublish, publishPlans } from "./sectionPlans";

const PAGE_SIZE = 24;
const IMAGE_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
const changed = (result: unknown) => Number(((Array.isArray(result) ? result[0] : result) as { affectedRows?: number })?.affectedRows ?? 0) > 0;

function jsonList(value: unknown): string[] {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return []; } }
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

export function slugify(text: string) {
  return text
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "anuncio";
}


// ───────────── Formato ─────────────

function toDTO(row: any, featured: boolean): PropertyDTO {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    featured,
    operation: row.operation,
    propertyType: row.propertyType,
    title: row.title,
    description: row.description,
    priceCents: Number(row.priceCents),
    depositCents: row.depositCents == null ? null : Number(row.depositCents),
    minLeaseMonths: row.minLeaseMonths ?? null,
    province: row.province,
    district: row.district,
    neighborhood: row.neighborhood ?? "",
    areaBuiltM2: row.areaBuiltM2 ?? null,
    areaLandM2: row.areaLandM2 ?? null,
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    parking: row.parking ?? null,
    floor: row.floor ?? null,
    furnished: Boolean(row.furnished),
    petsAllowed: Boolean(row.petsAllowed),
    landUse: row.landUse ?? null,
    hasTitle: Boolean(row.hasTitle),
    hasWater: Boolean(row.hasWater),
    hasPower: Boolean(row.hasPower),
    amenities: jsonList(row.amenities) as PropertyDTO["amenities"],
    advertiserType: row.advertiserType,
    contactPhone: row.showPhone ? row.contactPhone : null,
    images: jsonList(row.images),
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function toOwnDTO(row: any, featured: boolean): OwnPropertyDTO {
  return { ...toDTO(row, featured), showPhone: Boolean(row.showPhone), revision: row.revision, contactPhoneRaw: row.contactPhone };
}

function columns(input: SavePropertyInput) {
  const rooms = input.propertyType === "casa" || input.propertyType === "apartamento";
  const rent = input.operation === "alquiler";
  return {
    operation: input.operation,
    propertyType: input.propertyType,
    title: input.title,
    description: input.description,
    priceCents: input.priceCents,
    depositCents: rent ? input.depositCents : null,
    minLeaseMonths: rent ? input.minLeaseMonths : null,
    province: input.province,
    district: input.district,
    neighborhood: input.neighborhood,
    areaBuiltM2: input.propertyType === "terreno" ? null : input.areaBuiltM2,
    areaLandM2: input.areaLandM2,
    bedrooms: rooms ? input.bedrooms : null,
    bathrooms: rooms ? input.bathrooms : null,
    parking: input.parking,
    floor: input.propertyType === "apartamento" || input.propertyType === "oficina" ? input.floor : null,
    furnished: rooms && input.furnished ? 1 : 0,
    petsAllowed: rent && input.petsAllowed ? 1 : 0,
    landUse: input.propertyType === "terreno" ? input.landUse : null,
    hasTitle: input.hasTitle ? 1 : 0,
    hasWater: input.hasWater ? 1 : 0,
    hasPower: input.hasPower ? 1 : 0,
    amenities: input.propertyType === "terreno" ? [] : input.amenities,
    advertiserType: input.advertiserType,
    contactPhone: input.contactPhone,
    showPhone: input.showPhone ? 1 : 0,
  };
}

// ───────────── Anuncios del usuario ─────────────

async function ownProperty(db: any, userId: number, id: number) {
  const rows = await db.select().from(czProperties).where(and(eq(czProperties.id, id), eq(czProperties.userId, userId))).limit(1);
  if (!rows[0]) fail("NOT_FOUND", "El anuncio no existe");
  return rows[0];
}

/** Las fotos solo pueden ser las subidas para ese mismo anuncio. */
function cleanImages(id: number, images: string[]) {
  const prefix = `/media/catalog/properties/${id}/`;
  return images.filter(url => url.startsWith(prefix) && /^[A-Za-z0-9/._-]+$/.test(url)).slice(0, MAX_PROPERTY_IMAGES);
}

export async function saveProperty(user: User, raw: unknown): Promise<OwnPropertyDTO> {
  const parsed = savePropertyInput.safeParse(raw);
  if (!parsed.success) fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const input = parsed.data;
  const db = await requireDb();
  const plan = (await publishPlans(db, [user.id], "inmuebles")).get(user.id);
  if (!input.id) {
    const inserted = await db.insert(czProperties).values({ userId: user.id, slug: `tmp-${crypto.randomUUID()}`, ...columns(input), images: [] });
    const id = Number((Array.isArray(inserted) ? inserted[0] : inserted).insertId);
    await db.update(czProperties).set({ slug: `${slugify(input.title)}-${id}` }).where(eq(czProperties.id, id));
    return toOwnDTO(await ownProperty(db, user.id, id), Boolean(plan?.featured));
  }
  const current = await ownProperty(db, user.id, input.id);
  if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision)
    fail("CONFLICT", "El anuncio cambió en otra ventana. Recarga y vuelve a intentarlo.");
  const result = await db
    .update(czProperties)
    .set({ ...columns(input), images: cleanImages(input.id, input.images), slug: `${slugify(input.title)}-${input.id}`, revision: current.revision + 1 })
    .where(and(eq(czProperties.id, input.id), eq(czProperties.userId, user.id), eq(czProperties.revision, current.revision)));
  if (!changed(result)) fail("CONFLICT", "El anuncio cambió en otra ventana. Recarga y vuelve a intentarlo.");
  return toOwnDTO(await ownProperty(db, user.id, input.id), Boolean(plan?.featured));
}

export async function setPropertyStatus(user: User, id: number, status: "published" | "paused" | "closed" | "draft") {
  const db = await requireDb();
  const row = await ownProperty(db, user.id, id);
  if (status === "published") {
    // Mes gratis la primera vez, plan vigente y sin pasar el límite del plan.
    const published = await db
      .select({ n: sql<number>`count(*)` })
      .from(czProperties)
      .where(and(eq(czProperties.userId, user.id), eq(czProperties.status, "published"), ne(czProperties.id, id)));
    await assertCanPublish(db, user.id, "inmuebles", Number(published[0]?.n ?? 0));
    if (!jsonList(row.images).length) fail("PRECONDITION_FAILED", "Agrega al menos una foto antes de publicar.");
  }
  await db
    .update(czProperties)
    .set({ status, revision: row.revision + 1, ...(status === "published" && !row.publishedAt ? { publishedAt: new Date() } : {}) })
    .where(eq(czProperties.id, id));
  return { status };
}

export async function deleteProperty(user: User, id: number) {
  const db = await requireDb();
  await ownProperty(db, user.id, id);
  await db.delete(czProperties).where(and(eq(czProperties.id, id), eq(czProperties.userId, user.id)));
  return { deleted: true };
}

export async function myProperties(user: User) {
  const db = await requireDb();
  const plan = (await publishPlans(db, [user.id], "inmuebles")).get(user.id) ?? NO_PLAN;
  const rows = await db.select().from(czProperties).where(eq(czProperties.userId, user.id)).orderBy(desc(czProperties.updatedAt)).limit(200);
  return { plan, properties: rows.map((r: any) => toOwnDTO(r, plan.featured)) };
}

// ───────────── Búsqueda pública ─────────────

export async function publicProperties(filters: PropertyFilters) {
  const db = await requireDb();
  const conditions = [eq(czProperties.status, "published")];
  if (filters.operation) conditions.push(eq(czProperties.operation, filters.operation));
  if (filters.propertyType) conditions.push(eq(czProperties.propertyType, filters.propertyType));
  if (filters.province) conditions.push(eq(czProperties.province, filters.province));
  const rows = await db.select().from(czProperties).where(and(...conditions)).orderBy(desc(czProperties.publishedAt)).limit(1000);
  const plans = await publishPlans(db, [...new Set<number>(rows.map((r: any) => r.userId))], "inmuebles");
  const q = filters.q?.toLowerCase();
  const visible = rows
    // Solo anunciantes con plan activo.
    .filter((r: any) => plans.get(r.userId)?.active)
    .filter((r: any) => filters.minPriceCents === undefined || Number(r.priceCents) >= filters.minPriceCents)
    .filter((r: any) => filters.maxPriceCents === undefined || Number(r.priceCents) <= filters.maxPriceCents)
    .filter((r: any) => filters.minBedrooms === undefined || (r.bedrooms ?? 0) >= filters.minBedrooms)
    .filter((r: any) => filters.minBathrooms === undefined || (r.bathrooms ?? 0) >= filters.minBathrooms)
    .filter((r: any) => !filters.furnished || r.furnished)
    .filter((r: any) => !filters.petsAllowed || r.petsAllowed)
    .filter((r: any) => !q || `${r.title} ${r.district} ${r.neighborhood}`.toLowerCase().includes(q))
    .map((r: any) => toDTO(r, Boolean(plans.get(r.userId)?.featured)))
    // Destacados primero; luego los más recientes.
    .sort((a: PropertyDTO, b: PropertyDTO) => Number(b.featured) - Number(a.featured));
  const start = (filters.page - 1) * PAGE_SIZE;
  return { total: visible.length, page: filters.page, pageSize: PAGE_SIZE, items: visible.slice(start, start + PAGE_SIZE) };
}

export async function publicProperty(slug: string) {
  const db = await requireDb();
  const rows = await db.select().from(czProperties).where(and(eq(czProperties.slug, slug), eq(czProperties.status, "published"))).limit(1);
  const row = rows[0];
  const plan = row ? (await publishPlans(db, [row.userId], "inmuebles")).get(row.userId) : undefined;
  if (!row || !plan?.active) fail("NOT_FOUND", "Este anuncio ya no está disponible");
  return toDTO(row, plan.featured);
}

// ───────────── Fotos ─────────────

async function uploadImage(req: Request, res: Response) {
  try {
    if (req.headers["x-cz-request"] !== "1") return res.status(412).json({ error: "Falta la cabecera x-cz-request: 1" });
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Anuncio inválido" });
    const mimeType = String(req.headers["content-type"] ?? "").split(";", 1)[0]!.toLowerCase();
    validateCatalogImageBytes(req.body, mimeType);
    const db = await requireDb();
    const row = await ownProperty(db, user.id, id);
    const images = jsonList(row.images);
    if (images.length >= MAX_PROPERTY_IMAGES) return res.status(409).json({ error: `Máximo ${MAX_PROPERTY_IMAGES} fotos por anuncio` });
    const saved = await storagePut(`catalog/properties/${id}/${crypto.randomUUID()}.${IMAGE_EXT[mimeType]}`, req.body, mimeType);
    await db.update(czProperties).set({ images: [...images, saved.url], revision: row.revision + 1 }).where(eq(czProperties.id, id));
    return res.status(201).json({ url: saved.url });
  } catch (error) {
    const status = (error as { code?: string }).code === "NOT_FOUND" ? 404 : (error as { code?: string }).code === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return res.status(status).json({ error: error instanceof Error ? error.message : "No se pudo subir la foto" });
  }
}

export function registerPropertyImageRoutes(app: Express) {
  app.post("/api/properties/:id/images", express.raw({ type: () => true, limit: 5 * 1024 * 1024 }), uploadImage);
}

