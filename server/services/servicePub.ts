/*
 * Service Pub: el vendedor pide publicidad personalizada (US$10 al mes, aparte
 * de su plan); un administrador registra el pago y la activa.
 */
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import { czApplications, type User } from "../../drizzle/schema";
import {
  czServicePub,
  czServicePubPayments,
} from "../../drizzle/servicepub-schema";
import {
  SERVICE_PUB_MONTHLY_CENTS,
  extendServicePub,
  servicePubDisplayStatus,
  type RecordServicePubPaymentInput,
} from "@shared/servicePub";
import { getDb } from "../db";
import { queueAdminEmail, queueEmail, recipientFor } from "./email";

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;

export async function myServicePub(user: User) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(czServicePub)
    .where(eq(czServicePub.userId, user.id))
    .limit(1);
  const [app] = await db
    .select({ status: czApplications.status })
    .from(czApplications)
    .where(eq(czApplications.userId, user.id))
    .limit(1);
  return {
    eligible: app?.status === "approved",
    monthlyCents: SERVICE_PUB_MONTHLY_CENTS,
    subscription: row
      ? {
          status: servicePubDisplayStatus(row.status, row.activeUntil),
          message: row.message,
          activeUntil: iso(row.activeUntil),
          requestedAt: iso(row.requestedAt),
        }
      : null,
  };
}

export async function requestServicePub(user: User, message: string) {
  const db = await requireDb();
  const [app] = await db
    .select({ status: czApplications.status })
    .from(czApplications)
    .where(eq(czApplications.userId, user.id))
    .limit(1);
  if (app?.status !== "approved")
    fail("FORBIDDEN", "Primero tu tienda tiene que estar aprobada");
  await db.transaction(async tx => {
    const [row] = await tx
      .select()
      .from(czServicePub)
      .where(eq(czServicePub.userId, user.id))
      .limit(1);
    const stillActive =
      row?.status === "active" &&
      row.activeUntil &&
      new Date(row.activeUntil) > new Date();
    if (row)
      await tx
        .update(czServicePub)
        .set({
          message,
          status: stillActive ? "active" : "requested",
          requestedAt: new Date(),
        })
        .where(eq(czServicePub.userId, user.id));
    else
      await tx
        .insert(czServicePub)
        .values({ userId: user.id, message, status: "requested" });
    const [store] = await tx
      .select({ name: czStores.name })
      .from(czStores)
      .where(eq(czStores.userId, user.id))
      .limit(1);
    await queueAdminEmail(tx, `service-pub-request:${user.id}:${Date.now()}`, {
      subject: `Nuevo pedido de Service Pub: ${store?.name ?? "una tienda"}`,
      title: "Un vendedor pidió Service Pub",
      paragraphs: [
        `${store?.name ?? "Una tienda"} quiere publicidad personalizada (US$10 al mes).`,
        `Lo que quiere promocionar: «${message}»`,
        "Cuando pague, registra el pago en Administración → Portada → Service Pub.",
      ],
      cta: { label: "Ver pedidos de Service Pub", path: "/admin/portada" },
    });
  });
  return myServicePub(user);
}

export async function cancelServicePub(user: User) {
  const db = await requireDb();
  await db
    .update(czServicePub)
    .set({ status: "cancelled" })
    .where(eq(czServicePub.userId, user.id));
  return myServicePub(user);
}

// ───────────── Administración ─────────────

export async function adminListServicePub() {
  const db = await requireDb();
  const rows = await db
    .select({
      sub: czServicePub,
      storeName: czStores.name,
      storeSlug: czStores.slug,
      logoUrl: czStores.logoUrl,
      email: czApplications.contactEmail,
      phone: czApplications.contactPhone,
      given: czApplications.legalGivenNames,
      surnames: czApplications.legalSurnames,
    })
    .from(czServicePub)
    .leftJoin(czStores, eq(czStores.userId, czServicePub.userId))
    .leftJoin(czApplications, eq(czApplications.userId, czServicePub.userId))
    .orderBy(desc(czServicePub.requestedAt));
  return rows.map(r => ({
    userId: r.sub.userId,
    status: servicePubDisplayStatus(r.sub.status, r.sub.activeUntil),
    message: r.sub.message,
    activeUntil: iso(r.sub.activeUntil),
    requestedAt: iso(r.sub.requestedAt),
    storeName: r.storeName ?? "Tienda sin nombre",
    storeSlug: r.storeSlug ?? null,
    logoUrl: r.logoUrl ?? null,
    sellerName: `${r.given ?? ""} ${r.surnames ?? ""}`.trim(),
    email: r.email ?? "",
    phone: r.phone ?? "",
  }));
}

export async function adminRecordServicePubPayment(
  adminId: number,
  input: RecordServicePubPaymentInput
) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [row] = await tx
      .select()
      .from(czServicePub)
      .where(eq(czServicePub.userId, input.userId))
      .limit(1);
    if (!row) fail("NOT_FOUND", "Ese vendedor no ha pedido Service Pub");
    const activeUntil = extendServicePub(
      row.activeUntil ? new Date(row.activeUntil) : null,
      input.months
    );
    await tx.insert(czServicePubPayments).values({
      userId: input.userId,
      months: input.months,
      amountCents: SERVICE_PUB_MONTHLY_CENTS * input.months,
      method: input.method,
      reference: input.reference || null,
      paidOn: input.paidOn,
      recordedBy: adminId,
    });
    await tx
      .update(czServicePub)
      .set({ status: "active", activeUntil })
      .where(eq(czServicePub.userId, input.userId));
    const until = new Intl.DateTimeFormat("es-PA", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Panama",
    }).format(activeUntil);
    await queueEmail(
      tx,
      `service-pub-paid:${input.userId}:${Date.now()}`,
      await recipientFor(tx, input.userId),
      {
        subject: "Tu Service Pub está activo",
        title: "Recibimos tu pago de Service Pub",
        paragraphs: [
          `Tu publicidad personalizada queda activa hasta el ${until}.`,
          "Te escribiremos para coordinar el diseño de tu anuncio.",
        ],
        cta: { label: "Ver mi plan", path: "/vendedor/plan" },
      }
    );
    return { activeUntil: activeUntil.toISOString() };
  });
}

export async function adminCancelServicePub(userId: number) {
  const db = await requireDb();
  await db
    .update(czServicePub)
    .set({ status: "cancelled" })
    .where(eq(czServicePub.userId, userId));
  return { ok: true };
}
