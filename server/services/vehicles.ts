// Autos: mismas reglas que bienes raíces (plan activo para publicar, destacado
// con Mayor Visibilidad, los anuncios se ocultan si vence el plan).
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import express, { type Express, type Request, type Response } from "express";
import { czVehicles } from "../../drizzle/catalog-schema";
import type { User } from "../../drizzle/schema";
import {
  MAX_VEHICLE_IMAGES,
  MAX_VEHICLE_VIDEOS,
  MAX_VEHICLE_VIDEO_BYTES,
  saveVehicleInput,
  type OwnVehicleDTO,
  type SaveVehicleInput,
  type VehicleDTO,
  type VehicleFilters,
} from "@shared/vehicles";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut, storageRemove } from "../storage";
import { validateCatalogImageBytes } from "./catalogImages";
import { validateVideoBytes } from "./catalogVideos";
import { publishPlans, slugify } from "./realEstate";

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
const changed = (r: unknown) => Number(((Array.isArray(r) ? r[0] : r) as { affectedRows?: number })?.affectedRows ?? 0) > 0;
function jsonList(value: unknown): string[] {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return []; } }
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

function toDTO(row: any, featured: boolean): VehicleDTO {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    featured,
    operation: row.operation,
    vehicleType: row.vehicleType,
    make: row.make,
    otherMake: row.otherMake ?? "",
    makeName: row.make === "Otra" ? row.otherMake : row.make,
    model: row.model,
    year: row.year,
    condition: row.condition,
    mileageKm: row.mileageKm,
    transmission: row.transmission,
    fuel: row.fuel,
    color: row.color ?? "",
    engine: row.engine ?? "",
    doors: row.doors ?? null,
    title: row.title,
    description: row.description,
    priceCents: Number(row.priceCents),
    negotiable: Boolean(row.negotiable),
    titleInSellerName: Boolean(row.titleInSellerName),
    rentPeriod: row.rentPeriod ?? null,
    depositCents: row.depositCents == null ? null : Number(row.depositCents),
    minDriverAge: row.minDriverAge ?? null,
    features: jsonList(row.features) as VehicleDTO["features"],
    province: row.province,
    district: row.district,
    sellerType: row.sellerType,
    contactPhone: row.contactPhone,
    images: jsonList(row.images),
    videos: jsonList(row.videos),
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
const toOwnDTO = (row: any, featured: boolean): OwnVehicleDTO => ({ ...toDTO(row, featured), revision: row.revision });

function columns(v: SaveVehicleInput) {
  const rent = v.operation === "alquiler";
  return {
    operation: v.operation,
    vehicleType: v.vehicleType,
    make: v.make,
    otherMake: v.make === "Otra" ? v.otherMake : "",
    model: v.model,
    year: v.year,
    condition: v.condition,
    mileageKm: v.mileageKm,
    transmission: v.transmission,
    fuel: v.fuel,
    color: v.color,
    engine: v.engine,
    doors: v.vehicleType === "moto" ? null : v.doors,
    title: v.title,
    description: v.description,
    priceCents: v.priceCents,
    negotiable: !rent && v.negotiable ? 1 : 0,
    titleInSellerName: v.titleInSellerName ? 1 : 0,
    rentPeriod: rent ? v.rentPeriod : null,
    depositCents: rent ? v.depositCents : null,
    minDriverAge: rent ? v.minDriverAge : null,
    features: v.features,
    province: v.province,
    district: v.district,
    sellerType: v.sellerType,
    contactPhone: v.contactPhone,
  };
}

async function ownVehicle(db: any, userId: number, id: number) {
  const rows = await db.select().from(czVehicles).where(and(eq(czVehicles.id, id), eq(czVehicles.userId, userId))).limit(1);
  if (!rows[0]) fail("NOT_FOUND", "El anuncio no existe");
  return rows[0];
}

/** Solo videos subidos para ese mismo anuncio. */
function cleanVideos(id: number, videos: string[]) {
  const prefix = `/media/catalog/vehicles/${id}/videos/`;
  return videos.filter(url => url.startsWith(prefix) && /^[A-Za-z0-9/._-]+$/.test(url)).slice(0, MAX_VEHICLE_VIDEOS);
}

function cleanImages(id: number, images: string[]) {
  const prefix = `/media/catalog/vehicles/${id}/`;
  return images.filter(url => url.startsWith(prefix) && /^[A-Za-z0-9/._-]+$/.test(url)).slice(0, MAX_VEHICLE_IMAGES);
}

export async function saveVehicle(user: User, raw: unknown): Promise<OwnVehicleDTO> {
  const parsed = saveVehicleInput.safeParse(raw);
  if (!parsed.success) fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const input = parsed.data;
  const db = await requireDb();
  const plan = (await publishPlans(db, [user.id])).get(user.id);
  if (!input.id) {
    const inserted = await db.insert(czVehicles).values({ userId: user.id, slug: `tmp-${crypto.randomUUID()}`, ...columns(input), images: [], videos: [] });
    const id = Number((Array.isArray(inserted) ? inserted[0] : inserted).insertId);
    await db.update(czVehicles).set({ slug: `${slugify(input.title)}-${id}` }).where(eq(czVehicles.id, id));
    return toOwnDTO(await ownVehicle(db, user.id, id), Boolean(plan?.featured));
  }
  const current = await ownVehicle(db, user.id, input.id);
  if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision)
    fail("CONFLICT", "El anuncio cambió en otra ventana. Recarga y vuelve a intentarlo.");
  const result = await db
    .update(czVehicles)
    .set({ ...columns(input), images: cleanImages(input.id, input.images), videos: cleanVideos(input.id, input.videos), slug: `${slugify(input.title)}-${input.id}`, revision: current.revision + 1 })
    .where(and(eq(czVehicles.id, input.id), eq(czVehicles.userId, user.id), eq(czVehicles.revision, current.revision)));
  if (!changed(result)) fail("CONFLICT", "El anuncio cambió en otra ventana. Recarga y vuelve a intentarlo.");
  return toOwnDTO(await ownVehicle(db, user.id, input.id), Boolean(plan?.featured));
}

export async function setVehicleStatus(user: User, id: number, status: "published" | "paused" | "closed" | "draft") {
  const db = await requireDb();
  const row = await ownVehicle(db, user.id, id);
  if (status === "published") {
    const plan = (await publishPlans(db, [user.id])).get(user.id);
    if (!plan?.active)
      fail("PRECONDITION_FAILED", "Para publicar necesitas un plan activo (Normal o Mayor Visibilidad). Escríbenos para activarlo.");
    if (!jsonList(row.images).length) fail("PRECONDITION_FAILED", "Agrega al menos una foto antes de publicar.");
  }
  await db
    .update(czVehicles)
    .set({ status, revision: row.revision + 1, ...(status === "published" && !row.publishedAt ? { publishedAt: new Date() } : {}) })
    .where(eq(czVehicles.id, id));
  return { status };
}

export async function deleteVehicle(user: User, id: number) {
  const db = await requireDb();
  await ownVehicle(db, user.id, id);
  await db.delete(czVehicles).where(and(eq(czVehicles.id, id), eq(czVehicles.userId, user.id)));
  // Fotos y videos del anuncio: se borran del disco.
  await storageRemove(`catalog/vehicles/${id}`).catch(error => console.error("[Autos] No se pudieron borrar los archivos:", error));
  return { deleted: true };
}

export async function myVehicles(user: User) {
  const db = await requireDb();
  const plan = (await publishPlans(db, [user.id])).get(user.id) ?? { active: false, featured: false, source: null, planId: null, endsAt: null };
  const rows = await db.select().from(czVehicles).where(eq(czVehicles.userId, user.id)).orderBy(desc(czVehicles.updatedAt)).limit(200);
  return { plan, vehicles: rows.map((r: any) => toOwnDTO(r, plan.featured)) };
}

export async function publicVehicles(filters: VehicleFilters) {
  const db = await requireDb();
  const conditions = [eq(czVehicles.status, "published")];
  if (filters.operation) conditions.push(eq(czVehicles.operation, filters.operation));
  if (filters.vehicleType) conditions.push(eq(czVehicles.vehicleType, filters.vehicleType));
  if (filters.province) conditions.push(eq(czVehicles.province, filters.province));
  if (filters.transmission) conditions.push(eq(czVehicles.transmission, filters.transmission));
  if (filters.fuel) conditions.push(eq(czVehicles.fuel, filters.fuel));
  if (filters.condition) conditions.push(eq(czVehicles.condition, filters.condition));
  const rows = await db.select().from(czVehicles).where(and(...conditions)).orderBy(desc(czVehicles.publishedAt)).limit(1000);
  const plans = await publishPlans(db, [...new Set<number>(rows.map((r: any) => r.userId))]);
  const q = filters.q?.toLowerCase();
  const make = filters.make?.toLowerCase();
  const visible = rows
    .filter((r: any) => plans.get(r.userId)?.active)
    .filter((r: any) => !make || (r.make === "Otra" ? r.otherMake : r.make).toLowerCase() === make)
    .filter((r: any) => filters.minYear === undefined || r.year >= filters.minYear)
    .filter((r: any) => filters.maxYear === undefined || r.year <= filters.maxYear)
    .filter((r: any) => filters.minPriceCents === undefined || Number(r.priceCents) >= filters.minPriceCents)
    .filter((r: any) => filters.maxPriceCents === undefined || Number(r.priceCents) <= filters.maxPriceCents)
    .filter((r: any) => filters.maxMileageKm === undefined || r.mileageKm <= filters.maxMileageKm)
    .filter((r: any) => !q || `${r.title} ${r.make} ${r.otherMake} ${r.model} ${r.district}`.toLowerCase().includes(q))
    .map((r: any) => toDTO(r, Boolean(plans.get(r.userId)?.featured)))
    .sort((a: VehicleDTO, b: VehicleDTO) => Number(b.featured) - Number(a.featured));
  const start = (filters.page - 1) * PAGE_SIZE;
  return { total: visible.length, page: filters.page, pageSize: PAGE_SIZE, items: visible.slice(start, start + PAGE_SIZE) };
}

export async function publicVehicle(slug: string) {
  const db = await requireDb();
  const rows = await db.select().from(czVehicles).where(and(eq(czVehicles.slug, slug), eq(czVehicles.status, "published"))).limit(1);
  const row = rows[0];
  const plan = row ? (await publishPlans(db, [row.userId])).get(row.userId) : undefined;
  if (!row || !plan?.active) fail("NOT_FOUND", "Este anuncio ya no está disponible");
  return toDTO(row, plan.featured);
}

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
    const row = await ownVehicle(db, user.id, id);
    const images = jsonList(row.images);
    if (images.length >= MAX_VEHICLE_IMAGES) return res.status(409).json({ error: `Máximo ${MAX_VEHICLE_IMAGES} fotos por anuncio` });
    const saved = await storagePut(`catalog/vehicles/${id}/${crypto.randomUUID()}.${IMAGE_EXT[mimeType]}`, req.body, mimeType);
    await db.update(czVehicles).set({ images: [...images, saved.url], revision: row.revision + 1 }).where(eq(czVehicles.id, id));
    return res.status(201).json({ url: saved.url });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return res.status(code === "NOT_FOUND" ? 404 : code === "PAYLOAD_TOO_LARGE" ? 413 : 400).json({ error: error instanceof Error ? error.message : "No se pudo subir la foto" });
  }
}

const VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

async function uploadVideo(req: Request, res: Response) {
  try {
    if (req.headers["x-cz-request"] !== "1") return res.status(412).json({ error: "Falta la cabecera x-cz-request: 1" });
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Anuncio inválido" });
    const mimeType = String(req.headers["content-type"] ?? "").split(";", 1)[0]!.toLowerCase();
    if (!VIDEO_EXT[mimeType]) return res.status(415).json({ error: "Solo se aceptan videos MP4, WEBM o MOV" });
    validateVideoBytes(req.body, mimeType);
    const db = await requireDb();
    const row = await ownVehicle(db, user.id, id);
    const videos = jsonList(row.videos);
    if (videos.length >= MAX_VEHICLE_VIDEOS) return res.status(409).json({ error: `Máximo ${MAX_VEHICLE_VIDEOS} videos por anuncio` });
    const saved = await storagePut(`catalog/vehicles/${id}/videos/${crypto.randomUUID()}.${VIDEO_EXT[mimeType]}`, req.body, mimeType);
    await db.update(czVehicles).set({ videos: [...videos, saved.url], revision: row.revision + 1 }).where(eq(czVehicles.id, id));
    return res.status(201).json({ url: saved.url });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const status = code === "NOT_FOUND" ? 404 : code === "PAYLOAD_TOO_LARGE" ? 413 : code === "UNSUPPORTED_MEDIA_TYPE" ? 415 : 400;
    return res.status(status).json({ error: error instanceof Error ? error.message : "No se pudo subir el video" });
  }
}

export function registerVehicleImageRoutes(app: Express) {
  app.post("/api/vehicles/:id/images", express.raw({ type: () => true, limit: 5 * 1024 * 1024 }), uploadImage);
  app.post(
    "/api/vehicles/:id/videos",
    (req, res, next) =>
      express.raw({ type: () => true, limit: MAX_VEHICLE_VIDEO_BYTES })(req, res, error => (error ? res.status(413).json({ error: "El video supera el límite de 40 MB" }) : next())),
    uploadVideo
  );
}
