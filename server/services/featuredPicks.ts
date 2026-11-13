/*
 * «Destacados» de /mercado: productos que un administrador activa para las
 * tiendas que pagan Service Pub. Solo se muestran mientras la tienda tenga
 * Service Pub pagado y vigente, plan Mayor Visibilidad activo y el producto
 * publicado.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { czProducts, czServices, czStores } from "../../drizzle/catalog-schema";
import { czApplications } from "../../drizzle/schema";
import {
  czServicePub,
  czServicePubProducts,
  czServicePubServices,
} from "../../drizzle/servicepub-schema";
import { FEATURED_PLAN_ID } from "@shared/featured";
import { getDb } from "../db";

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
const firstImage = (v: unknown): string | null => {
  let list = v;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return null;
    }
  }
  return Array.isArray(list) && typeof list[0] === "string" ? list[0] : null;
};

/** Lo que ve el público: foto, título (para el enlace) y la tienda. */
export async function publicFeaturedPicks(now = new Date()) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: czProducts.id,
      slug: czProducts.slug,
      title: czProducts.title,
      images: czProducts.imageUrls,
      storeName: czStores.name,
      storeSlug: czStores.slug,
      storeLogo: czStores.logoUrl,
    })
    .from(czServicePubProducts)
    .innerJoin(czProducts, eq(czProducts.id, czServicePubProducts.productId))
    .innerJoin(czStores, eq(czStores.id, czProducts.storeId))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(czServicePub, eq(czServicePub.userId, czStores.userId))
    .where(
      and(
        eq(czProducts.status, "published"),
        eq(czStores.storeKind, "comercio"),
        eq(czApplications.subscriptionStatus, "active"),
        eq(czApplications.subscriptionPlanId, FEATURED_PLAN_ID),
        eq(czServicePub.status, "active"),
        gt(czServicePub.activeUntil, now)
      )
    )
    .orderBy(desc(czServicePubProducts.createdAt))
    .limit(24);
  return rows.map(r => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    imageUrl: firstImage(r.images),
    store: {
      name: r.storeName,
      slug: r.storeSlug,
      logoUrl: r.storeLogo ?? null,
    },
  }));
}

/** Para el administrador: los productos publicados de un cliente de Service Pub y cuáles están en Destacados. */
export async function adminProductsFor(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: czProducts.id,
      title: czProducts.title,
      images: czProducts.imageUrls,
      status: czProducts.status,
      picked: czServicePubProducts.productId,
    })
    .from(czProducts)
    .innerJoin(czStores, eq(czStores.id, czProducts.storeId))
    .leftJoin(
      czServicePubProducts,
      eq(czServicePubProducts.productId, czProducts.id)
    )
    .where(eq(czStores.userId, userId))
    .orderBy(desc(czProducts.id))
    .limit(100);
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    imageUrl: firstImage(r.images),
    published: r.status === "published",
    featured: r.picked !== null,
  }));
}

export async function adminSetFeatured(
  adminId: number,
  productId: number,
  on: boolean
) {
  const db = await requireDb();
  const [row] = await db
    .select({ userId: czStores.userId })
    .from(czProducts)
    .innerJoin(czStores, eq(czStores.id, czProducts.storeId))
    .where(eq(czProducts.id, productId))
    .limit(1);
  if (!row) fail("NOT_FOUND", "El producto no existe");
  if (on)
    await db
      .insert(czServicePubProducts)
      .values({ productId, userId: row.userId, activatedBy: adminId })
      .onDuplicateKeyUpdate({ set: { activatedBy: adminId } });
  else
    await db
      .delete(czServicePubProducts)
      .where(eq(czServicePubProducts.productId, productId));
  return adminProductsFor(row.userId);
}

// ── Servicios: mismas reglas que los productos ──

/** «Destacados» de /servicios: servicios activados por el administrador. */
export async function publicFeaturedServices(now = new Date()) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: czServices.id,
      slug: czServices.slug,
      title: czServices.title,
      images: czServices.images,
      storeName: czStores.name,
      storeSlug: czStores.slug,
      storeLogo: czStores.logoUrl,
    })
    .from(czServicePubServices)
    .innerJoin(czServices, eq(czServices.id, czServicePubServices.serviceId))
    .innerJoin(czStores, eq(czStores.id, czServices.storeId))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(czServicePub, eq(czServicePub.userId, czStores.userId))
    .where(
      and(
        eq(czServices.status, "published"),
        eq(czStores.storeKind, "servicios"),
        eq(czApplications.subscriptionStatus, "active"),
        eq(czApplications.subscriptionPlanId, FEATURED_PLAN_ID),
        eq(czServicePub.status, "active"),
        gt(czServicePub.activeUntil, now)
      )
    )
    .orderBy(desc(czServicePubServices.createdAt))
    .limit(24);
  return rows.map(r => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    imageUrl: firstImage(r.images),
    store: { name: r.storeName, slug: r.storeSlug, logoUrl: r.storeLogo ?? null },
  }));
}

export async function adminServicesFor(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: czServices.id,
      title: czServices.title,
      images: czServices.images,
      status: czServices.status,
      picked: czServicePubServices.serviceId,
    })
    .from(czServices)
    .leftJoin(czServicePubServices, eq(czServicePubServices.serviceId, czServices.id))
    .where(eq(czServices.userId, userId))
    .orderBy(desc(czServices.id))
    .limit(100);
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    imageUrl: firstImage(r.images),
    published: r.status === "published",
    featured: r.picked !== null,
  }));
}

export async function adminSetServiceFeatured(adminId: number, serviceId: number, on: boolean) {
  const db = await requireDb();
  const [row] = await db
    .select({ userId: czServices.userId })
    .from(czServices)
    .where(eq(czServices.id, serviceId))
    .limit(1);
  if (!row) fail("NOT_FOUND", "El servicio no existe");
  if (on)
    await db
      .insert(czServicePubServices)
      .values({ serviceId, userId: row.userId, activatedBy: adminId })
      .onDuplicateKeyUpdate({ set: { activatedBy: adminId } });
  else await db.delete(czServicePubServices).where(eq(czServicePubServices.serviceId, serviceId));
  return adminServicesFor(row.userId);
}
