/*
 * Etapa 4 · Eventos y boletos con QR.
 * Reglas compartidas por el servidor y la web: validación, límites y textos.
 */
import { z } from "zod";
import { provinceOptions } from "./marketplace";

export const MAX_EVENT_IMAGES = 6;
export const MAX_TICKET_TYPES = 6;
export const MAX_TICKETS_PER_ORDER = 10;
/** Horas que se guarda una reserva sin pagar antes de liberar los boletos. */
export const RESERVATION_HOURS = 48;

export const eventStatuses = ["draft", "published", "cancelled"] as const;
export type EventStatus = (typeof eventStatuses)[number];
export const eventStatusLabels: Record<EventStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  cancelled: "Cancelado",
};

export const ticketOrderStatuses = ["reserved", "paid", "cancelled"] as const;
export type TicketOrderStatus = (typeof ticketOrderStatuses)[number];
export const ticketOrderStatusLabels: Record<TicketOrderStatus, string> = {
  reserved: "Apartado · pendiente de pago",
  paid: "Pagado",
  cancelled: "Cancelado",
};

/** «2026-12-20T19:30» (hora de Panamá, UTC−5) → Date. */
export function panamaLocalToDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00-05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → «2026-12-20T19:30» en hora de Panamá, para los campos del formulario. */
export function dateToPanamaLocal(date: Date | string): string {
  const d = new Date(new Date(date).getTime() - 5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

/** «sábado, 20 de diciembre de 2026, 7:30 p. m.» en hora de Panamá. */
export function eventDateLabel(date: Date | string): string {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: "America/Panama",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function moneyLabel(cents: number): string {
  return cents === 0 ? "Gratis" : `US$${(cents / 100).toFixed(2)}`;
}

const ticketTypeInput = z
  .object({
    id: z.number().int().positive().optional(),
    name: z.string().trim().min(1, "Escribe el nombre de la entrada").max(60),
    priceCents: z.number().int().min(0).max(1_000_000),
    capacity: z
      .number()
      .int()
      .min(1, "La capacidad debe ser al menos 1")
      .max(100_000),
  })
  .strict();

export const saveEventInput = z
  .object({
    id: z.number().int().positive().optional(),
    expectedRevision: z.number().int().min(0).optional(),
    title: z.string().trim().min(3, "Escribe el nombre del evento").max(140),
    artist: z.string().trim().max(140).default(""),
    description: z
      .string()
      .trim()
      .min(10, "Describe el evento (al menos 10 caracteres)")
      .max(5000),
    startsAt: z
      .string()
      .refine(v => panamaLocalToDate(v) !== null, "Fecha y hora inválidas"),
    endsAt: z
      .string()
      .default("")
      .refine(
        v => v === "" || panamaLocalToDate(v) !== null,
        "Hora de fin inválida"
      ),
    venueName: z.string().trim().min(2, "Escribe el lugar").max(140),
    address: z.string().trim().max(240).default(""),
    province: z.enum(provinceOptions),
    city: z.string().trim().max(80).default(""),
    mapUrl: z
      .string()
      .trim()
      .max(500)
      .default("")
      .refine(
        v => v === "" || /^https:\/\//.test(v),
        "El enlace del mapa debe empezar por https://"
      ),
    ticketTypes: z
      .array(ticketTypeInput)
      .min(1, "Agrega al menos un tipo de entrada")
      .max(MAX_TICKET_TYPES),
    images: z.array(z.string()).max(MAX_EVENT_IMAGES).default([]),
  })
  .strict()
  .refine(
    v => {
      const start = panamaLocalToDate(v.startsAt);
      const end = v.endsAt ? panamaLocalToDate(v.endsAt) : null;
      return !start || !end || end > start;
    },
    { message: "La hora de fin debe ser después del inicio", path: ["endsAt"] }
  );
export type SaveEventInput = z.infer<typeof saveEventInput>;

export const reserveTicketsInput = z
  .object({
    ticketTypeId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(MAX_TICKETS_PER_ORDER),
    buyerName: z.string().trim().min(2, "Escribe tu nombre").max(120),
    buyerPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 -]{7,20}$/, "Escribe un celular válido"),
  })
  .strict();
export type ReserveTicketsInput = z.infer<typeof reserveTicketsInput>;

export const eventFiltersInput = z
  .object({
    q: z.string().trim().max(120).optional(),
    province: z.enum(provinceOptions).optional(),
    page: z.number().int().min(1).max(500).default(1),
  })
  .strict();
export type EventFilters = z.infer<typeof eventFiltersInput>;

export type TicketTypeDTO = {
  id: number;
  name: string;
  priceCents: number;
  capacity: number;
  available: number;
};

export type EventDTO = {
  id: number;
  slug: string;
  status: EventStatus;
  title: string;
  artist: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
  address: string;
  province: string;
  city: string;
  mapUrl: string;
  images: string[];
  ticketTypes: TicketTypeDTO[];
  minPriceCents: number;
  soldOut: boolean;
  store: { name: string; slug: string };
};

export type OwnEventDTO = EventDTO & {
  revision: number;
  stats: { reserved: number; paid: number; used: number; capacity: number };
};

/** Código de boleto: 20 caracteres sin letras que se confunden (sin 0/O, 1/I). */
export const TICKET_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function isTicketCode(value: string): boolean {
  return /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{20}$/.test(value);
}
/** Lo que contiene el QR de cada boleto. */
export function ticketQrPayload(code: string): string {
  return `CZT:${code}`;
}
/** Acepta el código solo o el texto que trae el QR («CZT:CODIGO»). */
export function parseTicketScan(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/^CZT:/, "")
    .replace(/[\s-]/g, "");
  return isTicketCode(cleaned) ? cleaned : null;
}
