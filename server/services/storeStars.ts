/* Estrellas de verificación: el público ve cuáles tiene una tienda; solo un administrador las otorga. */
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import { czStoreStars } from "../../drizzle/verification-schema";
import { czApplications } from "../../drizzle/schema";
import { sortStars, verificationStars, type VerificationStar } from "@shared/stars";
import { getDb } from "../db";

async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La base de datos no está disponible" });
  return db;
}

/** Estrellas de varias tiendas por su slug: { "dulces-de-ana": ["roja", "azul"] }. */
export async function starsForSlugs(slugs: string[]) {
  const unique = Array.from(new Set(slugs)).slice(0, 60);
  const out: Record<string, VerificationStar[]> = {};
  if (!unique.length) return out;
  const db = await getDb();
  if (!db) return out;
  const rows = await db
    .select({ slug: czStores.slug, star: czStoreStars.star })
    .from(czStoreStars)
    .innerJoin(czStores, eq(czStores.id, czStoreStars.storeId))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    // Con el plan vencido no se muestran estrellas.
    .where(and(inArray(czStores.slug, unique), eq(czApplications.subscriptionStatus, "active")));
  const grouped = new Map<string, string[]>();
  for (const r of rows) grouped.set(r.slug, [...(grouped.get(r.slug) ?? []), r.star]);
  for (const [slug, stars] of grouped) out[slug] = sortStars(stars);
  // Mayor Visibilidad pagado y vigente: la tienda lleva las cinco estrellas.
  const featured = await db
    .select({ slug: czStores.slug })
    .from(czStores)
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(
      and(
        inArray(czStores.slug, unique),
        eq(czApplications.status, "approved"),
        eq(czApplications.subscriptionStatus, "active"),
        eq(czApplications.subscriptionPlanId, "mayor_visibilidad")
      )
    );
  for (const f of featured) out[f.slug] = [...verificationStars];
  return out;
}

/** ¿Tiene Mayor Visibilidad pagado y vigente? Entonces sus cinco estrellas son automáticas. */
async function hasMayorVisibilidad(storeId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ id: czStores.id })
    .from(czStores)
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(
      and(
        eq(czStores.id, storeId),
        eq(czApplications.status, "approved"),
        eq(czApplications.subscriptionStatus, "active"),
        eq(czApplications.subscriptionPlanId, "mayor_visibilidad")
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Para el administrador: estrellas de una tienda con su nota y fecha. */
export async function adminStoreStars(storeId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ star: czStoreStars.star, note: czStoreStars.note, createdAt: czStoreStars.createdAt })
    .from(czStoreStars)
    .where(eq(czStoreStars.storeId, storeId))
    .orderBy(asc(czStoreStars.id));
  return {
    automatic: await hasMayorVisibilidad(storeId),
    stars: rows.map(r => ({ star: r.star as VerificationStar, note: r.note, createdAt: new Date(r.createdAt).toISOString() })),
  };
}

export async function setStoreStar(
  adminId: number,
  input: { storeId: number; star: VerificationStar; awarded: boolean; note: string }
) {
  const db = await requireDb();
  const store = await db.select({ id: czStores.id }).from(czStores).where(eq(czStores.id, input.storeId)).limit(1);
  if (!store[0]) throw new TRPCError({ code: "NOT_FOUND", message: "La tienda no existe" });
  if (input.awarded) {
    await db
      .insert(czStoreStars)
      .values({ storeId: input.storeId, star: input.star, note: input.note.trim(), awardedBy: adminId })
      .onDuplicateKeyUpdate({ set: { note: input.note.trim(), awardedBy: adminId } });
  } else {
    await db
      .delete(czStoreStars)
      .where(and(eq(czStoreStars.storeId, input.storeId), eq(czStoreStars.star, input.star)));
  }
  return adminStoreStars(input.storeId);
}
