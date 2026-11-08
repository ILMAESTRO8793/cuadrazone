// Avisos de pago de los vendedores a CuadraZone («Ya pagué»).
//
// El vendedor paga la mensualidad y/o la comisión por Yappy, transferencia o
// tarjeta (en el enlace de la pasarela) y sube su comprobante. El aviso queda
// pendiente hasta que un administrador confirma que el dinero llegó:
//   - al aprobarlo, se registran los pagos con las mismas funciones del registro
//     manual (todo en una transacción), y la tienda se activa o se extiende;
//   - al rechazarlo, el vendedor recibe el motivo por correo.
// Los montos los calcula el servidor; el vendedor solo dice qué pagó.
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  conceptLabels,
  paymentClaimInput,
  platformMethodLabels,
  splitCommission,
  type ClaimStatus,
  type PaymentClaimInput,
  type PaymentConcept,
  type PlatformPaymentMethod,
} from "@shared/billing";
import { MAX_DOCUMENT_BYTES } from "@shared/membership";
import { getSellerPlan, type SellerPlanId } from "@shared/pricing";
import {
  czApplications,
  czMembershipAudit,
  czMembershipProfiles,
  czPaymentClaims,
  czPlanSelections,
  czSubscriptionPayments,
  users,
  type User,
} from "../../drizzle/schema";
import { czCommissionPayments } from "../../drizzle/commerce-schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { queueAdminEmail, queueEmail, recipientFor } from "./email";
import { paymentClaimForAdmin, paymentClaimRejected } from "./emailMessages";
import { MembershipError, validateDocumentBytes } from "./membership";
import {
  pendingCommissionOrders,
  recordCommissionPaymentTx,
} from "./commissions";
import {
  expectedAmountCents,
  isDuplicateKeyError,
  platformPaymentDetails,
  recordSubscriptionPaymentTx,
  subscriptionForUser,
  validateReceipt,
} from "./subscriptions";

const RECEIPT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function fail(code: TRPCError["code"], message: string): never {
  throw new MembershipError(code, message);
}

async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}

/** Lo que el aviso cubre y cuánto, calculado en el servidor. */
export function claimAmounts(
  input: Pick<PaymentClaimInput, "concept" | "planId" | "months">,
  commissionDueCents: number
): { subscriptionCents: number; commissionCents: number; amountCents: number } {
  const paysSubscription = input.concept !== "commission";
  const paysCommission = input.concept !== "subscription";
  if (paysSubscription && (!input.planId || !input.months))
    fail("BAD_REQUEST", "Elige el plan y cuántos meses pagas");
  if (paysCommission && commissionDueCents <= 0)
    fail("BAD_REQUEST", "No tienes comisión de meses cerrados por pagar");
  const subscriptionCents = paysSubscription
    ? expectedAmountCents(input.planId!, input.months!)
    : 0;
  const commissionCents = paysCommission ? commissionDueCents : 0;
  return {
    subscriptionCents,
    commissionCents,
    amountCents: subscriptionCents + commissionCents,
  };
}

type ClaimRow = typeof czPaymentClaims.$inferSelect;

function claimSnapshot(row: Omit<ClaimRow, "receiptBytes">) {
  return {
    id: row.id,
    concept: row.concept as PaymentConcept,
    planId: (row.planId ?? null) as SellerPlanId | null,
    months: row.months ?? null,
    subscriptionCents: row.subscriptionCents,
    commissionCents: row.commissionCents,
    amountCents: row.amountCents,
    method: row.method as PlatformPaymentMethod,
    reference: row.reference,
    paidOn: row.paidOn,
    note: row.note ?? "",
    receiptName: row.receiptName,
    receiptMime: row.receiptMime,
    status: row.status as ClaimStatus,
    rejectReason: row.rejectReason ?? null,
    reviewedAt: row.reviewedAt ?? null,
    createdAt: row.createdAt,
  };
}

/** Columnas del aviso sin el archivo (que puede pesar hasta 5 MiB). */
const claimColumns = {
  id: czPaymentClaims.id,
  applicationId: czPaymentClaims.applicationId,
  userId: czPaymentClaims.userId,
  concept: czPaymentClaims.concept,
  planId: czPaymentClaims.planId,
  months: czPaymentClaims.months,
  subscriptionCents: czPaymentClaims.subscriptionCents,
  commissionCents: czPaymentClaims.commissionCents,
  commissionCutoff: czPaymentClaims.commissionCutoff,
  amountCents: czPaymentClaims.amountCents,
  method: czPaymentClaims.method,
  reference: czPaymentClaims.reference,
  paidOn: czPaymentClaims.paidOn,
  note: czPaymentClaims.note,
  receiptName: czPaymentClaims.receiptName,
  receiptMime: czPaymentClaims.receiptMime,
  receiptSize: czPaymentClaims.receiptSize,
  status: czPaymentClaims.status,
  reviewedBy: czPaymentClaims.reviewedBy,
  reviewedAt: czPaymentClaims.reviewedAt,
  rejectReason: czPaymentClaims.rejectReason,
  createdAt: czPaymentClaims.createdAt,
};

/** Todo lo que el vendedor necesita para pagar: cuánto, a quién y sus avisos. */
export async function sellerBilling(userId: number, now = new Date()) {
  const db = await getDb();
  if (!db) return null;
  const subscription = await subscriptionForUser(userId);
  if (!subscription) return null;
  const chosen = await db
    .select({ planId: czPlanSelections.planId })
    .from(czPlanSelections)
    .where(eq(czPlanSelections.userId, userId))
    .limit(1);
  const chosenPlanId = (chosen[0]?.planId ?? "normal") as SellerPlanId;
  const commission = splitCommission(
    await pendingCommissionOrders(db, userId),
    now
  );
  const claims = await db
    .select(claimColumns)
    .from(czPaymentClaims)
    .where(eq(czPaymentClaims.userId, userId))
    .orderBy(desc(czPaymentClaims.createdAt))
    .limit(10);
  return {
    subscription,
    chosenPlanId,
    monthlyCents: getSellerPlan(chosenPlanId).monthlyCents,
    commission: {
      dueCents: commission.dueCents,
      dueCount: commission.dueCount,
      accruingCents: commission.accruingCents,
      deadline: commission.deadline,
    },
    platform: platformPaymentDetails(),
    claims: claims.map(claimSnapshot),
    hasPendingClaim: claims.some(
      (claim: { status: string }) => claim.status === "pending"
    ),
  };
}

/** Crea un aviso «Ya pagué» con su comprobante. Uno pendiente a la vez. */
export async function createPaymentClaim(
  user: { id: number },
  raw: unknown,
  receipt: { bytes: Buffer; mimeType: string; fileName: string },
  now = new Date()
) {
  const parsed = paymentClaimInput.safeParse(raw);
  if (!parsed.success)
    fail(
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ?? "Datos del pago no válidos"
    );
  const input = parsed.data;
  const checked = validateReceipt(
    {
      method: input.method,
      reference: input.reference,
      paidOn: input.paidOn,
      note: input.note,
    },
    now
  );
  if (!RECEIPT_MIME_TYPES.has(receipt.mimeType))
    fail(
      "UNSUPPORTED_MEDIA_TYPE",
      "El comprobante debe ser PDF, PNG, JPEG o WEBP"
    );
  validateDocumentBytes(receipt.bytes, receipt.mimeType, MAX_DOCUMENT_BYTES);
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const apps = await tx
      .select()
      .from(czApplications)
      .where(
        and(
          eq(czApplications.userId, user.id),
          eq(czApplications.status, "approved")
        )
      )
      .for("update")
      .limit(1);
    const app = apps[0];
    if (!app)
      fail("FORBIDDEN", "Solo los vendedores aprobados pueden avisar un pago");
    const pending = await tx
      .select({ id: czPaymentClaims.id })
      .from(czPaymentClaims)
      .where(
        and(
          eq(czPaymentClaims.userId, user.id),
          eq(czPaymentClaims.status, "pending")
        )
      )
      .limit(1);
    if (pending.length)
      fail(
        "CONFLICT",
        "Ya tienes un aviso de pago en revisión. Espera la respuesta antes de enviar otro."
      );
    // Un comprobante ya registrado no puede volver a usarse (se detecta ahora, no al aprobar).
    const usedBefore = [
      ...(await tx
        .select({ id: czSubscriptionPayments.id })
        .from(czSubscriptionPayments)
        .where(
          and(
            eq(czSubscriptionPayments.method, input.method),
            eq(czSubscriptionPayments.reference, checked.reference)
          )
        )
        .limit(1)),
      ...(await tx
        .select({ id: czCommissionPayments.id })
        .from(czCommissionPayments)
        .where(
          and(
            eq(czCommissionPayments.method, input.method),
            eq(czCommissionPayments.reference, checked.reference)
          )
        )
        .limit(1)),
    ];
    if (usedBefore.length)
      fail(
        "CONFLICT",
        "Ese número de comprobante ya fue registrado. Revisa el número o escríbenos si es un error."
      );
    const commission = splitCommission(
      await pendingCommissionOrders(tx, user.id),
      now
    );
    const amounts = claimAmounts(input, commission.dueCents);
    const inserted = await tx.insert(czPaymentClaims).values({
      applicationId: app.id,
      userId: user.id,
      concept: input.concept,
      planId: input.concept === "commission" ? null : input.planId!,
      months: input.concept === "commission" ? null : input.months!,
      subscriptionCents: amounts.subscriptionCents,
      commissionCents: amounts.commissionCents,
      commissionCutoff: amounts.commissionCents > 0 ? commission.cutoff : null,
      amountCents: amounts.amountCents,
      method: input.method,
      reference: checked.reference,
      paidOn: checked.paidOn,
      note: checked.note || null,
      receiptName: receipt.fileName,
      receiptMime: receipt.mimeType,
      receiptSize: receipt.bytes.length,
      receiptBytes: receipt.bytes,
    });
    const header = Array.isArray(inserted) ? inserted[0] : inserted;
    const id = Number((header as { insertId?: number }).insertId);
    await tx.insert(czMembershipAudit).values({
      applicationId: app.id,
      userId: user.id,
      actorUserId: user.id,
      action: "payment_claim_created",
      reason: null,
      metadata: {
        claimId: id,
        concept: input.concept,
        amountCents: amounts.amountCents,
        method: input.method,
      },
    });
    const name = await sellerName(tx, user.id);
    await queueAdminEmail(
      tx,
      `payment-claim:${id}`,
      paymentClaimForAdmin(
        name,
        conceptLabels[input.concept],
        amounts.amountCents,
        platformMethodLabels[input.method]
      )
    );
    return { id, ...amounts };
  });
}

async function sellerName(tx: any, userId: number) {
  const rows = await tx
    .select({ displayName: czMembershipProfiles.displayName, name: users.name })
    .from(users)
    .leftJoin(czMembershipProfiles, eq(czMembershipProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.displayName || rows[0]?.name || `Vendedor #${userId}`;
}

/** Avisos para el administrador (por defecto, los pendientes, del más antiguo al más nuevo). */
export async function adminListClaims(status: ClaimStatus | "all" = "pending") {
  const db = await requireDb();
  const rows = await db
    .select({
      ...claimColumns,
      displayName: czMembershipProfiles.displayName,
      accountName: users.name,
    })
    .from(czPaymentClaims)
    .leftJoin(users, eq(users.id, czPaymentClaims.userId))
    .leftJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czPaymentClaims.userId)
    )
    .where(status === "all" ? undefined : eq(czPaymentClaims.status, status))
    .orderBy(
      status === "pending"
        ? czPaymentClaims.createdAt
        : desc(czPaymentClaims.createdAt)
    )
    .limit(200);
  return rows.map((row: any) => ({
    ...claimSnapshot(row),
    applicationId: row.applicationId as number,
    sellerName: (row.displayName ||
      row.accountName ||
      `Vendedor #${row.userId}`) as string,
  }));
}

async function lockPendingClaim(tx: any, claimId: number) {
  const rows = await tx
    .select(claimColumns)
    .from(czPaymentClaims)
    .where(eq(czPaymentClaims.id, claimId))
    .for("update")
    .limit(1);
  const claim = rows[0];
  if (!claim) fail("NOT_FOUND", "El aviso de pago no existe");
  if (claim.status !== "pending")
    fail("CONFLICT", "Este aviso ya fue revisado");
  return claim;
}

/**
 * Aprueba un aviso: registra la mensualidad y/o la comisión exactamente como el
 * registro manual, en una sola transacción. Si algo no cuadra (por ejemplo, la
 * comisión cambió), no se registra nada y el aviso sigue pendiente.
 */
export async function adminApproveClaim(
  admin: Pick<User, "id">,
  claimId: number,
  now = new Date()
) {
  const db = await requireDb();
  try {
    return await db.transaction(async (tx: any) => {
      const claim = await lockPendingClaim(tx, claimId);
      const note = [`Aviso de pago #${claim.id}`, claim.note]
        .filter(Boolean)
        .join(" · ");
      const receipt = {
        method: claim.method as PlatformPaymentMethod,
        reference: claim.reference,
        paidOn: claim.paidOn,
        note,
      };
      if (claim.subscriptionCents > 0)
        await recordSubscriptionPaymentTx(
          tx,
          admin.id,
          {
            applicationId: claim.applicationId,
            planId: claim.planId as SellerPlanId,
            months: claim.months!,
            amountCents: claim.subscriptionCents,
            ...receipt,
          },
          now
        );
      if (claim.commissionCents > 0)
        await recordCommissionPaymentTx(
          tx,
          admin.id,
          {
            applicationId: claim.applicationId,
            amountCents: claim.commissionCents,
            receipt,
            deliveredBefore: claim.commissionCutoff,
          },
          now
        );
      await tx
        .update(czPaymentClaims)
        .set({ status: "approved", reviewedBy: admin.id, reviewedAt: now })
        .where(eq(czPaymentClaims.id, claim.id));
      await tx.insert(czMembershipAudit).values({
        applicationId: claim.applicationId,
        userId: claim.userId,
        actorUserId: admin.id,
        action: "payment_claim_approved",
        reason: null,
        metadata: { claimId: claim.id, amountCents: claim.amountCents },
      });
      return { id: claim.id, status: "approved" as const };
    });
  } catch (error) {
    if (isDuplicateKeyError(error))
      fail(
        "CONFLICT",
        "Ese comprobante ya fue registrado con el mismo método de pago"
      );
    throw error;
  }
}

export async function adminRejectClaim(
  admin: Pick<User, "id">,
  claimId: number,
  reason: string,
  now = new Date()
) {
  const cleanReason = reason.trim();
  if (cleanReason.length < 5)
    fail("BAD_REQUEST", "Explica el motivo (mínimo 5 caracteres)");
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const claim = await lockPendingClaim(tx, claimId);
    await tx
      .update(czPaymentClaims)
      .set({
        status: "rejected",
        reviewedBy: admin.id,
        reviewedAt: now,
        rejectReason: cleanReason.slice(0, 500),
      })
      .where(eq(czPaymentClaims.id, claim.id));
    await tx.insert(czMembershipAudit).values({
      applicationId: claim.applicationId,
      userId: claim.userId,
      actorUserId: admin.id,
      action: "payment_claim_rejected",
      reason: cleanReason.slice(0, 500),
      metadata: { claimId: claim.id, amountCents: claim.amountCents },
    });
    await queueEmail(
      tx,
      `payment-claim-rejected:${claim.id}`,
      await recipientFor(tx, claim.userId),
      paymentClaimRejected(claim.amountCents, cleanReason)
    );
    return { id: claim.id, status: "rejected" as const };
  });
}

// ───────────────────── Rutas del comprobante (archivo) ─────────────────────

const STATUS_BY_CODE: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
};

function sendError(res: Response, error: unknown) {
  if (error instanceof MembershipError)
    return res
      .status(STATUS_BY_CODE[error.code] ?? 500)
      .json({ error: error.message });
  console.error(
    "[Pagos] Error:",
    error instanceof Error ? error.message : error
  );
  return res
    .status(500)
    .json({ error: "No se pudo procesar el aviso de pago" });
}

async function requestUser(req: Request) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.id < 0)
      fail("FORBIDDEN", "Las sesiones de tareas no pueden avisar pagos");
    return user;
  } catch (error) {
    if (error instanceof MembershipError) throw error;
    fail("UNAUTHORIZED", "Inicia sesión para continuar");
  }
}

function headerText(req: Request, name: string) {
  const value = req.headers[name];
  if (typeof value !== "string" || !value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    fail("BAD_REQUEST", "Cabecera no válida");
  }
}

/**
 * Antes de leer el archivo: cabecera anti-CSRF y sesión válida. Así nadie sin
 * sesión hace que el servidor reciba hasta 5 MiB para nada.
 */
async function claimPreflight(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.headers["x-cz-request"] !== "1")
      fail("PRECONDITION_FAILED", "Falta la cabecera x-cz-request: 1");
    res.locals.billingUser = await requestUser(req);
    return next();
  } catch (error) {
    return sendError(res, error);
  }
}

async function uploadClaim(req: Request, res: Response) {
  try {
    const user = res.locals.billingUser as { id: number } | undefined;
    if (!user) fail("UNAUTHORIZED", "Inicia sesión para continuar");
    if (!Buffer.isBuffer(req.body))
      fail("UNSUPPORTED_MEDIA_TYPE", "Envía el comprobante como archivo");
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]
      .toLowerCase();
    let meta: unknown;
    try {
      meta = JSON.parse(headerText(req, "x-cz-claim") || "null");
    } catch {
      fail("BAD_REQUEST", "Datos del pago no válidos");
    }
    const fileName =
      (headerText(req, "x-cz-filename") || "comprobante")
        .replace(/[\\/\0\r\n]/g, "_")
        .trim()
        .slice(0, 200) || "comprobante";
    const created = await createPaymentClaim(user, meta, {
      bytes: req.body,
      mimeType,
      fileName,
    });
    return res.status(201).json(created);
  } catch (error) {
    return sendError(res, error);
  }
}

async function downloadReceipt(req: Request, res: Response) {
  try {
    const user = await requestUser(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0)
      fail("NOT_FOUND", "Comprobante no disponible");
    const db = await requireDb();
    const rows = await db
      .select({
        userId: czPaymentClaims.userId,
        bytes: czPaymentClaims.receiptBytes,
        mime: czPaymentClaims.receiptMime,
        name: czPaymentClaims.receiptName,
      })
      .from(czPaymentClaims)
      .where(eq(czPaymentClaims.id, id))
      .limit(1);
    const row = rows[0];
    if (!row || (user.role !== "admin" && row.userId !== user.id))
      fail("NOT_FOUND", "Comprobante no disponible");
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Content-Disposition": `inline; filename="comprobante"; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    });
    res.type(row.mime);
    return res.status(200).send(row.bytes);
  } catch (error) {
    return sendError(res, error);
  }
}

function rawReceipt(req: Request, res: Response, next: NextFunction) {
  express.raw({ type: () => true, limit: MAX_DOCUMENT_BYTES })(
    req,
    res,
    error => {
      if (!error) return next();
      const tooLarge =
        (error as { type?: string }).type === "entity.too.large" ||
        (error as { status?: number }).status === 413;
      return res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? "El comprobante supera el límite de 5 MiB"
          : "Archivo no válido",
      });
    }
  );
}

export function registerBillingRoutes(app: Express) {
  app.post("/api/billing/claims", claimPreflight, rawReceipt, uploadClaim);
  app.get("/api/billing/claims/:id/receipt", downloadReceipt);
}
