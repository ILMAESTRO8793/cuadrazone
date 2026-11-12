/*
 * Reseñas de servicios, bienes raíces, autos y empleos. Solo reseña quien tuvo
 * contacto real: solicitó o agendó el servicio, tocó WhatsApp/Llamar en el
 * inmueble o el auto, o se postuló a la vacante. Una reseña por persona y
 * anuncio; se puede editar.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import {
  czAppointments,
  czJobApplications,
  czJobs,
  czProperties,
  czServiceRequests,
  czServices,
  czVehicles,
} from "../../drizzle/catalog-schema";
import {
  czListingContacts,
  czListingReviews,
} from "../../drizzle/reviews-schema";
import type { User } from "../../drizzle/schema";
import {
  averageRating,
  reviewAuthorLabel,
  type ReviewKind,
  type SaveListingReviewInput,
} from "@shared/listingReviews";
import { getDb } from "../db";

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
type Db = Awaited<ReturnType<typeof requireDb>>;

const tables = {
  servicio: { table: czServices, title: czServices.title },
  inmueble: { table: czProperties, title: czProperties.title },
  auto: { table: czVehicles, title: czVehicles.title },
  empleo: { table: czJobs, title: czJobs.title },
} as const;

/** Dueño del anuncio (falla si no existe). */
async function listingOwner(db: Db, kind: ReviewKind, listingId: number) {
  const t = tables[kind].table as typeof czServices;
  const rows = await db
    .select({ userId: t.userId })
    .from(t)
    .where(eq(t.id, listingId))
    .limit(1);
  if (!rows[0]) fail("NOT_FOUND", "El anuncio no existe");
  return rows[0].userId;
}

/** ¿Tuvo contacto real con este anuncio? */
async function hadContact(
  db: Db,
  kind: ReviewKind,
  listingId: number,
  userId: number
) {
  if (kind === "servicio") {
    const [request] = await db
      .select({ id: czServiceRequests.id })
      .from(czServiceRequests)
      .where(
        and(
          eq(czServiceRequests.serviceId, listingId),
          eq(czServiceRequests.requesterUserId, userId)
        )
      )
      .limit(1);
    if (request) return true;
    const [appointment] = await db
      .select({ id: czAppointments.id })
      .from(czAppointments)
      .where(
        and(
          eq(czAppointments.serviceId, listingId),
          eq(czAppointments.clientUserId, userId)
        )
      )
      .limit(1);
    return Boolean(appointment);
  }
  if (kind === "empleo") {
    const [application] = await db
      .select({ id: czJobApplications.id })
      .from(czJobApplications)
      .where(
        and(
          eq(czJobApplications.jobId, listingId),
          eq(czJobApplications.applicantUserId, userId)
        )
      )
      .limit(1);
    return Boolean(application);
  }
  const [contact] = await db
    .select({ id: czListingContacts.id })
    .from(czListingContacts)
    .where(
      and(
        eq(czListingContacts.kind, kind),
        eq(czListingContacts.listingId, listingId),
        eq(czListingContacts.userId, userId)
      )
    )
    .limit(1);
  return Boolean(contact);
}

/** Reseñas visibles de un anuncio, con promedio. */
export async function listListingReviews(kind: ReviewKind, listingId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: czListingReviews.id,
      rating: czListingReviews.rating,
      body: czListingReviews.body,
      createdAt: czListingReviews.createdAt,
    })
    .from(czListingReviews)
    .where(
      and(
        eq(czListingReviews.kind, kind),
        eq(czListingReviews.listingId, listingId),
        isNull(czListingReviews.hiddenAt)
      )
    )
    .orderBy(desc(czListingReviews.createdAt))
    .limit(100);
  return {
    average: averageRating(rows.map(r => r.rating)),
    count: rows.length,
    reviews: rows.map(r => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: new Date(r.createdAt).toISOString(),
      author: reviewAuthorLabel[kind],
    })),
  };
}

/** ¿Puede reseñar? Y su reseña, si ya la dejó. */
export async function listingReviewEligibility(
  user: User,
  kind: ReviewKind,
  listingId: number
) {
  const db = await requireDb();
  const owner = await listingOwner(db, kind, listingId);
  const [mine] = await db
    .select({ rating: czListingReviews.rating, body: czListingReviews.body })
    .from(czListingReviews)
    .where(
      and(
        eq(czListingReviews.kind, kind),
        eq(czListingReviews.listingId, listingId),
        eq(czListingReviews.reviewerUserId, user.id)
      )
    )
    .limit(1);
  if (owner === user.id) return { canReview: false, isOwner: true, mine: null };
  return {
    canReview: await hadContact(db, kind, listingId, user.id),
    isOwner: false,
    mine: mine ?? null,
  };
}

/** Crea o actualiza la reseña de esta persona para este anuncio. */
export async function saveListingReview(
  user: User,
  input: SaveListingReviewInput
) {
  const db = await requireDb();
  const owner = await listingOwner(db, input.kind, input.listingId);
  if (owner === user.id)
    fail("FORBIDDEN", "No puedes reseñar tu propio anuncio");
  if (!(await hadContact(db, input.kind, input.listingId, user.id)))
    fail(
      "FORBIDDEN",
      "Solo puedes reseñar después de haber tenido contacto con este anuncio"
    );
  await db
    .insert(czListingReviews)
    .values({
      kind: input.kind,
      listingId: input.listingId,
      ownerUserId: owner,
      reviewerUserId: user.id,
      rating: input.rating,
      body: input.body,
    })
    .onDuplicateKeyUpdate({ set: { rating: input.rating, body: input.body } });
  return listingReviewEligibility(user, input.kind, input.listingId);
}

/** Guarda que la persona contactó un inmueble o un auto (para poder reseñarlo). */
export async function recordListingContact(
  user: User,
  kind: "inmueble" | "auto",
  listingId: number
) {
  const db = await requireDb();
  const owner = await listingOwner(db, kind, listingId);
  if (owner === user.id) return { ok: true };
  await db
    .insert(czListingContacts)
    .values({ kind, listingId, userId: user.id })
    .onDuplicateKeyUpdate({ set: { kind } });
  return { ok: true };
}

// ───────────── Administración ─────────────

export async function adminListListingReviews(q: string) {
  const db = await requireDb();
  const term = `%${q.trim()}%`;
  const rows = await db
    .select({
      id: czListingReviews.id,
      kind: czListingReviews.kind,
      listingId: czListingReviews.listingId,
      rating: czListingReviews.rating,
      body: czListingReviews.body,
      hiddenAt: czListingReviews.hiddenAt,
      hiddenReason: czListingReviews.hiddenReason,
      createdAt: czListingReviews.createdAt,
    })
    .from(czListingReviews)
    .where(
      q.trim()
        ? or(
            like(czListingReviews.body, term),
            sql`${czListingReviews.kind} = ${q.trim()}`
          )
        : undefined
    )
    .orderBy(desc(czListingReviews.createdAt))
    .limit(100);
  return rows.map(r => ({
    ...r,
    kind: r.kind as ReviewKind,
    hiddenAt: r.hiddenAt ? new Date(r.hiddenAt).toISOString() : null,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}

export async function adminModerateListingReview(
  id: number,
  hide: boolean,
  reason: string
) {
  const db = await requireDb();
  if (hide && reason.trim().length < 5)
    fail("BAD_REQUEST", "Escribe el motivo (al menos 5 caracteres)");
  await db
    .update(czListingReviews)
    .set(
      hide
        ? { hiddenAt: new Date(), hiddenReason: reason.trim().slice(0, 300) }
        : { hiddenAt: null, hiddenReason: null }
    )
    .where(eq(czListingReviews.id, id));
  return { ok: true };
}
