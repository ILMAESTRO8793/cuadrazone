/*
 * Etapa 4 · Citas de servicios.
 * Reglas compartidas por el servidor y la web: horario semanal, espacios libres
 * y validación. Todo en hora de Panamá (UTC−5, sin horario de verano).
 */
import { z } from "zod";

/** Las citas ocupan bloques de 15 minutos; así se evita que se solapen. */
export const BLOCK_MINUTES = 15;
/** Hasta cuántos días adelante se puede reservar. */
export const BOOKING_DAYS_AHEAD = 30;
/** Anticipación mínima para reservar. */
export const MIN_NOTICE_MINUTES = 60;
/** Citas futuras que un cliente puede tener a la vez con la misma tienda. */
export const MAX_UPCOMING_PER_CLIENT = 3;
/** Duración permitida para servicios con cita. */
export const MIN_BOOKABLE_MINUTES = 15;
export const MAX_BOOKABLE_MINUTES = 8 * 60;

const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const weekdayLabels = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;
/** Orden de la semana en pantalla: lunes primero. */
export const weekdayOrder = [1, 2, 3, 4, 5, 6, 0] as const;

export const appointmentStatuses = [
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];
export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Atendida",
  no_show: "No se presentó",
};

/** «08:30» → 510. */
export function timeToMinute(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
/** 510 → «08:30». */
export function minuteToTime(minute: number): string {
  const h = Math.floor(minute / 60);
  return `${String(h).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** Día en Panamá («2026-11-09») de una fecha. */
export function panamaDayKey(date: Date): string {
  return new Date(date.getTime() - PANAMA_OFFSET_MS).toISOString().slice(0, 10);
}
/** Día de la semana en Panamá (0 = domingo). */
export function panamaWeekday(date: Date): number {
  return new Date(date.getTime() - PANAMA_OFFSET_MS).getUTCDay();
}
/** «2026-11-09» + 510 minutos → Date (8:30 a. m. en Panamá). */
export function panamaDateAt(dayKey: string, minute: number): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(
    Date.UTC(y!, m! - 1, d!) + minute * 60_000 + PANAMA_OFFSET_MS
  );
}

/** Duración que ocupa en la agenda: redondeada hacia arriba a bloques de 15 min. */
export function slotLength(durationMinutes: number): number {
  return Math.ceil(durationMinutes / BLOCK_MINUTES) * BLOCK_MINUTES;
}
/** Cada cuánto se ofrece una hora de inicio: cada 15 min para citas cortas, cada 30 para el resto. */
export function slotStep(durationMinutes: number): number {
  return slotLength(durationMinutes) <= BLOCK_MINUTES ? BLOCK_MINUTES : 30;
}

/** Inicios de los bloques de 15 minutos que ocupa una cita. */
export function blocksFor(start: Date, durationMinutes: number): Date[] {
  const count = slotLength(durationMinutes) / BLOCK_MINUTES;
  return Array.from(
    { length: count },
    (_, i) => new Date(start.getTime() + i * BLOCK_MINUTES * 60_000)
  );
}

export type AvailabilityWindow = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};
export type BusyRange = { start: Date | string; end: Date | string };
export type DaySlots = { day: string; weekday: number; slots: string[] };

/**
 * Espacios libres de los próximos días: dentro del horario, con la anticipación
 * mínima y sin solaparse con citas ya reservadas (de cualquier servicio de la tienda).
 */
export function buildSlots(opts: {
  windows: AvailabilityWindow[];
  durationMinutes: number;
  busy: BusyRange[];
  now: Date;
  days?: number;
  onlyDay?: string;
}): DaySlots[] {
  const length = slotLength(opts.durationMinutes) * 60_000;
  const step = slotStep(opts.durationMinutes);
  const earliest = opts.now.getTime() + MIN_NOTICE_MINUTES * 60_000;
  const busy = opts.busy.map(
    b => [new Date(b.start).getTime(), new Date(b.end).getTime()] as const
  );
  const firstDay = panamaDayKey(opts.now);
  const out: DaySlots[] = [];
  for (let i = 0; i < (opts.days ?? BOOKING_DAYS_AHEAD); i++) {
    const day = panamaDayKey(
      new Date(panamaDateAt(firstDay, 0).getTime() + i * DAY_MS)
    );
    if (opts.onlyDay && day !== opts.onlyDay) continue;
    const weekday = panamaWeekday(panamaDateAt(day, 0));
    const seen = new Set<number>();
    for (const w of opts.windows) {
      if (w.weekday !== weekday) continue;
      for (
        let minute = w.startMinute;
        minute * 60_000 + length <= w.endMinute * 60_000;
        minute += step
      ) {
        const start = panamaDateAt(day, minute).getTime();
        const end = start + length;
        if (start < earliest || seen.has(start)) continue;
        if (busy.some(([bs, be]) => start < be && bs < end)) continue;
        seen.add(start);
      }
    }
    if (seen.size)
      out.push({
        day,
        weekday,
        slots: Array.from(seen)
          .sort((a, b) => a - b)
          .map(t => new Date(t).toISOString()),
      });
  }
  return out;
}

/** ¿Se puede reservar exactamente esa hora? */
export function isOfferedSlot(
  opts: Omit<Parameters<typeof buildSlots>[0], "onlyDay" | "days"> & {
    start: Date;
  }
): boolean {
  const day = panamaDayKey(opts.start);
  const iso = opts.start.toISOString();
  return buildSlots({ ...opts, onlyDay: day }).some(d => d.slots.includes(iso));
}

/** «sábado 14 de noviembre» */
export function dayLabel(dayKey: string): string {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: "America/Panama",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(panamaDateAt(dayKey, 12 * 60));
}
/** «10:30 a. m.» */
export function timeLabel(date: Date | string): string {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: "America/Panama",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

const windowInput = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start: z.string(),
    end: z.string(),
  })
  .strict();

export const saveAvailabilityInput = z
  .object({ windows: z.array(windowInput).max(21) })
  .strict()
  .transform((v, ctx) => {
    const windows: AvailabilityWindow[] = [];
    for (const w of v.windows) {
      const startMinute = timeToMinute(w.start);
      const endMinute =
        timeToMinute(w.end) ?? (w.end === "24:00" ? 1440 : null);
      if (startMinute === null || endMinute === null) {
        ctx.addIssue({
          code: "custom",
          message: "Escribe las horas como 08:00",
        });
        return z.NEVER;
      }
      if (startMinute % BLOCK_MINUTES || endMinute % BLOCK_MINUTES) {
        ctx.addIssue({
          code: "custom",
          message: "Usa horas en punto o cada 15 minutos (8:00, 8:15, 8:30…)",
        });
        return z.NEVER;
      }
      if (endMinute <= startMinute) {
        ctx.addIssue({
          code: "custom",
          message: `${weekdayLabels[w.weekday]}: la hora de cierre debe ser después de la de apertura`,
        });
        return z.NEVER;
      }
      windows.push({ weekday: w.weekday, startMinute, endMinute });
    }
    for (const a of windows)
      for (const b of windows)
        if (
          a !== b &&
          a.weekday === b.weekday &&
          a.startMinute < b.endMinute &&
          b.startMinute < a.endMinute
        ) {
          ctx.addIssue({
            code: "custom",
            message: `${weekdayLabels[a.weekday]}: hay dos horarios que se cruzan`,
          });
          return z.NEVER;
        }
    return { windows };
  });

export const bookAppointmentInput = z
  .object({
    serviceId: z.number().int().positive(),
    startsAt: z.string().datetime(),
    clientName: z.string().trim().min(2, "Escribe tu nombre").max(120),
    clientPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 -]{7,20}$/, "Escribe un celular válido"),
    note: z.string().trim().max(500).default(""),
  })
  .strict();
export type BookAppointmentInput = z.infer<typeof bookAppointmentInput>;
