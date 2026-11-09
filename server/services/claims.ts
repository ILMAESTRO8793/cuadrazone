// Etapa 6 · Reclamos de pedidos (ver shared/claims.ts).
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import { czClaims, czOrders } from "../../drizzle/commerce-schema";
import type { User } from "../../drizzle/schema";
import {
  CLAIM_RESPONSE_HOURS,
  CLAIM_WINDOW_DAYS,
  canAdminResolve,
  claimReasonLabels,
  claimResolutionLabels,
  claimableOrderStatuses,
  isClaimOverdue,
  openClaimInput,
  resolveClaimInput,
  respondClaimInput,
  type ClaimReason,
  type ClaimResolution,
  type ClaimStatus,
} from "@shared/claims";
import { getDb } from "../db";
import { queueAdminEmail, queueEmail, recipientFor } from "./email";
import { isDuplicateKeyError } from "./subscriptions";

const HOUR_MS = 60 * 60 * 1000;

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
const insertId = (r: unknown) =>
  Number(
    ((Array.isArray(r) ? r[0] : r) as { insertId?: number })?.insertId ?? 0
  );
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;
const when = (d: Date) =>
  new Intl.DateTimeFormat("es-PA", {
    timeZone: "America/Panama",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);

export type ClaimDTO = {
  id: number;
  orderId: number;
  reason: ClaimReason;
  description: string;
  status: ClaimStatus;
  overdue: boolean;
  respondBy: string;
  sellerResponse: string | null;
  sellerRespondedAt: string | null;
  resolution: ClaimResolution | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

function dto(row: any, now = new Date()): ClaimDTO {
  return {
    id: row.id,
    orderId: row.orderId,
    reason: row.reason,
    description: row.description,
    status: row.status,
    overdue: isClaimOverdue(row, now),
    respondBy: new Date(row.respondBy).toISOString(),
    sellerResponse: row.sellerResponse ?? null,
    sellerRespondedAt: iso(row.sellerRespondedAt),
    resolution: row.resolution ?? null,
    resolutionNote: row.resolutionNote ?? null,
    resolvedAt: iso(row.resolvedAt),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/** Pedido con su vendedor; solo el comprador o el vendedor lo ven. */
async function orderParties(db: any, orderId: number) {
  const rows = await db
    .select({ order: czOrders, sellerUserId: czStores.userId })
    .from(czOrders)
    .leftJoin(czStores, eq(czStores.id, czOrders.storeId))
    .where(eq(czOrders.id, orderId))
    .limit(1);
  if (!rows[0]) fail("NOT_FOUND", "El pedido no existe");
  return rows[0] as { order: any; sellerUserId: number | null };
}

/** Reclamo de un pedido, visto por el comprador o el vendedor. */
export async function claimForOrder(
  user: User,
  orderId: number,
  now = new Date()
) {
  const db = await requireDb();
  const { order, sellerUserId } = await orderParties(db, orderId);
  const role =
    order.userId === user.id
      ? "buyer"
      : sellerUserId === user.id
        ? "seller"
        : null;
  if (!role) fail("NOT_FOUND", "El pedido no existe");
  const rows = await db
    .select()
    .from(czClaims)
    .where(eq(czClaims.orderId, orderId))
    .limit(1);
  const created = new Date(order.createdAt).getTime();
  return {
    role,
    claim: rows[0] ? dto(rows[0], now) : null,
    canOpen:
      role === "buyer" &&
      !rows[0] &&
      Boolean(order.storeId) &&
      (claimableOrderStatuses as readonly string[]).includes(order.status) &&
      now.getTime() - created <= CLAIM_WINDOW_DAYS * 24 * HOUR_MS,
  };
}

export async function openClaim(user: User, raw: unknown, now = new Date()) {
  const parsed = openClaimInput.safeParse(raw);
  if (!parsed.success)
    fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const v = parsed.data;
  const db = await requireDb();
  const { order, sellerUserId } = await orderParties(db, v.orderId);
  if (order.userId !== user.id) fail("NOT_FOUND", "El pedido no existe");
  if (!sellerUserId)
    fail("PRECONDITION_FAILED", "La tienda de este pedido ya no existe");
  if (!(claimableOrderStatuses as readonly string[]).includes(order.status))
    fail(
      "PRECONDITION_FAILED",
      "Solo puedes reclamar un pedido confirmado, enviado o entregado"
    );
  if (
    now.getTime() - new Date(order.createdAt).getTime() >
    CLAIM_WINDOW_DAYS * 24 * HOUR_MS
  )
    fail(
      "PRECONDITION_FAILED",
      `Los reclamos se abren dentro de los ${CLAIM_WINDOW_DAYS} días de la compra`
    );
  const respondBy = new Date(now.getTime() + CLAIM_RESPONSE_HOURS * HOUR_MS);
  try {
    return await db.transaction(async (tx: any) => {
      const inserted = await tx.insert(czClaims).values({
        orderId: order.id,
        buyerUserId: user.id,
        sellerUserId,
        storeId: order.storeId,
        reason: v.reason,
        description: v.description,
        respondBy,
      });
      const id = insertId(inserted);
      const details: Array<[string, string]> = [
        ["Pedido", order.number],
        ["Motivo", claimReasonLabels[v.reason]],
      ];
      await queueEmail(
        tx,
        `claim-opened:${id}`,
        await recipientFor(tx, sellerUserId),
        {
          subject: `Reclamo del pedido ${order.number}`,
          title: "Un comprador abrió un reclamo",
          paragraphs: [
            `El comprador escribió: «${v.description}»`,
            `Tienes hasta el ${when(respondBy)} (${CLAIM_RESPONSE_HOURS} horas) para responder desde el pedido. Si no respondes, CuadraZone decidirá con lo que tenga.`,
          ],
          details,
          cta: { label: "Responder el reclamo", path: `/pedidos/${order.id}` },
        }
      );
      await queueAdminEmail(tx, `claim-opened-admin:${id}`, {
        subject: `Nuevo reclamo: pedido ${order.number}`,
        title: "Se abrió un reclamo",
        paragraphs: [
          `Motivo: ${claimReasonLabels[v.reason]}. El vendedor tiene ${CLAIM_RESPONSE_HOURS} horas para responder.`,
        ],
        details,
        cta: { label: "Ver reclamos", path: "/admin/reclamos" },
      });
      return { id };
    });
  } catch (error) {
    if (isDuplicateKeyError(error))
      fail("CONFLICT", "Ya abriste un reclamo para este pedido");
    throw error;
  }
}

export async function respondClaim(user: User, raw: unknown, now = new Date()) {
  const parsed = respondClaimInput.safeParse(raw);
  if (!parsed.success)
    fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const rows = await tx
      .select()
      .from(czClaims)
      .where(eq(czClaims.id, parsed.data.claimId))
      .for("update")
      .limit(1);
    const claim = rows[0];
    if (!claim || claim.sellerUserId !== user.id)
      fail("NOT_FOUND", "El reclamo no existe");
    if (claim.status === "resolved")
      fail("PRECONDITION_FAILED", "Este reclamo ya se resolvió");
    const result = await tx
      .update(czClaims)
      .set({
        status: "answered",
        sellerResponse: parsed.data.response,
        sellerRespondedAt: now,
      })
      .where(and(eq(czClaims.id, claim.id), ne(czClaims.status, "resolved")));
    if (!changed(result))
      fail("CONFLICT", "El reclamo cambió. Recarga la página.");
    await queueEmail(
      tx,
      `claim-answered:${claim.id}:${now.getTime()}`,
      await recipientFor(tx, claim.buyerUserId),
      {
        subject: "El vendedor respondió tu reclamo",
        title: "Respuesta del vendedor",
        paragraphs: [
          `«${parsed.data.response}»`,
          "CuadraZone revisará el caso y te avisará la decisión.",
        ],
        cta: { label: "Ver mi pedido", path: `/pedidos/${claim.orderId}` },
      }
    );
    await queueAdminEmail(
      tx,
      `claim-answered-admin:${claim.id}:${now.getTime()}`,
      {
        subject: `Reclamo #${claim.id} listo para decidir`,
        title: "El vendedor respondió un reclamo",
        paragraphs: [`Respuesta: «${parsed.data.response}»`],
        cta: { label: "Decidir", path: "/admin/reclamos" },
      }
    );
    return { status: "answered" as const };
  });
}

/** El comprador retira su reclamo (por ejemplo, porque ya se arregló). */
export async function withdrawClaim(
  user: User,
  claimId: number,
  now = new Date()
) {
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const rows = await tx
      .select()
      .from(czClaims)
      .where(eq(czClaims.id, claimId))
      .for("update")
      .limit(1);
    const claim = rows[0];
    if (!claim || claim.buyerUserId !== user.id)
      fail("NOT_FOUND", "El reclamo no existe");
    if (claim.status === "resolved") return { status: "resolved" as const };
    await tx
      .update(czClaims)
      .set({
        status: "resolved",
        resolution: "withdrawn",
        resolvedAt: now,
        resolvedBy: user.id,
      })
      .where(eq(czClaims.id, claimId));
    await queueEmail(
      tx,
      `claim-withdrawn:${claimId}`,
      await recipientFor(tx, claim.sellerUserId),
      {
        subject: "El comprador retiró su reclamo",
        title: "Reclamo retirado",
        paragraphs: [
          "El comprador retiró el reclamo de su pedido. No tienes que hacer nada más.",
        ],
        cta: { label: "Ver el pedido", path: `/pedidos/${claim.orderId}` },
      }
    );
    return { status: "resolved" as const };
  });
}

// ───────────── Administrador ─────────────

export async function adminListClaims(
  filter: "pending" | "all",
  now = new Date()
) {
  const db = await requireDb();
  const rows = await db
    .select({
      claim: czClaims,
      number: czOrders.number,
      totalCents: czOrders.totalCents,
      storeName: czOrders.storeName,
      orderStatus: czOrders.status,
    })
    .from(czClaims)
    .innerJoin(czOrders, eq(czOrders.id, czClaims.orderId))
    .where(
      filter === "pending"
        ? inArray(czClaims.status, ["open", "answered"])
        : undefined
    )
    .orderBy(desc(czClaims.createdAt))
    .limit(200);
  return rows.map((r: any) => ({
    ...dto(r.claim, now),
    canResolve: canAdminResolve(r.claim, now),
    order: {
      number: r.number as string,
      totalCents: r.totalCents as number,
      storeName: r.storeName as string,
      status: r.orderStatus as string,
    },
  }));
}

export async function adminResolveClaim(
  admin: User,
  raw: unknown,
  now = new Date()
) {
  const parsed = resolveClaimInput.safeParse(raw);
  if (!parsed.success)
    fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const v = parsed.data;
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const rows = await tx
      .select()
      .from(czClaims)
      .where(eq(czClaims.id, v.claimId))
      .for("update")
      .limit(1);
    const claim = rows[0];
    if (!claim) fail("NOT_FOUND", "El reclamo no existe");
    if (claim.status === "resolved")
      fail("CONFLICT", "Este reclamo ya se resolvió");
    if (!canAdminResolve(claim, now))
      fail(
        "PRECONDITION_FAILED",
        `El vendedor todavía tiene plazo para responder hasta el ${when(new Date(claim.respondBy))}`
      );
    await tx
      .update(czClaims)
      .set({
        status: "resolved",
        resolution: v.resolution,
        resolutionNote: v.note,
        resolvedBy: admin.id,
        resolvedAt: now,
      })
      .where(and(eq(czClaims.id, claim.id), ne(czClaims.status, "resolved")));
    const label = claimResolutionLabels[v.resolution];
    const paragraphs = [
      `Decisión: ${label}.`,
      `Nota de CuadraZone: «${v.note}»`,
    ];
    await queueEmail(
      tx,
      `claim-resolved-buyer:${claim.id}`,
      await recipientFor(tx, claim.buyerUserId),
      {
        subject: "Decisión sobre tu reclamo",
        title: "Tu reclamo fue resuelto",
        paragraphs: [
          ...paragraphs,
          ...(v.resolution === "buyer_favor"
            ? [
                "El vendedor debe devolverte el dinero o reponer el artículo, según la nota. Si no lo hace, escríbenos.",
              ]
            : []),
        ],
        cta: { label: "Ver mi pedido", path: `/pedidos/${claim.orderId}` },
      }
    );
    await queueEmail(
      tx,
      `claim-resolved-seller:${claim.id}`,
      await recipientFor(tx, claim.sellerUserId),
      {
        subject: "Decisión sobre un reclamo",
        title: "CuadraZone resolvió un reclamo",
        paragraphs: [
          ...paragraphs,
          ...(v.resolution === "buyer_favor"
            ? [
                "Debes devolver el dinero o reponer el artículo al comprador. No cumplir puede suspender tu tienda.",
              ]
            : []),
        ],
        cta: { label: "Ver el pedido", path: `/pedidos/${claim.orderId}` },
      }
    );
    return { status: "resolved" as const, resolution: v.resolution };
  });
}

/** Reclamos que el vendedor tiene que responder (para su resumen). */
export type SellerOpenClaim = {
  id: number;
  orderId: number;
  orderNumber: string;
  reason: ClaimReason;
  respondBy: string;
  overdue: boolean;
};

export async function openClaimsForSeller(
  db: any,
  sellerUserId: number,
  now = new Date()
): Promise<SellerOpenClaim[]> {
  const rows = await db
    .select({ claim: czClaims, number: czOrders.number })
    .from(czClaims)
    .innerJoin(czOrders, eq(czOrders.id, czClaims.orderId))
    .where(
      and(eq(czClaims.sellerUserId, sellerUserId), eq(czClaims.status, "open"))
    )
    .orderBy(czClaims.respondBy)
    .limit(20);
  return rows.map((r: any) => ({
    id: r.claim.id as number,
    orderId: r.claim.orderId as number,
    orderNumber: r.number as string,
    reason: r.claim.reason as ClaimReason,
    respondBy: new Date(r.claim.respondBy).toISOString(),
    overdue: isClaimOverdue(r.claim, now),
  }));
}
