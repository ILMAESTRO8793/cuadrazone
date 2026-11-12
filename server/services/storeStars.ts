/*
 * Estrellas de verificación: se ganan por logros (achievements.ts) y un
 * administrador también puede otorgarlas a mano a una tienda. Con el plan
 * vencido no se muestra ninguna.
 */
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import {
  czJobs,
  czProperties,
  czServices,
  czStores,
  czVehicles,
} from "../../drizzle/catalog-schema";
import { czStoreStars } from "../../drizzle/verification-schema";
import { earnedStars, sortStars, type VerificationStar } from "@shared/stars";
import type { ReviewKind } from "@shared/listingReviews";
import { getDb } from "../db";
import { starsForUsers } from "./achievements";

async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "La base de datos no está disponible",
    });
  return db;
}

/** Estrellas de varias tiendas por su slug: { "dulces-de-ana": ["roja", "azul"] }. */
export async function starsForSlugs(slugs: string[]) {
  const unique = Array.from(new Set(slugs)).slice(0, 60);
  const out: Record<string, VerificationStar[]> = {};
  if (!unique.length) return out;
  const db = await getDb();
  if (!db) return out;
  const stores = await db
    .select({ slug: czStores.slug, userId: czStores.userId })
    .from(czStores)
    .where(inArray(czStores.slug, unique));
  const { stars } = await starsForUsers(
    db,
    stores.map(s => s.userId)
  );
  for (const s of stores) {
    const list = stars.get(s.userId);
    if (list) out[s.slug] = list;
  }
  return out;
}

const listingTables = {
  servicio: czServices,
  inmueble: czProperties,
  auto: czVehicles,
  empleo: czJobs,
} as const;

/** Estrellas del dueño de un anuncio (bienes raíces, autos, empleos o servicios). */
export async function starsForListing(
  kind: ReviewKind,
  listingId: number
): Promise<VerificationStar[]> {
  const db = await getDb();
  if (!db) return [];
  const t = listingTables[kind] as typeof czJobs;
  const [row] = await db
    .select({ userId: t.userId })
    .from(t)
    .where(eq(t.id, listingId))
    .limit(1);
  if (!row) return [];
  const { stars } = await starsForUsers(db, [row.userId]);
  return stars.get(row.userId) ?? [];
}

/** Para el administrador: qué logros cumple la tienda y qué estrellas le dio a mano. */
export async function adminStoreStars(storeId: number) {
  const db = await requireDb();
  const [store] = await db
    .select({ userId: czStores.userId })
    .from(czStores)
    .where(eq(czStores.id, storeId))
    .limit(1);
  if (!store)
    throw new TRPCError({ code: "NOT_FOUND", message: "La tienda no existe" });
  const manual = await db
    .select({ star: czStoreStars.star })
    .from(czStoreStars)
    .where(eq(czStoreStars.storeId, storeId));
  const { metrics } = await starsForUsers(db, [store.userId]);
  const m = metrics.get(store.userId)!;
  return {
    active: m.active,
    earned: earnedStars(m),
    manual: sortStars(manual.map(r => r.star)),
    metrics: m,
  };
}

/** Otorga o quita a mano una estrella a una tienda. */
export async function setStoreStar(
  adminId: number,
  input: { storeId: number; star: VerificationStar; awarded: boolean }
) {
  const db = await requireDb();
  const [store] = await db
    .select({ id: czStores.id })
    .from(czStores)
    .where(eq(czStores.id, input.storeId))
    .limit(1);
  if (!store)
    throw new TRPCError({ code: "NOT_FOUND", message: "La tienda no existe" });
  if (input.awarded)
    await db
      .insert(czStoreStars)
      .values({
        storeId: input.storeId,
        star: input.star,
        note: "",
        awardedBy: adminId,
      })
      .onDuplicateKeyUpdate({ set: { awardedBy: adminId } });
  else
    await db
      .delete(czStoreStars)
      .where(
        and(
          eq(czStoreStars.storeId, input.storeId),
          eq(czStoreStars.star, input.star)
        )
      );
  return adminStoreStars(input.storeId);
}
