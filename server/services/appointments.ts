// Etapa 4 · Citas de servicios.
// El proveedor (tienda de servicios aprobada y con plan activo) define su horario
// semanal y activa «Reservar cita» en los servicios que tienen duración. El
// cliente elige un espacio libre y la cita queda confirmada al instante. Cada
// cita ocupa bloques de 15 minutos con clave única (tienda, bloque): dos citas
// de la misma tienda nunca se solapan, aunque se reserven en el mismo instante.
// El pago se acuerda con el proveedor; los servicios no pagan comisión.
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import {
  czAppointmentBlocks,
  czAppointments,
  czServiceAvailability,
  czServices,
  czStores,
} from "../../drizzle/catalog-schema";
import {
  czApplications,
  czMembershipProfiles,
  type User,
} from "../../drizzle/schema";
import {
  BOOKING_DAYS_AHEAD,
  MAX_BOOKABLE_MINUTES,
  MAX_UPCOMING_PER_CLIENT,
  MIN_BOOKABLE_MINUTES,
  blocksFor,
  bookAppointmentInput,
  buildSlots,
  isOfferedSlot,
  minuteToTime,
  saveAvailabilityInput,
  slotLength,
  timeLabel,
  dayLabel,
  panamaDayKey,
  type AppointmentStatus,
  type AvailabilityWindow,
} from "@shared/appointments";
import { servicePriceLabel } from "@shared/services";
import { getDb } from "../db";
import { queueEmail, recipientFor } from "./email";
import { isDuplicateKeyError } from "./subscriptions";

const DAY_MS = 24 * 60 * 60 * 1000;

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
const when = (d: Date | string) =>
  `${dayLabel(panamaDayKey(new Date(d)))}, ${timeLabel(d)}`;

async function providerStore(db: any, userId: number) {
  const rows = await db
    .select({ store: czStores, app: czApplications })
    .from(czStores)
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(eq(czStores.userId, userId))
    .limit(1);
  const found = rows[0] as { store: any; app: any } | undefined;
  if (!found)
    fail("PRECONDITION_FAILED", "Primero guarda la información de tu tienda");
  if (found.store.storeKind !== "servicios")
    fail("PRECONDITION_FAILED", "Las citas son para tiendas de servicios");
  return found;
}

async function windowsFor(
  db: any,
  storeId: number
): Promise<AvailabilityWindow[]> {
  const rows = await db
    .select({
      weekday: czServiceAvailability.weekday,
      startMinute: czServiceAvailability.startMinute,
      endMinute: czServiceAvailability.endMinute,
    })
    .from(czServiceAvailability)
    .where(eq(czServiceAvailability.storeId, storeId))
    .orderBy(
      asc(czServiceAvailability.weekday),
      asc(czServiceAvailability.startMinute)
    );
  return rows.map((r: any) => ({
    weekday: Number(r.weekday),
    startMinute: Number(r.startMinute),
    endMinute: Number(r.endMinute),
  }));
}

/** Citas confirmadas de la tienda que pueden chocar con el período dado. */
async function busyFor(db: any, storeId: number, from: Date, to: Date) {
  return (await db
    .select({ start: czAppointments.startsAt, end: czAppointments.endsAt })
    .from(czAppointments)
    .where(
      and(
        eq(czAppointments.storeId, storeId),
        eq(czAppointments.status, "confirmed"),
        lt(czAppointments.startsAt, to),
        gt(czAppointments.endsAt, from)
      )
    )) as Array<{ start: Date; end: Date }>;
}

// ───────────── Proveedor: horario y servicios con cita ─────────────

export async function getAvailability(user: User) {
  const db = await requireDb();
  const { store } = await providerStore(db, user.id);
  const services = await db
    .select({
      id: czServices.id,
      title: czServices.title,
      durationMinutes: czServices.durationMinutes,
      bookable: czServices.bookable,
      status: czServices.status,
    })
    .from(czServices)
    .where(eq(czServices.storeId, store.id))
    .orderBy(asc(czServices.title));
  return {
    windows: (await windowsFor(db, store.id)).map(w => ({
      weekday: w.weekday,
      start: minuteToTime(w.startMinute),
      end: w.endMinute === 1440 ? "24:00" : minuteToTime(w.endMinute),
    })),
    services: services.map((s: any) => ({
      ...s,
      bookable: Boolean(s.bookable),
    })),
  };
}

export async function saveAvailability(user: User, raw: unknown) {
  const parsed = saveAvailabilityInput.safeParse(raw);
  if (!parsed.success)
    fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Horario inválido");
  const db = await requireDb();
  const { store } = await providerStore(db, user.id);
  await db.transaction(async (tx: any) => {
    await tx
      .delete(czServiceAvailability)
      .where(eq(czServiceAvailability.storeId, store.id));
    if (parsed.data.windows.length)
      await tx
        .insert(czServiceAvailability)
        .values(parsed.data.windows.map(w => ({ storeId: store.id, ...w })));
    // Sin horario no hay citas: se apagan para que nadie vea un calendario vacío.
    if (!parsed.data.windows.length)
      await tx
        .update(czServices)
        .set({ bookable: false })
        .where(eq(czServices.storeId, store.id));
  });
  return { windows: parsed.data.windows.length };
}

export async function setServiceBookable(
  user: User,
  serviceId: number,
  bookable: boolean
) {
  const db = await requireDb();
  const { store } = await providerStore(db, user.id);
  const rows = await db
    .select()
    .from(czServices)
    .where(and(eq(czServices.id, serviceId), eq(czServices.storeId, store.id)))
    .limit(1);
  const service = rows[0];
  if (!service) fail("NOT_FOUND", "El servicio no existe");
  if (bookable) {
    const d = service.durationMinutes;
    if (!d || d < MIN_BOOKABLE_MINUTES || d > MAX_BOOKABLE_MINUTES)
      fail(
        "PRECONDITION_FAILED",
        "Para recibir citas, indica en el servicio una duración entre 15 minutos y 8 horas"
      );
    if (!(await windowsFor(db, store.id)).length)
      fail("PRECONDITION_FAILED", "Primero define tu horario de atención");
  }
  await db
    .update(czServices)
    .set({ bookable })
    .where(eq(czServices.id, serviceId));
  return { bookable };
}

// ───────────── Cliente: ver horas libres y reservar ─────────────

/** Servicio que hoy acepta citas, con su tienda. */
async function bookableService(db: any, serviceId: number) {
  const rows = await db
    .select({ service: czServices, store: czStores, app: czApplications })
    .from(czServices)
    .innerJoin(czStores, eq(czStores.id, czServices.storeId))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    )
    .where(
      and(
        eq(czServices.id, serviceId),
        eq(czServices.status, "published"),
        eq(czServices.bookable, true),
        eq(czApplications.status, "approved"),
        eq(czApplications.subscriptionStatus, "active"),
        isNotNull(czMembershipProfiles.emailVerifiedAt)
      )
    )
    .limit(1);
  const found = rows[0] as { service: any; store: any; app: any } | undefined;
  if (!found || !found.service.durationMinutes)
    fail("NOT_FOUND", "Este servicio no recibe citas en este momento");
  return found;
}

export async function serviceSlots(serviceId: number, now = new Date()) {
  const db = await requireDb();
  const { service, store } = await bookableService(db, serviceId);
  const windows = await windowsFor(db, store.id);
  const busy = await busyFor(
    db,
    store.id,
    now,
    new Date(now.getTime() + (BOOKING_DAYS_AHEAD + 1) * DAY_MS)
  );
  return {
    durationMinutes: service.durationMinutes as number,
    days: buildSlots({
      windows,
      durationMinutes: service.durationMinutes,
      busy,
      now,
    }),
  };
}

export async function bookAppointment(
  user: User,
  raw: unknown,
  now = new Date()
) {
  const parsed = bookAppointmentInput.safeParse(raw);
  if (!parsed.success)
    fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const v = parsed.data;
  const db = await requireDb();
  const { service, store } = await bookableService(db, v.serviceId);
  if (store.userId === user.id)
    fail("BAD_REQUEST", "No puedes reservar una cita en tu propia tienda");
  const start = new Date(v.startsAt);
  const minutes = slotLength(service.durationMinutes);
  const end = new Date(start.getTime() + minutes * 60_000);
  const windows = await windowsFor(db, store.id);
  const busy = await busyFor(
    db,
    store.id,
    new Date(start.getTime() - DAY_MS),
    new Date(end.getTime() + DAY_MS)
  );
  if (
    !isOfferedSlot({
      windows,
      durationMinutes: service.durationMinutes,
      busy,
      now,
      start,
    })
  )
    fail("CONFLICT", "Esa hora ya no está disponible. Elige otra.");

  const upcoming = await db
    .select({ n: sql<number>`count(*)` })
    .from(czAppointments)
    .where(
      and(
        eq(czAppointments.storeId, store.id),
        eq(czAppointments.clientUserId, user.id),
        eq(czAppointments.status, "confirmed"),
        gt(czAppointments.startsAt, now)
      )
    );
  if (Number(upcoming[0]?.n ?? 0) >= MAX_UPCOMING_PER_CLIENT)
    fail(
      "TOO_MANY_REQUESTS",
      `Ya tienes ${MAX_UPCOMING_PER_CLIENT} citas próximas con esta tienda. Cancela una antes de reservar otra.`
    );

  try {
    return await db.transaction(async (tx: any) => {
      const inserted = await tx.insert(czAppointments).values({
        serviceId: service.id,
        storeId: store.id,
        providerUserId: store.userId,
        clientUserId: user.id,
        serviceTitle: service.title,
        priceLabel: servicePriceLabel(service),
        startsAt: start,
        endsAt: end,
        clientName: v.clientName,
        clientPhone: v.clientPhone,
        note: v.note,
      });
      const id = insertId(inserted);
      if (!id) fail("INTERNAL_SERVER_ERROR", "No se pudo guardar la cita");
      // Si otra persona tomó cualquiera de estos bloques, la clave única lo rechaza y todo se deshace.
      await tx
        .insert(czAppointmentBlocks)
        .values(
          blocksFor(start, service.durationMinutes).map(blockStart => ({
            storeId: store.id,
            blockStart,
            appointmentId: id,
          }))
        );
      const details: Array<[string, string]> = [
        ["Servicio", service.title],
        ["Fecha", when(start)],
        ["Precio", servicePriceLabel(service)],
      ];
      await queueEmail(
        tx,
        `appointment-booked:${id}`,
        await recipientFor(tx, store.userId),
        {
          subject: `Nueva cita: ${service.title}`,
          title: "Tienes una nueva cita",
          paragraphs: [
            `${v.clientName} (${v.clientPhone}) reservó «${service.title}».`,
            ...(v.note ? [`Nota del cliente: «${v.note}»`] : []),
          ],
          details,
          cta: { label: "Ver mi agenda", path: "/vendedor/agenda" },
        }
      );
      await queueEmail(
        tx,
        `appointment-confirmed:${id}`,
        await recipientFor(tx, user.id),
        {
          subject: `Cita confirmada: ${service.title}`,
          title: "Tu cita está confirmada",
          paragraphs: [
            `${store.name} te espera. Si no puedes asistir, cancélala desde «Mis citas» para liberar la hora.`,
            "El pago se acuerda directamente con el proveedor.",
          ],
          details,
          cta: { label: "Ver mis citas", path: "/mis-citas" },
        }
      );
      return { id, startsAt: start.toISOString(), endsAt: end.toISOString() };
    });
  } catch (error) {
    if (isDuplicateKeyError(error))
      fail("CONFLICT", "Alguien acaba de reservar esa hora. Elige otra.");
    throw error;
  }
}

// ───────────── Listas ─────────────

function appointmentDto(
  row: any,
  extra: {
    storeName?: string;
    storeSlug?: string;
    storePhone?: string | null;
    serviceSlug?: string;
  } = {}
) {
  return {
    id: row.id as number,
    serviceTitle: row.serviceTitle as string,
    priceLabel: row.priceLabel as string,
    startsAt: new Date(row.startsAt).toISOString(),
    endsAt: new Date(row.endsAt).toISOString(),
    status: row.status as AppointmentStatus,
    clientName: row.clientName as string,
    clientPhone: row.clientPhone as string,
    note: row.note as string,
    cancelledBy: (row.cancelledBy ?? null) as "client" | "provider" | null,
    cancelReason: (row.cancelReason ?? null) as string | null,
    ...extra,
  };
}

export async function myAppointments(user: User) {
  const db = await requireDb();
  const rows = await db
    .select({
      appointment: czAppointments,
      storeName: czStores.name,
      storeSlug: czStores.slug,
      phone: czApplications.contactPhone,
      serviceSlug: czServices.slug,
    })
    .from(czAppointments)
    .innerJoin(czStores, eq(czStores.id, czAppointments.storeId))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(czServices, eq(czServices.id, czAppointments.serviceId))
    .where(eq(czAppointments.clientUserId, user.id))
    .orderBy(desc(czAppointments.startsAt))
    .limit(100);
  return rows.map((r: any) =>
    appointmentDto(r.appointment, {
      storeName: r.storeName,
      storeSlug: r.storeSlug,
      storePhone: r.phone ?? null,
      serviceSlug: r.serviceSlug,
    })
  );
}

/** Agenda del proveedor: desde hace 7 días en adelante. */
export async function providerAgenda(user: User, now = new Date()) {
  const db = await requireDb();
  const { store } = await providerStore(db, user.id);
  const rows = await db
    .select()
    .from(czAppointments)
    .where(
      and(
        eq(czAppointments.storeId, store.id),
        gte(czAppointments.startsAt, new Date(now.getTime() - 7 * DAY_MS))
      )
    )
    .orderBy(asc(czAppointments.startsAt))
    .limit(500);
  return rows.map((r: any) => appointmentDto(r));
}

// ───────────── Cancelar y cerrar ─────────────

async function loadAppointment(tx: any, id: number) {
  const rows = await tx
    .select()
    .from(czAppointments)
    .where(eq(czAppointments.id, id))
    .for("update")
    .limit(1);
  if (!rows[0]) fail("NOT_FOUND", "La cita no existe");
  return rows[0];
}

export async function cancelAppointment(
  user: User,
  id: number,
  reason: string,
  now = new Date()
) {
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const a = await loadAppointment(tx, id);
    const provider = a.providerUserId === user.id;
    const client = a.clientUserId === user.id;
    if (!provider && !client) fail("NOT_FOUND", "La cita no existe");
    if (a.status === "cancelled") return { status: "cancelled" as const };
    if (a.status !== "confirmed")
      fail("PRECONDITION_FAILED", "Esta cita ya se cerró");
    if (!provider && new Date(a.startsAt) <= now)
      fail("PRECONDITION_FAILED", "La cita ya empezó; habla con el proveedor");
    const result = await tx
      .update(czAppointments)
      .set({
        status: "cancelled",
        cancelledBy: provider ? "provider" : "client",
        cancelReason: reason.trim().slice(0, 300) || null,
        cancelledAt: now,
      })
      .where(
        and(eq(czAppointments.id, id), eq(czAppointments.status, "confirmed"))
      );
    if (!changed(result)) fail("CONFLICT", "La cita cambió. Recarga la lista.");
    // Libera la hora para otros clientes.
    await tx
      .delete(czAppointmentBlocks)
      .where(eq(czAppointmentBlocks.appointmentId, id));
    await queueEmail(
      tx,
      `appointment-cancelled:${id}`,
      await recipientFor(tx, provider ? a.clientUserId : a.providerUserId),
      {
        subject: `Cita cancelada: ${a.serviceTitle}`,
        title: "Se canceló una cita",
        paragraphs: [
          provider
            ? `El proveedor canceló tu cita de «${a.serviceTitle}» del ${when(a.startsAt)}.`
            : `${a.clientName} canceló su cita de «${a.serviceTitle}» del ${when(a.startsAt)}. Esa hora quedó libre.`,
          ...(reason.trim()
            ? [`Motivo: «${reason.trim().slice(0, 300)}»`]
            : []),
        ],
        cta: provider
          ? { label: "Reservar otra hora", path: "/mis-citas" }
          : { label: "Ver mi agenda", path: "/vendedor/agenda" },
      }
    );
    return { status: "cancelled" as const };
  });
}

export async function closeAppointment(
  user: User,
  id: number,
  status: "completed" | "no_show",
  now = new Date()
) {
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const a = await loadAppointment(tx, id);
    if (a.providerUserId !== user.id) fail("NOT_FOUND", "La cita no existe");
    if (a.status !== "confirmed")
      fail("PRECONDITION_FAILED", "Esta cita ya se cerró");
    if (new Date(a.startsAt) > now)
      fail(
        "PRECONDITION_FAILED",
        "Podrás marcarla cuando llegue la hora de la cita"
      );
    await tx
      .update(czAppointments)
      .set({ status })
      .where(
        and(eq(czAppointments.id, id), eq(czAppointments.status, "confirmed"))
      );
    return { status };
  });
}

/** Recordatorio al cliente un día antes. Devuelve cuántos envió. */
export async function sweepAppointmentReminders(
  now = new Date()
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const due = (await db
    .select()
    .from(czAppointments)
    .where(
      and(
        eq(czAppointments.status, "confirmed"),
        isNull(czAppointments.reminderSentAt),
        gt(czAppointments.startsAt, now),
        lte(czAppointments.startsAt, new Date(now.getTime() + DAY_MS))
      )
    )
    .limit(200)) as any[];
  let sent = 0;
  for (const a of due) {
    try {
      await db.transaction(async (tx: any) => {
        const marked = await tx
          .update(czAppointments)
          .set({ reminderSentAt: now })
          .where(
            and(
              eq(czAppointments.id, a.id),
              isNull(czAppointments.reminderSentAt),
              eq(czAppointments.status, "confirmed")
            )
          );
        if (!changed(marked)) return;
        sent++;
        await queueEmail(
          tx,
          `appointment-reminder:${a.id}`,
          await recipientFor(tx, a.clientUserId),
          {
            subject: `Recordatorio: ${a.serviceTitle}`,
            title: "Tu cita es pronto",
            paragraphs: [
              `Te recordamos tu cita de «${a.serviceTitle}» el ${when(a.startsAt)}.`,
              "Si no puedes asistir, cancélala desde «Mis citas» para liberar la hora.",
            ],
            cta: { label: "Ver mis citas", path: "/mis-citas" },
          }
        );
      });
    } catch (error) {
      console.error(
        `[Citas] Recordatorio ${a.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  return sent;
}
