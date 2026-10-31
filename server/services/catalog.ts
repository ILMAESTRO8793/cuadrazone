import {
  readBusinessSelections,
  type BusinessSelection,
} from "@shared/businessCategories";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  gt,
  inArray,
  isNotNull,
  like,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  bookInput,
  catalogCategories,
  listPublicInput,
  saveStoreInput,
  readFeeMap,
  type BookMetadata,
  type DeliveryMode,
  type ListPublicInput,
  type OwnerProduct,
  type ProductKind,
  type ProductStatus,
  type PublicProduct,
  type PublicStore,
  type PublicVariant,
  type SaveProductInput,
  type SaveStoreInput,
  type VariantInput,
} from "@shared/marketplace";
import {
  czProductImages,
  czProducts,
  czStores,
  czVariants,
  type Product,
  type Store,
  type Variant,
} from "../../drizzle/catalog-schema";
import {
  czApplications,
  czMembershipProfiles,
  users,
  type Application,
  type MembershipProfile,
} from "../../drizzle/schema";
import {
  czOrderItems,
  czOrders,
  czReviews,
} from "../../drizzle/commerce-schema";
import { getDb } from "../db";

export class CatalogError extends Error {
  constructor(
    public code: TRPCError["code"],
    message: string
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

export function toCatalogTRPCError(error: unknown): TRPCError {
  if (error instanceof CatalogError)
    return new TRPCError({ code: error.code, message: error.message });
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "No se pudo completar la operación de catálogo",
  });
}

function requireSafeId(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0)
    throw new CatalogError("BAD_REQUEST", `${label} inválido`);
  return Number(value);
}

function updateChanged(result: unknown): boolean {
  const value = result as
    | { affectedRows?: number }
    | [{ affectedRows?: number }];
  const affectedRows = Array.isArray(value)
    ? value[0]?.affectedRows
    : value?.affectedRows;
  return typeof affectedRows === "number" && affectedRows >= 1;
}

function insertId(result: unknown): number {
  const value = Array.isArray(result) ? result[0] : result;
  const id =
    (value as { id?: unknown; insertId?: unknown } | undefined)?.id ??
    (value as { insertId?: unknown } | undefined)?.insertId;
  return requireSafeId(id, "ID creado");
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 130);
  return slug || "catalogo";
}

function iso(value: Date): string {
  return value.toISOString();
}
function jsonArray<T>(value: unknown, fallback: T[]): T[] {
  // MySQL 8 entrega las columnas JSON como arreglo; MariaDB y otros, como texto.
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return fallback; }
  }
  return Array.isArray(value) ? (value as T[]) : fallback;
}
/** Valor de una columna JSON, venga como objeto (MySQL 8) o como texto (MariaDB). */
function jsonColumn(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}
function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new CatalogError(
      "INTERNAL_SERVER_ERROR",
      "La base de datos no está disponible"
    );
  return db;
}

async function storeFor(tx: any, storeId: number) {
  const rows = await tx
    .select()
    .from(czStores)
    .where(eq(czStores.id, storeId))
    .limit(1);
  return rows[0] as Store | undefined;
}

async function sellerReadiness(tx: any, userId: number) {
  const [profileRows, appRows] = await Promise.all([
    tx
      .select()
      .from(czMembershipProfiles)
      .where(eq(czMembershipProfiles.userId, userId))
      .limit(1),
    tx
      .select()
      .from(czApplications)
      .where(eq(czApplications.userId, userId))
      .limit(1),
  ]);
  const profile = profileRows[0] as MembershipProfile | undefined;
  const application = appRows[0] as Application | undefined;
  const contactsVerified = Boolean(
    profile?.emailVerifiedAt &&
      profile.phoneVerifiedAt &&
      application &&
      application.contactEmail === profile.email &&
      application.contactPhone === profile.phone
  );
  const active = Boolean(
    application?.status === "approved" &&
      application.subscriptionStatus === "active" &&
      contactsVerified
  );
  let blockingReason: string | null = null;
  if (!profile)
    blockingReason = "Guarda tu perfil antes de preparar una tienda";
  else if (!application)
    blockingReason =
      "Crea una solicitud de vendedor antes de preparar una tienda";
  else if (!contactsVerified)
    blockingReason =
      "Correo y teléfono deben estar verificados y coincidir con la solicitud";
  else if (application.status !== "approved")
    blockingReason = "La solicitud de vendedor aún no está aprobada";
  else if (application.subscriptionStatus !== "active")
    blockingReason = "La suscripción del vendedor no está activa";
  return { profile, application, contactsVerified, active, blockingReason };
}

export async function assertSellerOwner(
  tx: any,
  userId: number,
  storeId: number
): Promise<void> {
  requireSafeId(userId, "Usuario");
  requireSafeId(storeId, "Tienda");
  const rows = await tx
    .select({ id: czStores.id })
    .from(czStores)
    .where(and(eq(czStores.id, storeId), eq(czStores.userId, userId)))
    .limit(1);
  if (!rows.length)
    throw new CatalogError("FORBIDDEN", "No eres propietario de esta tienda");
}

/** Dispatch may use this guard for old orders without requiring a current subscription. */
export async function assertActiveStore(
  tx: any,
  storeId: number
): Promise<void> {
  const store = await storeFor(tx, storeId);
  if (!store) throw new CatalogError("NOT_FOUND", "Tienda no encontrada");
  const readiness = await sellerReadiness(tx, store.userId);
  if (!readiness.active)
    throw new CatalogError("FORBIDDEN", "La tienda no está activa");
}

function publicStore(row: Store & { churchName: string }): PublicStore {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    province: row.province,
    city: row.city,
    churchName: row.churchName,
    verified: true,
    shippingFeeCents: row.shippingFeeCents ?? null,
    homeFeeCents: row.homeFeeCents ?? null,
    deliveryProvinces: jsonArray<string>(row.deliveryProvinces, []),
    shippingFeesByProvince: readFeeMap(row.shippingFeesByProvince),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function publicVariant(row: Variant): PublicVariant {
  return {
    id: row.id,
    sku: row.sku,
    size: row.size,
    color: row.color,
    stock: Math.max(0, row.stock),
    priceCents: row.priceCents,
  };
}

type ProductStats = { rating: number; reviewCount: number; soldCount: number };

const ratingAggregate = () =>
  sql<number>`coalesce((select avg(${czReviews.rating}) from ${czReviews} where ${czReviews.productId} = ${czProducts.id}), 0)`;
const reviewCountAggregate = () =>
  sql<number>`(select count(*) from ${czReviews} where ${czReviews.productId} = ${czProducts.id})`;
const soldCountAggregate = () =>
  sql<number>`coalesce((select sum(${czOrderItems.quantity}) from ${czOrderItems} inner join ${czOrders} on ${czOrders.id} = ${czOrderItems.orderId} where ${czOrderItems.productId} = ${czProducts.id} and ${czOrders.status} = 'delivered'), 0)`;

function statsFromRow(row: {
  rating?: unknown;
  reviewCount?: unknown;
  soldCount?: unknown;
}): ProductStats {
  return {
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.reviewCount ?? 0),
    soldCount: Number(row.soldCount ?? 0),
  };
}

function productDto(
  row: Product,
  variants: Variant[],
  store: Store & { churchName: string },
  stats: ProductStats = { rating: 0, reviewCount: 0, soldCount: 0 }
): PublicProduct {
  const images = jsonArray<string>(row.imageUrls, []);
  const modes = jsonArray<DeliveryMode>(row.deliveryModes, []);
  const bookValue = jsonColumn(row.bookMetadata);
  const book =
    bookValue && typeof bookValue === "object" && !Array.isArray(bookValue)
      ? (bookValue as BookMetadata)
      : null;
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind as ProductKind,
    title: row.title,
    description: row.description,
    category: row.category,
    priceCents: row.priceCents,
    images,
    deliveryModes: modes,
    book,
    variants: variants.filter(v => v.active === 1).map(publicVariant),
    store: publicStore(store),
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    soldCount: stats.soldCount,
    createdAt: iso(row.createdAt),
    revision: row.revision,
  };
}

function ownerProductDto(
  row: Product,
  variants: Variant[],
  store: Store & { churchName: string },
  verified: boolean,
  stats?: ProductStats
): OwnerProduct {
  const dto = productDto(row, variants, store, stats);
  return {
    ...dto,
    store: {
      id: dto.store.id,
      slug: dto.store.slug,
      name: dto.store.name,
      description: dto.store.description,
      province: dto.store.province,
      city: dto.store.city,
      shippingFeeCents: dto.store.shippingFeeCents,
      homeFeeCents: dto.store.homeFeeCents,
      deliveryProvinces: dto.store.deliveryProvinces,
      shippingFeesByProvince: dto.store.shippingFeesByProvince,
      yappyPhone: store.yappyPhone ?? null,
      yappyDirectory: store.yappyDirectory ?? null,
      cardPaymentUrl: store.cardPaymentUrl ?? null,
      cardOnDelivery: Boolean(store.cardOnDelivery),
      verified,
    },
    status: row.status as ProductStatus,
  };
}

async function joinedStore(tx: any, storeId: number, includeInactive = false) {
  const rows = await tx
    .select({
      store: czStores,
      churchName: czApplications.churchName,
      appStatus: czApplications.status,
      subscriptionStatus: czApplications.subscriptionStatus,
    })
    .from(czStores)
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    )
    .where(
      and(
        eq(czStores.id, storeId),
        ...(includeInactive
          ? []
          : [
              eq(czApplications.status, "approved"),
              eq(czApplications.subscriptionStatus, "active"),
              isNotNull(czMembershipProfiles.emailVerifiedAt),
              isNotNull(czMembershipProfiles.phoneVerifiedAt),
              eq(czApplications.contactEmail, czMembershipProfiles.email),
              eq(czApplications.contactPhone, czMembershipProfiles.phone),
            ])
      )
    )
    .limit(1);
  const row = rows[0];
  return row
    ? { ...(row.store as Store), churchName: row.churchName as string }
    : undefined;
}

async function variantsFor(
  tx: any,
  productIds: number[]
): Promise<Map<number, Variant[]>> {
  if (!productIds.length) return new Map();
  const rows = await tx
    .select()
    .from(czVariants)
    .where(inArray(czVariants.productId, productIds));
  const result = new Map<number, Variant[]>();
  for (const row of rows as Variant[]) {
    const current = result.get(row.productId) ?? [];
    current.push(row);
    result.set(row.productId, current);
  }
  return result;
}

async function publicProductBySlug(
  tx: any,
  slug: string
): Promise<PublicProduct | null> {
  const rows = await tx
    .select({
      product: czProducts,
      store: czStores,
      churchName: czApplications.churchName,
      rating: ratingAggregate(),
      reviewCount: reviewCountAggregate(),
      soldCount: soldCountAggregate(),
    })
    .from(czProducts)
    .innerJoin(czStores, eq(czProducts.storeId, czStores.id))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    )
    .where(
      and(
        eq(czProducts.slug, slug),
        eq(czProducts.status, "published"),
        eq(czApplications.status, "approved"),
        eq(czApplications.subscriptionStatus, "active"),
        isNotNull(czMembershipProfiles.emailVerifiedAt),
        isNotNull(czMembershipProfiles.phoneVerifiedAt),
        eq(czApplications.contactEmail, czMembershipProfiles.email),
        eq(czApplications.contactPhone, czMembershipProfiles.phone)
      )
    )
    .limit(1);
  const found = rows[0];
  if (!found) return null;
  const product = found.product as Product;
  const variants = await variantsFor(tx, [product.id]);
  return productDto(
    product,
    variants.get(product.id) ?? [],
    { ...(found.store as Store), churchName: found.churchName as string },
    statsFromRow(found)
  );
}

export async function getPublicProduct(
  slug: string
): Promise<PublicProduct | null> {
  const db = await requireDb();
  return publicProductBySlug(db, slug);
}

export async function listPublicProducts(
  rawInput: ListPublicInput
): Promise<{ items: PublicProduct[]; nextCursor: number | null }> {
  const input = listPublicInput.parse(rawInput);
  const db = await requireDb();
  const filters: any[] = [
    eq(czProducts.status, "published"),
    eq(czApplications.status, "approved"),
    eq(czApplications.subscriptionStatus, "active"),
    isNotNull(czMembershipProfiles.emailVerifiedAt),
    isNotNull(czMembershipProfiles.phoneVerifiedAt),
    eq(czApplications.contactEmail, czMembershipProfiles.email),
    eq(czApplications.contactPhone, czMembershipProfiles.phone),
  ];
  if (input.q) {
    const term = `%${input.q}%`;
    filters.push(
      or(
        like(czProducts.title, term),
        like(czProducts.description, term),
        like(czProducts.category, term),
        like(czStores.name, term),
        sql`json_unquote(json_extract(${czProducts.bookMetadata}, '$.author')) like ${term}`,
        sql`json_unquote(json_extract(${czProducts.bookMetadata}, '$.publisher')) like ${term}`,
        sql`json_unquote(json_extract(${czProducts.bookMetadata}, '$.isbn')) like ${term}`
      )
    );
  }
  if (input.kind) filters.push(eq(czProducts.kind, input.kind));
  if (input.category) filters.push(eq(czProducts.category, input.category));
  if (input.province) filters.push(eq(czStores.province, input.province));
  if (input.minPriceCents !== undefined)
    filters.push(gte(czProducts.priceCents, input.minPriceCents));
  if (input.maxPriceCents !== undefined)
    filters.push(lte(czProducts.priceCents, input.maxPriceCents));
  const rating = ratingAggregate();
  const reviewCount = reviewCountAggregate();
  const soldCount = soldCountAggregate();
  if (input.minSold !== undefined) filters.push(gte(soldCount, input.minSold));
  if (input.minRating !== undefined && input.minRating > 0)
    filters.push(gte(rating, input.minRating));

  if (input.cursor) {
    const anchors = await db
      .select({
        priceCents: czProducts.priceCents,
        rating,
        reviewCount,
        soldCount,
      })
      .from(czProducts)
      .innerJoin(czStores, eq(czProducts.storeId, czStores.id))
      .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
      .innerJoin(
        czMembershipProfiles,
        eq(czMembershipProfiles.userId, czStores.userId)
      )
      .where(
        and(
          eq(czProducts.id, input.cursor),
          eq(czProducts.status, "published"),
          eq(czApplications.status, "approved"),
          eq(czApplications.subscriptionStatus, "active"),
          isNotNull(czMembershipProfiles.emailVerifiedAt),
          isNotNull(czMembershipProfiles.phoneVerifiedAt),
          eq(czApplications.contactEmail, czMembershipProfiles.email),
          eq(czApplications.contactPhone, czMembershipProfiles.phone)
        )
      )
      .limit(1);
    const anchor = anchors[0];
    if (!anchor) return { items: [], nextCursor: null };
    if (input.sort === "price_asc") {
      filters.push(
        or(
          gt(czProducts.priceCents, anchor.priceCents),
          and(
            eq(czProducts.priceCents, anchor.priceCents),
            lt(czProducts.id, input.cursor)
          )
        )
      );
    } else if (input.sort === "price_desc") {
      filters.push(
        or(
          lt(czProducts.priceCents, anchor.priceCents),
          and(
            eq(czProducts.priceCents, anchor.priceCents),
            lt(czProducts.id, input.cursor)
          )
        )
      );
    } else if (input.sort === "popular") {
      filters.push(
        or(
          lt(soldCount, anchor.soldCount),
          and(eq(soldCount, anchor.soldCount), lt(rating, anchor.rating)),
          and(
            eq(soldCount, anchor.soldCount),
            eq(rating, anchor.rating),
            lt(reviewCount, anchor.reviewCount)
          ),
          and(
            eq(soldCount, anchor.soldCount),
            eq(rating, anchor.rating),
            eq(reviewCount, anchor.reviewCount),
            lt(czProducts.id, input.cursor)
          )
        )
      );
    } else {
      filters.push(lt(czProducts.id, input.cursor));
    }
  }
  const order =
    input.sort === "price_asc"
      ? [asc(czProducts.priceCents), desc(czProducts.id)]
      : input.sort === "price_desc"
        ? [desc(czProducts.priceCents), desc(czProducts.id)]
        : input.sort === "popular"
          ? [
              desc(soldCount),
              desc(rating),
              desc(reviewCount),
              desc(czProducts.id),
            ]
          : [desc(czProducts.id)];
  const rows = await db
    .select({
      product: czProducts,
      store: czStores,
      churchName: czApplications.churchName,
      rating,
      reviewCount,
      soldCount,
    })
    .from(czProducts)
    .innerJoin(czStores, eq(czProducts.storeId, czStores.id))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    )
    .where(and(...filters))
    .orderBy(...order)
    .limit(input.limit + 1);
  const page = rows.slice(0, input.limit);
  const variantMap = await variantsFor(
    db,
    page.map(row => (row.product as Product).id)
  );
  const items = page.map(row =>
    productDto(
      row.product as Product,
      variantMap.get((row.product as Product).id) ?? [],
      { ...(row.store as Store), churchName: row.churchName as string },
      statsFromRow(row)
    )
  );
  return {
    items,
    nextCursor:
      rows.length > input.limit
        ? ((page[page.length - 1]?.product as Product | undefined)?.id ?? null)
        : null,
  };
}

export async function getPublicStore(
  slug: string
): Promise<{
  store: PublicStore;
  products: PublicProduct[];
  businessCategories: BusinessSelection[];
} | null> {
  const db = await requireDb();
  const stores = await db
    .select({
      store: czStores,
      churchName: czApplications.churchName,
      businessCategories: sql<unknown>`json_extract(${czApplications.details}, '$.businessCategories')`,
    })
    .from(czStores)
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    )
    .where(
      and(
        eq(czStores.slug, slug),
        eq(czApplications.status, "approved"),
        eq(czApplications.subscriptionStatus, "active"),
        isNotNull(czMembershipProfiles.emailVerifiedAt),
        isNotNull(czMembershipProfiles.phoneVerifiedAt),
        eq(czApplications.contactEmail, czMembershipProfiles.email),
        eq(czApplications.contactPhone, czMembershipProfiles.phone)
      )
    )
    .limit(1);
  const found = stores[0];
  if (!found) return null;
  const s = found.store as Store;
  const rows = await db
    .select({
      product: czProducts,
      store: czStores,
      churchName: czApplications.churchName,
      rating: ratingAggregate(),
      reviewCount: reviewCountAggregate(),
      soldCount: soldCountAggregate(),
    })
    .from(czProducts)
    .innerJoin(czStores, eq(czProducts.storeId, czStores.id))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    )
    .where(
      and(
        eq(czProducts.storeId, s.id),
        eq(czProducts.status, "published"),
        eq(czApplications.status, "approved"),
        eq(czApplications.subscriptionStatus, "active"),
        isNotNull(czMembershipProfiles.emailVerifiedAt),
        isNotNull(czMembershipProfiles.phoneVerifiedAt),
        eq(czApplications.contactEmail, czMembershipProfiles.email),
        eq(czApplications.contactPhone, czMembershipProfiles.phone)
      )
    )
    .orderBy(desc(czProducts.id));
  const map = await variantsFor(
    db,
    rows.map(row => (row.product as Product).id)
  );
  return {
    store: publicStore({ ...s, churchName: found.churchName as string }),
    businessCategories: readBusinessSelections({
      businessCategories:
        typeof found.businessCategories === "string"
          ? JSON.parse(found.businessCategories)
          : found.businessCategories,
    }),
    products: rows.map(row =>
      productDto(
        row.product as Product,
        map.get((row.product as Product).id) ?? [],
        { ...(row.store as Store), churchName: row.churchName as string },
        statsFromRow(row)
      )
    ),
  };
}

export async function suggest(q: string): Promise<string[]> {
  const term = q.trim();
  if (!term) return [];
  const db = await requireDb();
  const rows = await db
    .select({
      title: czProducts.title,
      category: czProducts.category,
      storeName: czStores.name,
    })
    .from(czProducts)
    .innerJoin(czStores, eq(czProducts.storeId, czStores.id))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    )
    .where(
      and(
        eq(czProducts.status, "published"),
        eq(czApplications.status, "approved"),
        eq(czApplications.subscriptionStatus, "active"),
        isNotNull(czMembershipProfiles.emailVerifiedAt),
        isNotNull(czMembershipProfiles.phoneVerifiedAt),
        eq(czApplications.contactEmail, czMembershipProfiles.email),
        eq(czApplications.contactPhone, czMembershipProfiles.phone),
        or(
          like(czProducts.title, `%${term}%`),
          like(czProducts.category, `%${term}%`),
          like(czStores.name, `%${term}%`),
          sql`json_unquote(json_extract(${czProducts.bookMetadata}, '$.author')) like ${`%${term}%`}`,
          sql`json_unquote(json_extract(${czProducts.bookMetadata}, '$.isbn')) like ${`%${term}%`}`
        )
      )
    )
    .orderBy(desc(czProducts.id))
    .limit(30);
  const output: string[] = [];
  for (const row of rows)
    for (const value of [row.title, row.category, row.storeName])
      if (!output.includes(value) && output.length < 10) output.push(value);
  return output;
}

export function categories(): readonly string[] {
  return catalogCategories;
}

async function ownerProduct(
  tx: any,
  userId: number,
  id: number,
  verified: boolean
) {
  const rows = await tx
    .select({
      product: czProducts,
      store: czStores,
      churchName: czApplications.churchName,
    })
    .from(czProducts)
    .innerJoin(czStores, eq(czProducts.storeId, czStores.id))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(
      and(
        eq(czProducts.id, id),
        eq(czProducts.ownerUserId, userId),
        eq(czStores.userId, userId)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const p = row.product as Product;
  const vm = await variantsFor(tx, [p.id]);
  return ownerProductDto(
    p,
    vm.get(p.id) ?? [],
    { ...(row.store as Store), churchName: row.churchName as string },
    verified
  );
}

export async function getMyStore(userId: number) {
  const db = await requireDb();
  const readiness = await sellerReadiness(db, userId);
  const rows = await db
    .select()
    .from(czStores)
    .where(eq(czStores.userId, userId))
    .limit(1);
  const store = rows[0] as Store | undefined;
  return {
    store: store
      ? {
          id: store.id,
          slug: store.slug,
          name: store.name,
          description: store.description,
          province: store.province,
          city: store.city,
          shippingFeeCents: store.shippingFeeCents ?? null,
          homeFeeCents: store.homeFeeCents ?? null,
          deliveryProvinces: jsonArray<string>(store.deliveryProvinces, []),
          shippingFeesByProvince: readFeeMap(store.shippingFeesByProvince),
          yappyPhone: store.yappyPhone ?? null,
          yappyDirectory: store.yappyDirectory ?? null,
          cardPaymentUrl: store.cardPaymentUrl ?? null,
          cardOnDelivery: Boolean(store.cardOnDelivery),
          verified: readiness.active,
        }
      : null,
    canPublish: readiness.active,
    blockingReason: readiness.active ? null : readiness.blockingReason,
  };
}

export async function saveStore(userId: number, input: SaveStoreInput) {
  const validated = saveStoreInput.parse(input);
  const parsed = {
    ...validated,
    name: validated.name.trim(),
    description: validated.description.trim(),
    province: validated.province.trim(),
    city: validated.city.trim(),
    yappyPhone: validated.yappyPhone || null,
    yappyDirectory: validated.yappyDirectory.trim() || null,
    cardPaymentUrl: validated.cardPaymentUrl || null,
    shippingFeesByProvince: Object.keys(validated.shippingFeesByProvince).length ? validated.shippingFeesByProvince : null,
    // Con precios por provincia, la cobertura son esas provincias.
    deliveryProvinces: Object.keys(validated.shippingFeesByProvince).length
      ? Object.keys(validated.shippingFeesByProvince)
      : validated.deliveryProvinces,
    cardOnDelivery: validated.cardOnDelivery ? 1 : 0,
  };
  const db = await requireDb();
  const readiness = await sellerReadiness(db, userId);
  if (!readiness.profile)
    throw new CatalogError(
      "PRECONDITION_FAILED",
      "Guarda tu perfil antes de crear la tienda"
    );
  if (!readiness.application)
    throw new CatalogError(
      "PRECONDITION_FAILED",
      "Crea una solicitud de vendedor antes de crear la tienda"
    );
  return db.transaction(async (tx: any) => {
    const existingRows = await tx
      .select()
      .from(czStores)
      .where(eq(czStores.userId, userId))
      .limit(1);
    const existing = existingRows[0] as Store | undefined;
    if (!existing) {
      const base = slugify(parsed.name);
      const result = await tx.insert(czStores).values({
        userId,
        slug: `${base}-${crypto.randomUUID().slice(0, 8)}`,
        ...parsed,
      });
      const id = insertId(result);
      const fresh = await storeFor(tx, id);
      if (!fresh)
        throw new CatalogError(
          "INTERNAL_SERVER_ERROR",
          "No se pudo guardar la tienda"
        );
      return {
        id: fresh.id,
        slug: fresh.slug,
        name: fresh.name,
        description: fresh.description,
        province: fresh.province,
        city: fresh.city,
        shippingFeeCents: fresh.shippingFeeCents ?? null,
        homeFeeCents: fresh.homeFeeCents ?? null,
        deliveryProvinces: jsonArray<string>(fresh.deliveryProvinces, []),
        shippingFeesByProvince: readFeeMap(fresh.shippingFeesByProvince),
        yappyPhone: fresh.yappyPhone ?? null,
        yappyDirectory: fresh.yappyDirectory ?? null,
        cardPaymentUrl: fresh.cardPaymentUrl ?? null,
        cardOnDelivery: Boolean(fresh.cardOnDelivery),
        verified: readiness.active,
      };
    }
    const update = await tx
      .update(czStores)
      .set(parsed)
      .where(and(eq(czStores.id, existing.id), eq(czStores.userId, userId)));
    if (!updateChanged(update))
      throw new CatalogError(
        "CONFLICT",
        "La tienda cambió mientras la guardabas"
      );
    const fresh = await storeFor(tx, existing.id);
    if (!fresh)
      throw new CatalogError(
        "INTERNAL_SERVER_ERROR",
        "No se pudo leer la tienda guardada"
      );
    return {
      id: fresh.id,
      slug: fresh.slug,
      name: fresh.name,
      description: fresh.description,
      province: fresh.province,
      city: fresh.city,
      shippingFeeCents: fresh.shippingFeeCents ?? null,
      homeFeeCents: fresh.homeFeeCents ?? null,
      deliveryProvinces: jsonArray<string>(fresh.deliveryProvinces, []),
      shippingFeesByProvince: readFeeMap(fresh.shippingFeesByProvince),
      yappyPhone: fresh.yappyPhone ?? null,
      yappyDirectory: fresh.yappyDirectory ?? null,
      cardPaymentUrl: fresh.cardPaymentUrl ?? null,
      cardOnDelivery: Boolean(fresh.cardOnDelivery),
      verified: readiness.active,
    };
  });
}

function normalizedVariants(
  input: VariantInput[],
  productPrice: number
): VariantInput[] {
  const values = input.map(value => ({
    ...value,
    size: normalizeText(value.size),
    color: normalizeText(value.color),
    sku: value.sku.trim(),
  }));
  if (
    !values.some(
      value => value.sku.toUpperCase() === "BASE" && !value.size && !value.color
    )
  )
    values.push({
      sku: "BASE",
      size: null,
      color: null,
      stock: 0,
      priceCents: productPrice,
    });
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.sku.toLowerCase();
    if (seen.has(key))
      throw new CatalogError(
        "BAD_REQUEST",
        "Cada variante debe tener un SKU distinto"
      );
    seen.add(key);
    if (value.stock < 0)
      throw new CatalogError(
        "BAD_REQUEST",
        "El inventario no puede ser negativo"
      );
  }
  return values;
}

async function syncVariants(
  tx: any,
  productId: number,
  input: VariantInput[],
  productPrice: number
) {
  const current = (await tx
    .select()
    .from(czVariants)
    .where(eq(czVariants.productId, productId))) as Variant[];
  const byId = new Map(current.map(row => [row.id, row]));
  const bySku = new Map(current.map(row => [row.sku.toLowerCase(), row]));
  const normalized = normalizedVariants(input, productPrice);
  for (const value of normalized) {
    const existing = value.id
      ? byId.get(value.id)
      : bySku.get(value.sku.toLowerCase());
    if (value.id && (!existing || existing.productId !== productId))
      throw new CatalogError(
        "BAD_REQUEST",
        "La variante no pertenece al producto"
      );
    const conflicting = current.find(
      row =>
        row.sku.toLowerCase() === value.sku.toLowerCase() &&
        row.id !== existing?.id
    );
    if (conflicting)
      throw new CatalogError(
        "BAD_REQUEST",
        "No se puede intercambiar SKUs en una sola operación; conserva los IDs y usa SKUs temporales"
      );
  }
  await tx
    .update(czVariants)
    .set({ active: 0 })
    .where(eq(czVariants.productId, productId));
  for (const value of normalized) {
    const existing = value.id
      ? byId.get(value.id)
      : bySku.get(value.sku.toLowerCase());
    const values = {
      sku: value.sku,
      size: value.size ?? null,
      color: value.color ?? null,
      stock: value.stock,
      priceCents: value.priceCents ?? productPrice,
      active: 1,
    };
    if (existing) {
      const updated = await tx
        .update(czVariants)
        .set(values)
        .where(
          and(
            eq(czVariants.id, existing.id),
            eq(czVariants.productId, productId)
          )
        );
      if (!updateChanged(updated))
        throw new CatalogError(
          "CONFLICT",
          "La variante cambió mientras la guardabas"
        );
    } else {
      await tx.insert(czVariants).values({ productId, ...values });
    }
  }
}

export function validatePublishable(
  product: Product,
  variants: Variant[]
): void {
  const images = jsonArray<string>(product.imageUrls, []);
  if (!images.length)
    throw new CatalogError(
      "BAD_REQUEST",
      "Publicar requiere al menos una imagen"
    );
  if (!Number.isInteger(product.priceCents) || product.priceCents <= 0)
    throw new CatalogError(
      "BAD_REQUEST",
      "Publicar requiere un precio mayor que cero"
    );
  if (!jsonArray<DeliveryMode>(product.deliveryModes, []).length)
    throw new CatalogError(
      "BAD_REQUEST",
      "Publicar requiere una modalidad de entrega"
    );
  const activeVariants = variants.filter(variant => variant.active === 1);
  if (
    !activeVariants.length ||
    activeVariants.some(
      variant =>
        !Number.isInteger(variant.priceCents) || variant.priceCents <= 0
    )
  ) {
    throw new CatalogError(
      "BAD_REQUEST",
      "Todas las variantes activas deben tener un precio mayor que cero"
    );
  }
  if (
    !product.title.trim() ||
    !product.description.trim() ||
    !product.category.trim()
  ) {
    throw new CatalogError(
      "BAD_REQUEST",
      "La publicación tiene metadata incompleta"
    );
  }
  if (
    product.kind === "book" &&
    !bookInput.safeParse(jsonColumn(product.bookMetadata)).success
  ) {
    throw new CatalogError(
      "BAD_REQUEST",
      "Los libros requieren metadata completa y condición new o used"
    );
  }
  if (product.kind === "product" && jsonColumn(product.bookMetadata) !== null) {
    throw new CatalogError(
      "BAD_REQUEST",
      "Los productos no pueden tener metadata de libro"
    );
  }
}

export async function saveProduct(
  userId: number,
  rawInput: SaveProductInput
): Promise<OwnerProduct> {
  const input = {
    ...rawInput,
    title: rawInput.title.trim(),
    description: rawInput.description.trim(),
    category: rawInput.category.trim(),
  };
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const readiness = await sellerReadiness(tx, userId);
    if (!readiness.profile || !readiness.application)
      throw new CatalogError(
        "PRECONDITION_FAILED",
        "Debes tener perfil y solicitud de vendedor para guardar publicaciones"
      );
    let productId: number;
    let existing: Product | undefined;
    if (input.id !== undefined) {
      const rows = await tx
        .select()
        .from(czProducts)
        .where(
          and(eq(czProducts.id, input.id), eq(czProducts.ownerUserId, userId))
        )
        .limit(1);
      existing = rows[0] as Product | undefined;
      if (!existing)
        throw new CatalogError("NOT_FOUND", "Producto no encontrado");
      if (input.expectedRevision === undefined)
        throw new CatalogError(
          "BAD_REQUEST",
          "La revisión esperada es obligatoria al editar"
        );
      if (existing.revision !== input.expectedRevision)
        throw new CatalogError(
          "CONFLICT",
          "El producto cambió en otra sesión; recarga antes de guardar"
        );
      productId = existing.id;
      const nextRevision =
        existing.revision === Number.MAX_SAFE_INTEGER
          ? null
          : existing.revision + 1;
      if (!nextRevision)
        throw new CatalogError(
          "CONFLICT",
          "La revisión del producto no puede aumentar"
        );
      const update = await tx
        .update(czProducts)
        .set({
          title: input.title,
          description: input.description,
          category: input.category,
          kind: input.kind,
          priceCents: input.priceCents,
          bookMetadata: input.book ? bookInput.parse(input.book) : null,
          imageUrls: input.images,
          deliveryModes: input.deliveryModes,
          revision: nextRevision,
        })
        .where(
          and(
            eq(czProducts.id, productId),
            eq(czProducts.ownerUserId, userId),
            eq(czProducts.revision, existing.revision)
          )
        );
      if (!updateChanged(update))
        throw new CatalogError(
          "CONFLICT",
          "El producto cambió mientras lo guardabas"
        );
    } else {
      const temporarySlug = `${slugify(input.title)}-${crypto.randomUUID().slice(0, 12)}`;
      const result = await tx.insert(czProducts).values({
        storeId:
          (
            await tx
              .select({ id: czStores.id })
              .from(czStores)
              .where(eq(czStores.userId, userId))
              .limit(1)
          )[0]?.id ??
          (() => {
            throw new CatalogError(
              "PRECONDITION_FAILED",
              "Guarda tu tienda antes de crear productos"
            );
          })(),
        ownerUserId: userId,
        slug: temporarySlug,
        kind: input.kind,
        title: input.title,
        description: input.description,
        category: input.category,
        priceCents: input.priceCents,
        status: "draft",
        revision: 1,
        bookMetadata: input.book ? bookInput.parse(input.book) : null,
        imageUrls: input.images,
        deliveryModes: input.deliveryModes,
      });
      productId = insertId(result);
      const finalSlug = `${slugify(input.title)}-${productId}`;
      await tx
        .update(czProducts)
        .set({ slug: finalSlug })
        .where(eq(czProducts.id, productId));
    }
    await syncVariants(tx, productId, input.variants, input.priceCents);
    if (existing?.status === "published") {
      const savedRows = await tx
        .select()
        .from(czProducts)
        .where(eq(czProducts.id, productId))
        .limit(1);
      const savedProduct = savedRows[0] as Product | undefined;
      if (!savedProduct)
        throw new CatalogError(
          "NOT_FOUND",
          "No se pudo leer la publicación editada"
        );
      validatePublishable(
        savedProduct,
        (await variantsFor(tx, [productId])).get(productId) ?? []
      );
    }
    const dto = await ownerProduct(tx, userId, productId, readiness.active);
    if (!dto)
      throw new CatalogError(
        "INTERNAL_SERVER_ERROR",
        "No se pudo leer la publicación guardada"
      );
    return dto;
  });
}

export async function setStatus(
  userId: number,
  id: number,
  expectedRevision: number,
  status: ProductStatus
): Promise<OwnerProduct> {
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const rows = await tx
      .select()
      .from(czProducts)
      .where(and(eq(czProducts.id, id), eq(czProducts.ownerUserId, userId)))
      .limit(1);
    const product = rows[0] as Product | undefined;
    if (!product) throw new CatalogError("NOT_FOUND", "Producto no encontrado");
    if (product.revision !== expectedRevision)
      throw new CatalogError(
        "CONFLICT",
        "El producto cambió en otra sesión; recarga antes de publicar"
      );
    if (status === "published") {
      await assertActiveStore(tx, product.storeId);
      const productVariants =
        (await variantsFor(tx, [product.id])).get(product.id) ?? [];
      validatePublishable(product, productVariants);
    }
    const nextRevision =
      product.revision === Number.MAX_SAFE_INTEGER
        ? null
        : product.revision + 1;
    if (!nextRevision)
      throw new CatalogError(
        "CONFLICT",
        "La revisión del producto no puede aumentar"
      );
    const update = await tx
      .update(czProducts)
      .set({ status, revision: nextRevision })
      .where(
        and(
          eq(czProducts.id, id),
          eq(czProducts.ownerUserId, userId),
          eq(czProducts.revision, expectedRevision)
        )
      );
    if (!updateChanged(update))
      throw new CatalogError(
        "CONFLICT",
        "El producto cambió mientras actualizabas su estado"
      );
    const readiness = await sellerReadiness(tx, userId);
    const dto = await ownerProduct(tx, userId, id, readiness.active);
    if (!dto)
      throw new CatalogError(
        "INTERNAL_SERVER_ERROR",
        "No se pudo leer el producto actualizado"
      );
    return dto;
  });
}

export async function listMyProducts(userId: number): Promise<OwnerProduct[]> {
  const db = await requireDb();
  const rows = await db
    .select({
      product: czProducts,
      store: czStores,
      churchName: czApplications.churchName,
    })
    .from(czProducts)
    .innerJoin(czStores, eq(czProducts.storeId, czStores.id))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(eq(czProducts.ownerUserId, userId))
    .orderBy(desc(czProducts.id));
  const map = await variantsFor(
    db,
    rows.map(row => (row.product as Product).id)
  );
  const readiness = await sellerReadiness(db, userId);
  return rows.map(row =>
    ownerProductDto(
      row.product as Product,
      map.get((row.product as Product).id) ?? [],
      { ...(row.store as Store), churchName: row.churchName as string },
      readiness.active
    )
  );
}

export async function getPublicCategories(): Promise<readonly string[]> {
  return catalogCategories;
}

export async function assertCatalogImageOwner(
  tx: any,
  userId: number,
  productId: number
): Promise<Product> {
  const rows = await tx
    .select()
    .from(czProducts)
    .where(
      and(eq(czProducts.id, productId), eq(czProducts.ownerUserId, userId))
    )
    .limit(1);
  const row = rows[0] as Product | undefined;
  if (!row)
    throw new CatalogError("FORBIDDEN", "No eres propietario de este producto");
  return row;
}

export async function persistCatalogImage(
  userId: number,
  productId: number,
  uploaded: { key: string; url: string; mimeType: string; size: number }
) {
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const product = await assertCatalogImageOwner(tx, userId, productId);
    if (product.revision === Number.MAX_SAFE_INTEGER)
      throw new CatalogError(
        "CONFLICT",
        "La revisión del producto no puede aumentar"
      );
    const images = [
      ...jsonArray<string>(product.imageUrls, []),
      uploaded.url,
    ].slice(-12);
    await tx.insert(czProductImages).values({
      productId,
      ownerUserId: userId,
      storageKey: uploaded.key,
      url: uploaded.url,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    });
    const update = await tx
      .update(czProducts)
      .set({ imageUrls: images, revision: product.revision + 1 })
      .where(
        and(
          eq(czProducts.id, productId),
          eq(czProducts.ownerUserId, userId),
          eq(czProducts.revision, product.revision)
        )
      );
    if (!updateChanged(update))
      throw new CatalogError(
        "CONFLICT",
        "El producto cambió mientras guardabas la foto"
      );
    return { url: uploaded.url, revision: product.revision + 1 };
  });
}

/** Las colecciones no mezclan publicaciones de muestra ni tiendas inactivas. */
export async function homeCollections() {
  const [newest, bestSellers, books] = await Promise.all([
    listPublicProducts(listPublicInput.parse({ limit: 4, sort: "newest" })),
    listPublicProducts(
      listPublicInput.parse({ limit: 4, sort: "popular", minSold: 1 })
    ),
    listPublicProducts(
      listPublicInput.parse({ limit: 4, kind: "book", sort: "newest" })
    ),
  ]);
  return {
    newest: newest.items,
    bestSellers: bestSellers.items,
    books: books.items,
  };
}
