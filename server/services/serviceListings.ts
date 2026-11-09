// Servicios de las tiendas de tipo «servicios»: sin envíos, inventario ni carrito.
// Se publican si la solicitud está aprobada con plan activo y el correo verificado,
// igual que los productos de comercio. El cliente los solicita y el proveedor lo
// contacta; no hay comisión.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import express, { type Express, type Request, type Response } from "express";
import {
  czServiceRequests,
  czServices,
  czStores,
} from "../../drizzle/catalog-schema";
import {
  czApplications,
  czMembershipProfiles,
  type User,
} from "../../drizzle/schema";
import {
  getBusinessCategory,
  getBusinessSpecialty,
} from "@shared/businessCategories";
import {
  MAX_SERVICE_IMAGES,
  saveServiceInput,
  serviceRequestInput,
  type OwnServiceDTO,
  type RequestStatus,
  type ServiceDTO,
  type ServiceFilters,
  type ServiceStatus,
} from "@shared/services";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { validateCatalogImageBytes } from "./catalogImages";
import { queueEmail, recipientFor } from "./email";
import { slugify } from "./realEstate";
import { FEATURED_PLAN_ID, pickFeatured } from "@shared/featured";

const PAGE_SIZE = 24;
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
const changed = (r: unknown) =>
  Number(
    ((Array.isArray(r) ? r[0] : r) as { affectedRows?: number })
      ?.affectedRows ?? 0
  ) > 0;
function list<T = string>(value: unknown): T[] {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Tienda de servicios del usuario (con su solicitud). */
async function serviceStore(db: any, userId: number) {
  const rows = await db
    .select({ store: czStores, app: czApplications })
    .from(czStores)
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(eq(czStores.userId, userId))
    .limit(1);
  return rows[0] as { store: any; app: any } | undefined;
}

async function requireServiceStore(db: any, userId: number) {
  const found = await serviceStore(db, userId);
  if (!found)
    fail("PRECONDITION_FAILED", "Primero guarda la información de tu tienda");
  if (found.store.storeKind !== "servicios")
    fail(
      "PRECONDITION_FAILED",
      "Tu tienda es de comercio: publica productos, no servicios"
    );
  return found;
}

function dto(row: any, store: any, phone: string | null): ServiceDTO {
  const category = getBusinessCategory(row.categoryId);
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: row.title,
    description: row.description,
    serviceType: row.serviceType,
    categoryId: row.categoryId,
    specialtyId: row.specialtyId ?? null,
    categoryLabel: category?.label ?? row.categoryId,
    specialtyLabel: row.specialtyId
      ? (getBusinessSpecialty(row.specialtyId)?.label ?? null)
      : null,
    priceType: row.priceType,
    priceCents: row.priceCents ?? null,
    durationMinutes: row.durationMinutes ?? null,
    modalities: list(row.modalities),
    coverageProvinces: list(row.coverageProvinces),
    schedule: row.schedule ?? "",
    images: list(row.images),
    bookable: Boolean(row.bookable),
    store: {
      name: store.name,
      slug: store.slug,
      province: store.province,
      city: store.city,
      phone,
    },
    publishedAt: row.publishedAt
      ? new Date(row.publishedAt).toISOString()
      : null,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function cleanImages(id: number, images: string[]) {
  const prefix = `/media/catalog/services/${id}/`;
  return images
    .filter(u => u.startsWith(prefix) && /^[A-Za-z0-9/._-]+$/.test(u))
    .slice(0, MAX_SERVICE_IMAGES);
}

function columns(v: ReturnType<typeof saveServiceInput.parse>) {
  return {
    title: v.title,
    description: v.description,
    serviceType: v.serviceType,
    categoryId: v.categoryId,
    specialtyId: v.specialtyId,
    priceType: v.priceType,
    priceCents: v.priceType === "cotizar" ? null : v.priceCents,
    durationMinutes: v.durationMinutes,
    modalities: v.modalities,
    // Las provincias solo aplican cuando va a domicilio.
    coverageProvinces: v.modalities.includes("a_domicilio")
      ? v.coverageProvinces
      : [],
    schedule: v.schedule,
  };
}

async function ownService(db: any, userId: number, id: number) {
  const rows = await db
    .select()
    .from(czServices)
    .where(and(eq(czServices.id, id), eq(czServices.userId, userId)))
    .limit(1);
  if (!rows[0]) fail("NOT_FOUND", "El servicio no existe");
  return rows[0];
}

export async function saveService(user: User, raw: unknown) {
  const parsed = saveServiceInput.safeParse(raw);
  if (!parsed.success)
    fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const v = parsed.data;
  const db = await requireDb();
  const { store, app } = await requireServiceStore(db, user.id);
  if (!v.id) {
    // Si la tienda ya puede publicar, el servicio nuevo sale publicado: antes
    // quedaba en borrador y muchos vendedores no veían el segundo botón «Publicar».
    const canPublish =
      app.status === "approved" && app.subscriptionStatus === "active";
    const inserted = await db.insert(czServices).values({
      storeId: store.id,
      userId: user.id,
      slug: `tmp-${crypto.randomUUID()}`,
      ...columns(v),
      images: [],
      ...(canPublish
        ? { status: "published" as const, publishedAt: new Date() }
        : {}),
    });
    const id = Number(
      (Array.isArray(inserted) ? inserted[0] : inserted).insertId
    );
    await db
      .update(czServices)
      .set({ slug: `${slugify(v.title)}-${id}` })
      .where(eq(czServices.id, id));
    return { id, published: canPublish };
  }
  const current = await ownService(db, user.id, v.id);
  if (
    v.expectedRevision !== undefined &&
    v.expectedRevision !== current.revision
  )
    fail(
      "CONFLICT",
      "El servicio cambió en otra ventana. Recarga y vuelve a intentarlo."
    );
  const result = await db
    .update(czServices)
    .set({
      ...columns(v),
      images: cleanImages(v.id, v.images),
      slug: `${slugify(v.title)}-${v.id}`,
      revision: current.revision + 1,
    })
    .where(
      and(
        eq(czServices.id, v.id),
        eq(czServices.userId, user.id),
        eq(czServices.revision, current.revision)
      )
    );
  if (!changed(result))
    fail(
      "CONFLICT",
      "El servicio cambió en otra ventana. Recarga y vuelve a intentarlo."
    );
  return { id: v.id };
}

export async function setServiceStatus(
  user: User,
  id: number,
  status: ServiceStatus
) {
  const db = await requireDb();
  const row = await ownService(db, user.id, id);
  if (status === "published") {
    const { app } = await requireServiceStore(db, user.id);
    if (app.status !== "approved")
      fail("PRECONDITION_FAILED", "Tu tienda todavía no está aprobada");
    if (app.subscriptionStatus !== "active")
      fail(
        "PRECONDITION_FAILED",
        "Tu plan no está activo. Renuévalo para publicar."
      );
  }
  await db
    .update(czServices)
    .set({
      status,
      revision: row.revision + 1,
      ...(status === "published" && !row.publishedAt
        ? { publishedAt: new Date() }
        : {}),
    })
    .where(eq(czServices.id, id));
  return { status };
}

export async function deleteService(user: User, id: number) {
  const db = await requireDb();
  await ownService(db, user.id, id);
  await db
    .delete(czServices)
    .where(and(eq(czServices.id, id), eq(czServices.userId, user.id)));
  return { deleted: true };
}

export async function myServices(user: User) {
  const db = await requireDb();
  const found = await serviceStore(db, user.id);
  if (!found) return { services: [] as OwnServiceDTO[] };
  const rows = await db
    .select()
    .from(czServices)
    .where(eq(czServices.userId, user.id))
    .orderBy(desc(czServices.updatedAt))
    .limit(200);
  const ids = rows.map((r: any) => r.id);
  const counts = ids.length
    ? await db
        .select({
          serviceId: czServiceRequests.serviceId,
          fresh: sql<number>`sum(${czServiceRequests.status} = 'nueva')`,
        })
        .from(czServiceRequests)
        .where(inArray(czServiceRequests.serviceId, ids))
        .groupBy(czServiceRequests.serviceId)
    : [];
  const fresh = new Map(
    counts.map((c: any) => [c.serviceId, Number(c.fresh ?? 0)])
  );
  return {
    services: rows.map(
      (r: any): OwnServiceDTO => ({
        ...dto(r, found.store, found.app.contactPhone ?? null),
        revision: r.revision,
        newRequests: fresh.get(r.id) ?? 0,
      })
    ),
  };
}

/** Condiciones para que un servicio sea público. */
function publicConditions() {
  return [
    eq(czServices.status, "published"),
    eq(czStores.storeKind, "servicios"),
    eq(czApplications.status, "approved"),
    eq(czApplications.subscriptionStatus, "active"),
    isNotNull(czMembershipProfiles.emailVerifiedAt),
  ];
}

function publicQuery(db: any) {
  return db
    .select({
      service: czServices,
      store: czStores,
      phone: czApplications.contactPhone,
      planId: czApplications.subscriptionPlanId,
    })
    .from(czServices)
    .innerJoin(czStores, eq(czStores.id, czServices.storeId))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    );
}

export async function publicServices(filters: ServiceFilters) {
  const db = await requireDb();
  const conditions: any[] = publicConditions();
  if (filters.serviceType)
    conditions.push(eq(czServices.serviceType, filters.serviceType));
  if (filters.categoryId)
    conditions.push(eq(czServices.categoryId, filters.categoryId));
  const rows = await publicQuery(db)
    .where(and(...conditions))
    .orderBy(desc(czServices.publishedAt))
    .limit(1000);
  const q = filters.q?.toLowerCase();
  const featuredIds = new Set(
    rows.filter((r: any) => r.planId === FEATURED_PLAN_ID).map((r: any) => r.service.id)
  );
  const visible = rows
    .map((r: any) => dto(r.service, r.store, r.phone))
    .filter(
      (s: ServiceDTO) =>
        !filters.modality || s.modalities.includes(filters.modality)
    )
    // Por provincia: va a domicilio a esa provincia, o su local está ahí, o es en línea.
    .filter(
      (s: ServiceDTO) =>
        !filters.province ||
        s.modalities.includes("en_linea") ||
        (s.modalities.includes("a_domicilio") &&
          s.coverageProvinces.includes(filters.province)) ||
        (s.modalities.includes("en_local") &&
          s.store.province === filters.province)
    )
    .filter(
      (s: ServiceDTO) =>
        !q ||
        `${s.title} ${s.description} ${s.categoryLabel} ${s.specialtyLabel ?? ""} ${s.store.name}`
          .toLowerCase()
          .includes(q)
    );
  const start = (filters.page - 1) * PAGE_SIZE;
  return {
    total: visible.length,
    page: filters.page,
    pageSize: PAGE_SIZE,
    items: visible.slice(start, start + PAGE_SIZE),
    /** Mayor Visibilidad: franja superior con los que cumplen los filtros. */
    featured: pickFeatured(
      visible.filter((s: ServiceDTO) => featuredIds.has(s.id)),
      (s: ServiceDTO) => s.store.slug
    ) as ServiceDTO[],
  };
}

export async function publicService(slug: string) {
  const db = await requireDb();
  const rows = await publicQuery(db)
    .where(and(eq(czServices.slug, slug), ...publicConditions()))
    .limit(1);
  if (!rows[0]) fail("NOT_FOUND", "Este servicio ya no está disponible");
  return dto(rows[0].service, rows[0].store, rows[0].phone);
}

// ───────────── Solicitudes ─────────────

export async function requestService(user: User, raw: unknown) {
  const parsed = serviceRequestInput.safeParse(raw);
  if (!parsed.success)
    fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const v = parsed.data;
  const db = await requireDb();
  const rows = await publicQuery(db)
    .where(and(eq(czServices.id, v.serviceId), ...publicConditions()))
    .limit(1);
  const found = rows[0];
  if (!found) fail("NOT_FOUND", "Este servicio ya no recibe solicitudes");
  if (found.service.userId === user.id)
    fail("BAD_REQUEST", "No puedes solicitar tu propio servicio");
  // Evita repetir la misma solicitud muchas veces seguidas.
  const recent = await db
    .select({ n: sql<number>`count(*)` })
    .from(czServiceRequests)
    .where(
      and(
        eq(czServiceRequests.serviceId, v.serviceId),
        eq(czServiceRequests.requesterUserId, user.id),
        sql`${czServiceRequests.createdAt} > NOW() - INTERVAL 1 DAY`
      )
    );
  if (Number(recent[0]?.n ?? 0) >= 3)
    fail(
      "TOO_MANY_REQUESTS",
      "Ya enviaste varias solicitudes a este servicio hoy. Espera la respuesta del proveedor."
    );
  await db
    .insert(czServiceRequests)
    .values({
      serviceId: v.serviceId,
      requesterUserId: user.id,
      name: v.name,
      phone: v.phone,
      message: v.message,
      preferredDate: v.preferredDate,
      province: v.province,
    });
  await queueEmail(
    db,
    `service-request:${v.serviceId}:${user.id}:${Date.now()}`,
    await recipientFor(db, found.service.userId),
    {
      subject: `Nueva solicitud: ${found.service.title}`,
      title: "Alguien solicitó tu servicio",
      paragraphs: [
        `${v.name} (${v.phone}, ${v.province}) quiere «${found.service.title}».`,
        `Mensaje: «${v.message}»${v.preferredDate ? ` · Fecha preferida: ${v.preferredDate}` : ""}`,
        "Contáctalo pronto por WhatsApp o llamada para coordinar.",
      ],
      cta: { label: "Ver mis solicitudes", path: "/vendedor/tienda" },
    }
  );
  return { ok: true };
}

export async function myServiceRequests(user: User) {
  const db = await requireDb();
  const rows = await db
    .select({ request: czServiceRequests, title: czServices.title })
    .from(czServiceRequests)
    .innerJoin(czServices, eq(czServices.id, czServiceRequests.serviceId))
    .where(eq(czServices.userId, user.id))
    .orderBy(desc(czServiceRequests.createdAt))
    .limit(300);
  return rows.map((r: any) => ({
    id: r.request.id,
    serviceTitle: r.title,
    name: r.request.name,
    phone: r.request.phone,
    message: r.request.message,
    preferredDate: r.request.preferredDate,
    province: r.request.province,
    status: r.request.status as RequestStatus,
    createdAt: new Date(r.request.createdAt).toISOString(),
  }));
}

export async function setRequestStatus(
  user: User,
  id: number,
  status: RequestStatus
) {
  const db = await requireDb();
  const rows = await db
    .select({ id: czServiceRequests.id })
    .from(czServiceRequests)
    .innerJoin(czServices, eq(czServices.id, czServiceRequests.serviceId))
    .where(and(eq(czServiceRequests.id, id), eq(czServices.userId, user.id)))
    .limit(1);
  if (!rows[0]) fail("NOT_FOUND", "La solicitud no existe");
  await db
    .update(czServiceRequests)
    .set({ status })
    .where(eq(czServiceRequests.id, id));
  return { status };
}

// ───────────── Fotos ─────────────

async function uploadImage(req: Request, res: Response) {
  try {
    if (req.headers["x-cz-request"] !== "1")
      return res
        .status(412)
        .json({ error: "Falta la cabecera x-cz-request: 1" });
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0)
      return res.status(400).json({ error: "Servicio inválido" });
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]!
      .toLowerCase();
    validateCatalogImageBytes(req.body, mimeType);
    const db = await requireDb();
    const row = await ownService(db, user.id, id);
    const images = list<string>(row.images);
    if (images.length >= MAX_SERVICE_IMAGES)
      return res
        .status(409)
        .json({ error: `Máximo ${MAX_SERVICE_IMAGES} fotos por servicio` });
    const saved = await storagePut(
      `catalog/services/${id}/${crypto.randomUUID()}.${IMAGE_EXT[mimeType]}`,
      req.body,
      mimeType
    );
    await db
      .update(czServices)
      .set({ images: [...images, saved.url], revision: row.revision + 1 })
      .where(eq(czServices.id, id));
    return res.status(201).json({ url: saved.url });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return res
      .status(
        code === "NOT_FOUND" ? 404 : code === "PAYLOAD_TOO_LARGE" ? 413 : 400
      )
      .json({
        error:
          error instanceof Error ? error.message : "No se pudo subir la foto",
      });
  }
}

export function registerServiceImageRoutes(app: Express) {
  app.post(
    "/api/services/:id/images",
    express.raw({ type: () => true, limit: 5 * 1024 * 1024 }),
    uploadImage
  );
}

/** Cambiar el tipo de tienda solo mientras no tenga publicaciones. */
export async function changeStoreKind(
  user: User,
  kind: "comercio" | "servicios",
  countProducts: (db: any, storeId: number) => Promise<number>
) {
  const db = await requireDb();
  const found = await serviceStore(db, user.id);
  if (!found)
    fail("PRECONDITION_FAILED", "Primero guarda la información de tu tienda");
  if (found.store.storeKind === kind) return { storeKind: kind };
  const services = await db
    .select({ n: sql<number>`count(*)` })
    .from(czServices)
    .where(eq(czServices.storeId, found.store.id));
  if (
    Number(services[0]?.n ?? 0) > 0 ||
    (await countProducts(db, found.store.id)) > 0
  )
    fail(
      "PRECONDITION_FAILED",
      "Para cambiar el tipo de tienda primero borra tus publicaciones actuales"
    );
  await db.transaction(async (tx: any) => {
    await tx
      .update(czStores)
      .set({
        storeKind: kind,
        ...(kind === "servicios"
          ? {
              shippingFeesByProvince: null,
              deliveryProvinces: [],
              shippingFeeCents: null,
              homeFeeCents: null,
            }
          : {}),
      })
      .where(eq(czStores.id, found.store.id));
    await tx
      .update(czApplications)
      .set({ storeKind: kind })
      .where(eq(czApplications.id, found.app.id));
  });
  return { storeKind: kind };
}
