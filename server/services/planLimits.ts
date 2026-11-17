// Límite de publicaciones de cada tienda según su plan (16/11/2026):
// pymes hasta 99 productos, empresa mediana hasta 300, grande sin límite;
// servicios: plan Normal hasta 20, Mayor Visibilidad sin límite; restaurantes:
// platos del menú según su plan (20, 100 o sin límite). Durante el mes gratis
// vale el plan que eligió la tienda (o el más básico de su tipo). Al llegar al
// tope no se publica más hasta que el administrador activa el plan siguiente.
import { TRPCError } from "@trpc/server";
import { and, eq, ne, sql } from "drizzle-orm";
import {
  TRIAL_PLAN_ID,
  limitReachedMessage,
  storeLimits,
} from "@shared/pricing";
import { czProducts, czServices } from "../../drizzle/catalog-schema";
import { czMenuItems } from "../../drizzle/menu-schema";
import { czApplications, czPlanSelections } from "../../drizzle/schema";

type Quota = "product" | "service" | "dish";

const words: Record<Quota, string> = {
  product: "productos",
  service: "servicios",
  dish: "menús",
};

/** Plan que manda en los límites: el pagado o, en el mes gratis, el elegido. */
export async function effectiveStorePlan(
  db: any,
  userId: number
): Promise<{ planId: string | null; storeKind: string | null }> {
  const [row] = await db
    .select({
      planId: czApplications.subscriptionPlanId,
      selected: czPlanSelections.planId,
      storeKind: czApplications.storeKind,
    })
    .from(czApplications)
    .leftJoin(
      czPlanSelections,
      eq(czPlanSelections.userId, czApplications.userId)
    )
    .where(eq(czApplications.userId, userId))
    .limit(1);
  if (!row) return { planId: null, storeKind: null };
  const planId =
    !row.planId || row.planId === TRIAL_PLAN_ID
      ? (row.selected ?? null)
      : row.planId;
  return { planId, storeKind: row.storeKind ?? null };
}

async function countPublished(
  db: any,
  quota: Quota,
  userId: number,
  storeId: number | null,
  excludeId: number | null
): Promise<number> {
  if (quota === "product") {
    const rows = await db
      .select({ n: sql<number>`count(*)` })
      .from(czProducts)
      .where(
        and(
          eq(czProducts.ownerUserId, userId),
          eq(czProducts.status, "published"),
          excludeId ? ne(czProducts.id, excludeId) : undefined
        )
      );
    return Number(rows[0]?.n ?? 0);
  }
  if (quota === "service") {
    const rows = await db
      .select({ n: sql<number>`count(*)` })
      .from(czServices)
      .where(
        and(
          eq(czServices.userId, userId),
          eq(czServices.status, "published"),
          excludeId ? ne(czServices.id, excludeId) : undefined
        )
      );
    return Number(rows[0]?.n ?? 0);
  }
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(czMenuItems)
    .where(
      and(
        eq(czMenuItems.storeId, storeId ?? 0),
        excludeId ? ne(czMenuItems.id, excludeId) : undefined
      )
    );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Lanza un error si publicar uno más pasa el límite del plan de la tienda.
 * `excludeId` es la publicación que se está publicando (no se cuenta dos veces).
 */
export async function assertStoreQuota(
  db: any,
  userId: number,
  quota: Quota,
  opts: { storeId?: number | null; excludeId?: number | null } = {}
): Promise<void> {
  const { planId, storeKind } = await effectiveStorePlan(db, userId);
  const limits = storeLimits(planId, storeKind);
  const limit =
    quota === "product"
      ? limits.productLimit
      : quota === "service"
        ? limits.serviceLimit
        : limits.dishLimit;
  if (limit === null) return;
  const count = await countPublished(
    db,
    quota,
    userId,
    opts.storeId ?? null,
    opts.excludeId ?? null
  );
  if (count >= limit)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        limit === 0
          ? `Tu plan no incluye ${words[quota]}.`
          : limitReachedMessage(limit, words[quota]),
    });
}

/** Antes de publicar un producto: revisa el límite de productos del plan. */
export async function assertProductPublishQuota(
  db: any,
  userId: number,
  productId: number
): Promise<void> {
  const [row] = await db
    .select({ status: czProducts.status })
    .from(czProducts)
    .where(
      and(eq(czProducts.id, productId), eq(czProducts.ownerUserId, userId))
    )
    .limit(1);
  // Si no existe o ya está publicado, el servicio de catálogo decide.
  if (!row || row.status === "published") return;
  await assertStoreQuota(db, userId, "product", { excludeId: productId });
}
