// Eliminar la tienda por completo y para siempre (decisión del 5/11/2026):
// - Solo si no tiene pedidos en curso ni comisiones sin pagar.
// - Se borran productos, variantes, fotos, videos, servicios, solicitudes,
//   reseñas, preguntas, favoritos, carritos, conversaciones, la solicitud de
//   vendedor, los documentos (cédula, Yappy) y el plan elegido. No hay forma de
//   recuperarlos.
// - Los pedidos pasados se conservan para los compradores y la contabilidad,
//   pero como «Tienda eliminada», sin enlace a la tienda ni a sus productos.
// - Los pagos de mensualidades y comisiones quedan como registro contable.
// - Bienes raíces, autos y empleos no se tocan: son de la cuenta, no de la tienda.
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { czProductImages, czProducts, czServiceRequests, czServices, czStores, czVariants } from "../../drizzle/catalog-schema";
import { czCartItems, czConversations, czFavorites, czMessages, czOrderItems, czOrders, czQuestions, czReviews } from "../../drizzle/commerce-schema";
import { czApplications, czMembershipAudit, czPlanSelections, czVerificationDocuments, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { storageRemove } from "../storage";
import { queueEmail, recipientFor } from "./email";

const OPEN_ORDER = ["pending", "confirmed", "shipped"] as const;

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
const count = (rows: Array<{ n: unknown }>) => Number(rows[0]?.n ?? 0);
/** Compara el nombre escrito con el de la tienda sin importar mayúsculas ni espacios extra. */
export const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

async function findStore(db: any, userId: number) {
  return (await db.select().from(czStores).where(eq(czStores.userId, userId)).limit(1))[0] as any | undefined;
}

/** Lo que impide eliminar la tienda ahora, y lo que se borraría. */
export async function storeDeletionCheck(user: User) {
  const db = await requireDb();
  const store = await findStore(db, user.id);
  if (!store) return { hasStore: false as const };
  const openOrders = count(await db.select({ n: sql`count(*)` }).from(czOrders).where(and(eq(czOrders.storeId, store.id), inArray(czOrders.status, [...OPEN_ORDER]))));
  const owed = await db
    .select({ n: sql`count(*)`, cents: sql`coalesce(sum(${czOrders.commissionCents}), 0)` })
    .from(czOrders)
    .where(and(eq(czOrders.storeId, store.id), eq(czOrders.status, "delivered"), isNull(czOrders.commissionPaymentId), sql`${czOrders.commissionCents} > 0`));
  const products = count(await db.select({ n: sql`count(*)` }).from(czProducts).where(eq(czProducts.storeId, store.id)));
  const services = count(await db.select({ n: sql`count(*)` }).from(czServices).where(eq(czServices.storeId, store.id)));
  const pastOrders = count(await db.select({ n: sql`count(*)` }).from(czOrders).where(eq(czOrders.storeId, store.id)));
  const blockers: string[] = [];
  if (openOrders) blockers.push(`Tienes ${openOrders} ${openOrders === 1 ? "pedido en curso" : "pedidos en curso"}. Entrégalos o cancélalos primero.`);
  if (count(owed)) blockers.push(`Debes US$${(Number(owed[0]?.cents ?? 0) / 100).toFixed(2)} de comisiones. Págalas primero.`);
  return { hasStore: true as const, storeName: store.name as string, products, services, pastOrders, blockers };
}

/** Elimina la tienda para siempre. `confirmName` debe ser el nombre exacto de la tienda. */
export async function deleteStore(user: User, confirmName: string) {
  const db = await requireDb();
  const check = await storeDeletionCheck(user);
  if (!check.hasStore) fail("NOT_FOUND", "No tienes una tienda para eliminar");
  if (!sameName(confirmName, check.storeName)) fail("BAD_REQUEST", "Escribe el nombre exacto de tu tienda para confirmar");
  if (check.blockers.length) fail("PRECONDITION_FAILED", check.blockers.join(" "));

  const { productIds, serviceIds, storeName } = await db.transaction(async (tx: any) => {
    // Se bloquea la tienda para que nadie compre mientras se elimina.
    const store = (await tx.select().from(czStores).where(eq(czStores.userId, user.id)).for("update").limit(1))[0];
    if (!store) fail("NOT_FOUND", "No tienes una tienda para eliminar");
    const open = count(await tx.select({ n: sql`count(*)` }).from(czOrders).where(and(eq(czOrders.storeId, store.id), inArray(czOrders.status, [...OPEN_ORDER]))));
    if (open) fail("PRECONDITION_FAILED", "Entró un pedido nuevo. Atiéndelo antes de eliminar la tienda.");

    const productIds: number[] = (await tx.select({ id: czProducts.id }).from(czProducts).where(eq(czProducts.storeId, store.id))).map((r: any) => r.id);
    const variantIds: number[] = productIds.length
      ? (await tx.select({ id: czVariants.id }).from(czVariants).where(inArray(czVariants.productId, productIds))).map((r: any) => r.id)
      : [];
    const serviceIds: number[] = (await tx.select({ id: czServices.id }).from(czServices).where(eq(czServices.storeId, store.id))).map((r: any) => r.id);

    // 1) Pedidos pasados: se conservan sin datos del vendedor.
    await tx.update(czOrders).set({ storeId: null, storeName: "Tienda eliminada" }).where(eq(czOrders.storeId, store.id));
    if (productIds.length) await tx.update(czOrderItems).set({ productId: null, variantId: null }).where(inArray(czOrderItems.productId, productIds));

    // 2) Conversaciones del vendedor (por pedidos o preguntas) y sus mensajes.
    const questionIds: number[] = productIds.length
      ? (await tx.select({ id: czQuestions.id }).from(czQuestions).where(inArray(czQuestions.productId, productIds))).map((r: any) => r.id)
      : [];
    const convoWhere = questionIds.length ? or(eq(czConversations.sellerId, user.id), inArray(czConversations.questionId, questionIds)) : eq(czConversations.sellerId, user.id);
    const convoIds: number[] = (await tx.select({ id: czConversations.id }).from(czConversations).where(convoWhere)).map((r: any) => r.id);
    if (convoIds.length) {
      await tx.delete(czMessages).where(inArray(czMessages.conversationId, convoIds));
      await tx.delete(czConversations).where(inArray(czConversations.id, convoIds));
    }

    // 3) Todo lo que cuelga de los productos.
    if (productIds.length) {
      await tx.delete(czReviews).where(inArray(czReviews.productId, productIds));
      await tx.delete(czQuestions).where(inArray(czQuestions.productId, productIds));
      await tx.delete(czFavorites).where(inArray(czFavorites.productId, productIds));
      if (variantIds.length) await tx.delete(czCartItems).where(inArray(czCartItems.variantId, variantIds));
      await tx.delete(czProductImages).where(inArray(czProductImages.productId, productIds));
      await tx.delete(czVariants).where(inArray(czVariants.productId, productIds));
      await tx.delete(czProducts).where(inArray(czProducts.id, productIds));
    }

    // 4) Servicios y sus solicitudes.
    if (serviceIds.length) {
      await tx.delete(czServiceRequests).where(inArray(czServiceRequests.serviceId, serviceIds));
      await tx.delete(czServices).where(inArray(czServices.id, serviceIds));
    }

    // 5) La tienda, su solicitud, documentos privados, historial y plan elegido.
    await tx.delete(czStores).where(eq(czStores.id, store.id));
    const apps: number[] = (await tx.select({ id: czApplications.id }).from(czApplications).where(eq(czApplications.userId, user.id))).map((r: any) => r.id);
    if (apps.length) {
      await tx.update(czApplications).set({ identityDocumentId: null, pastoralDocumentId: null, payoutDocumentId: null }).where(inArray(czApplications.id, apps));
      await tx.delete(czVerificationDocuments).where(inArray(czVerificationDocuments.applicationId, apps));
      await tx.delete(czMembershipAudit).where(inArray(czMembershipAudit.applicationId, apps));
      await tx.delete(czApplications).where(inArray(czApplications.id, apps));
    }
    await tx.delete(czPlanSelections).where(eq(czPlanSelections.userId, user.id));
    return { productIds, serviceIds, storeName: store.name as string };
  });

  // 6) Fotos y videos: se borran del disco (fuera de la transacción).
  for (const id of productIds) await storageRemove(`catalog/products/${id}`).catch(error => console.error("[Eliminar tienda] Archivos:", error));
  for (const id of serviceIds) await storageRemove(`catalog/services/${id}`).catch(error => console.error("[Eliminar tienda] Archivos:", error));

  await queueEmail(db, `store-deleted:${user.id}:${Date.now()}`, await recipientFor(db, user.id), {
    subject: "Tu tienda en CuadraZone fue eliminada",
    title: "Eliminaste tu tienda",
    paragraphs: [
      `Tu tienda «${storeName}» y todo su contenido (productos, servicios, fotos, videos y documentos) se eliminaron para siempre.`,
      "Tu cuenta sigue activa para comprar y para tus anuncios de bienes raíces, autos y empleos. Si quieres vender de nuevo, puedes abrir una tienda nueva cuando quieras.",
    ],
    cta: { label: "Ir a CuadraZone", path: "/" },
  }).catch(() => undefined);
  console.log(`[Eliminar tienda] Usuario ${user.id} eliminó «${storeName}» (${productIds.length} productos, ${serviceIds.length} servicios)`);
  return { deleted: true, products: productIds.length, services: serviceIds.length };
}
