/*
 * Ubicaciones en el mapa.
 * - El dueño marca el punto exacto de su tienda o de su anuncio.
 * - El público solo recibe la zona aproximada (~500 m), nunca el punto exacto.
 * - En un pedido de comercio, el comprador y el vendedor ven el punto exacto
 *   del otro para la entrega.
 */
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import {
  czJobs,
  czProperties,
  czServices,
  czStores,
  czVehicles,
} from "../../drizzle/catalog-schema";
import { czOrders } from "../../drizzle/commerce-schema";
import { czOrderPlaces, czPlaces } from "../../drizzle/location-schema";
import {
  approximate,
  fromE6,
  pointInput,
  toE6,
  type ApproxPlace,
  type PlaceKind,
  type Point,
  type PublicPlaceKind,
} from "@shared/location";
import { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}

const point = (r: { latE6: number; lngE6: number }): Point => ({
  lat: fromE6(r.latE6),
  lng: fromE6(r.lngE6),
});

async function readPlace(db: Db, kind: PlaceKind, refId: number) {
  const [row] = await db
    .select({ latE6: czPlaces.latE6, lngE6: czPlaces.lngE6 })
    .from(czPlaces)
    .where(and(eq(czPlaces.kind, kind), eq(czPlaces.refId, refId)))
    .limit(1);
  return row ? point(row) : null;
}

async function writePlace(
  db: Db,
  kind: PlaceKind,
  refId: number,
  p: Point | null
) {
  if (!p) {
    await db
      .delete(czPlaces)
      .where(and(eq(czPlaces.kind, kind), eq(czPlaces.refId, refId)));
    return;
  }
  const parsed = pointInput.parse(p);
  const values = { latE6: toE6(parsed.lat), lngE6: toE6(parsed.lng) };
  await db
    .insert(czPlaces)
    .values({ kind, refId, ...values })
    .onDuplicateKeyUpdate({ set: values });
}

const listingTables = {
  inmueble: czProperties,
  auto: czVehicles,
  empleo: czJobs,
} as const;
type ListingKind = keyof typeof listingTables;

async function storeOfUser(db: Db, userId: number) {
  const [store] = await db
    .select({ id: czStores.id })
    .from(czStores)
    .where(eq(czStores.userId, userId))
    .limit(1);
  return store ?? null;
}

async function assertListingOwner(
  db: Db,
  kind: ListingKind,
  listingId: number,
  userId: number
) {
  const t = listingTables[kind] as typeof czJobs;
  const [row] = await db
    .select({ userId: t.userId })
    .from(t)
    .where(eq(t.id, listingId))
    .limit(1);
  if (!row) fail("NOT_FOUND", "El anuncio no existe");
  if (row.userId !== userId) fail("FORBIDDEN", "Este anuncio no es tuyo");
}

// ── Dueño: punto exacto ──

export async function myStorePlace(userId: number) {
  const db = await requireDb();
  const store = await storeOfUser(db, userId);
  if (!store) return { hasStore: false, point: null };
  return { hasStore: true, point: await readPlace(db, "tienda", store.id) };
}

export async function setMyStorePlace(userId: number, p: Point | null) {
  const db = await requireDb();
  const store = await storeOfUser(db, userId);
  if (!store)
    fail("PRECONDITION_FAILED", "Primero guarda los datos de tu tienda");
  await writePlace(db, "tienda", store.id, p);
  return myStorePlace(userId);
}

export async function myListingPlace(
  userId: number,
  kind: ListingKind,
  listingId: number
) {
  const db = await requireDb();
  await assertListingOwner(db, kind, listingId, userId);
  return readPlace(db, kind, listingId);
}

export async function setMyListingPlace(
  userId: number,
  kind: ListingKind,
  listingId: number,
  p: Point | null
) {
  const db = await requireDb();
  await assertListingOwner(db, kind, listingId, userId);
  await writePlace(db, kind, listingId, p);
  return readPlace(db, kind, listingId);
}

// ── Público: solo la zona aproximada ──

export async function publicPlace(
  kind: PublicPlaceKind,
  ref: { id?: number; slug?: string }
): Promise<ApproxPlace | null> {
  const db = await getDb();
  if (!db) return null;
  let exact: Point | null = null;
  if (kind === "tienda") {
    if (!ref.slug) return null;
    const [store] = await db
      .select({ id: czStores.id })
      .from(czStores)
      .where(eq(czStores.slug, ref.slug))
      .limit(1);
    if (store) exact = await readPlace(db, "tienda", store.id);
  } else if (kind === "servicio") {
    if (!ref.id) return null;
    const [row] = await db
      .select({ storeId: czServices.storeId })
      .from(czServices)
      .where(eq(czServices.id, ref.id))
      .limit(1);
    if (row) exact = await readPlace(db, "tienda", row.storeId);
  } else {
    if (!ref.id) return null;
    exact = await readPlace(db, kind, ref.id);
  }
  return exact ? approximate(exact) : null;
}

// ── Pedidos: las dos partes ven el punto exacto del otro ──

export async function saveOrderPlace(
  tx: Pick<Db, "insert">,
  orderId: number,
  p: Point
) {
  const parsed = pointInput.parse(p);
  await tx.insert(czOrderPlaces).values({
    orderId,
    latE6: toE6(parsed.lat),
    lngE6: toE6(parsed.lng),
  });
}

export async function orderPlaces(userId: number, orderId: number) {
  const db = await requireDb();
  const [row] = await db
    .select({
      buyerId: czOrders.userId,
      sellerId: czStores.userId,
      storeId: czStores.id,
      mode: czOrders.deliveryMode,
    })
    .from(czOrders)
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .where(eq(czOrders.id, orderId))
    .limit(1);
  if (!row) fail("NOT_FOUND", "El pedido no existe");
  if (row.buyerId !== userId && row.sellerId !== userId)
    fail("FORBIDDEN", "No autorizado para este pedido");
  const [buyer] = await db
    .select({ latE6: czOrderPlaces.latE6, lngE6: czOrderPlaces.lngE6 })
    .from(czOrderPlaces)
    .where(eq(czOrderPlaces.orderId, orderId))
    .limit(1);
  return {
    viewer: row.buyerId === userId ? ("buyer" as const) : ("seller" as const),
    mode: row.mode,
    buyer: buyer ? point(buyer) : null,
    store: await readPlace(db, "tienda", row.storeId),
  };
}
