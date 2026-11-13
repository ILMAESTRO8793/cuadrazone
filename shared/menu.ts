import { z } from "zod";

/*
 * Menú de restaurante: secciones, platos con tamaños, combos (elige
 * acompañante y bebida), «quitar» ingredientes y extras con precio.
 */

export const weekDays = [
  "lun",
  "mar",
  "mie",
  "jue",
  "vie",
  "sab",
  "dom",
] as const;
export type WeekDay = (typeof weekDays)[number];
export const weekDayLabels: Record<WeekDay, string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
  dom: "Domingo",
};

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
/** Horario de un día; null = cerrado. Si cierra después de medianoche, `close` < `open`. */
export const dayHours = z
  .object({ open: hhmm, close: hhmm })
  .strict()
  .nullable();
export type DayHours = z.infer<typeof dayHours>;
export const weekHours = z
  .object(
    Object.fromEntries(weekDays.map(d => [d, dayHours])) as Record<
      WeekDay,
      typeof dayHours
    >
  )
  .strict();
export type WeekHours = z.infer<typeof weekHours>;

export const defaultWeekHours: WeekHours = {
  lun: { open: "11:00", close: "21:00" },
  mar: { open: "11:00", close: "21:00" },
  mie: { open: "11:00", close: "21:00" },
  jue: { open: "11:00", close: "21:00" },
  vie: { open: "11:00", close: "22:00" },
  sab: { open: "11:00", close: "22:00" },
  dom: null,
};

const money = z.number().int().min(0).max(100_000);

export const menuSize = z
  .object({ name: z.string().trim().min(1).max(30), priceCents: money })
  .strict();
export type MenuSize = z.infer<typeof menuSize>;

export const menuOption = z
  .object({ name: z.string().trim().min(1).max(50), priceCents: money })
  .strict();
export type MenuOption = z.infer<typeof menuOption>;

/** choice: elige entre opciones (acompañante, bebida). remove: quitar ingredientes (gratis). extra: agregar con precio. */
export const optionGroupKinds = ["choice", "remove", "extra"] as const;
export type OptionGroupKind = (typeof optionGroupKinds)[number];
export const optionGroupKindLabels: Record<OptionGroupKind, string> = {
  choice: "Elige (acompañante, bebida…)",
  remove: "Quitar ingredientes",
  extra: "Extras con precio",
};

export const menuOptionGroup = z
  .object({
    name: z.string().trim().min(1).max(40),
    kind: z.enum(optionGroupKinds),
    /** Mínimo y máximo de opciones que el cliente puede marcar. */
    min: z.number().int().min(0).max(10),
    max: z.number().int().min(1).max(10),
    options: z.array(menuOption).min(1).max(20),
  })
  .strict()
  .refine(g => g.min <= g.max, {
    message: "El mínimo no puede ser mayor que el máximo",
  })
  .refine(g => g.max <= g.options.length, {
    message: "El máximo no puede superar las opciones",
  })
  .refine(
    g => g.kind !== "remove" || g.options.every(o => o.priceCents === 0),
    {
      message: "Quitar ingredientes no tiene precio",
    }
  );
export type MenuOptionGroup = z.infer<typeof menuOptionGroup>;

export const menuTags = [
  "nuevo",
  "picante",
  "vegetariano",
  "sin gluten",
  "favorito",
] as const;

export const saveRestaurantInput = z
  .object({
    enabled: z.boolean(),
    prepMinutes: z.number().int().min(5).max(180),
    hours: weekHours,
  })
  .strict();

export const saveSectionInput = z
  .object({
    id: z.number().int().positive().optional(),
    name: z.string().trim().min(1, "Escribe el nombre de la sección").max(60),
    sortOrder: z.number().int().min(0).max(999).default(0),
  })
  .strict();

export const saveMenuItemInput = z
  .object({
    id: z.number().int().positive().optional(),
    sectionId: z.number().int().positive(),
    name: z.string().trim().min(1, "Escribe el nombre del plato").max(80),
    description: z.string().trim().max(500).default(""),
    priceCents: money.refine(v => v > 0, "Pon el precio"),
    available: z.boolean().default(true),
    tags: z.array(z.enum(menuTags)).max(5).default([]),
    sizes: z.array(menuSize).max(5).default([]),
    optionGroups: z.array(menuOptionGroup).max(8).default([]),
    sortOrder: z.number().int().min(0).max(999).default(0),
  })
  .strict();
export type SaveMenuItemInput = z.infer<typeof saveMenuItemInput>;

export type PublicMenuItem = {
  id: number;
  sectionId: number;
  name: string;
  description: string;
  imageUrl: string | null;
  priceCents: number;
  available: boolean;
  tags: string[];
  sizes: MenuSize[];
  optionGroups: MenuOptionGroup[];
};

// ── Horario (siempre en hora de Panamá) ──

function panamaNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Panama",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  const map: Record<string, WeekDay> = {
    Mon: "lun",
    Tue: "mar",
    Wed: "mie",
    Thu: "jue",
    Fri: "vie",
    Sat: "sab",
    Sun: "dom",
  };
  return {
    day: map[get("weekday")] ?? "lun",
    time: `${get("hour")}:${get("minute")}`,
  };
}

const prevDay = (d: WeekDay) => weekDays[(weekDays.indexOf(d) + 6) % 7]!;
const nextDay = (d: WeekDay) => weekDays[(weekDays.indexOf(d) + 1) % 7]!;

/** ¿Está abierto ahora? Y si no, cuándo abre («hoy a las 11:00», «el lunes a las 07:00»). */
export function openStatus(hours: WeekHours, now = new Date()) {
  const { day, time } = panamaNow(now);
  const today = hours[day];
  if (today) {
    const overnight = today.close < today.open;
    if (
      overnight
        ? time >= today.open || time < today.close
        : time >= today.open && time < today.close
    )
      return { open: true as const, closesAt: today.close };
  }
  // Cierra pasada la medianoche del día anterior.
  const yesterday = hours[prevDay(day)];
  if (yesterday && yesterday.close < yesterday.open && time < yesterday.close)
    return { open: true as const, closesAt: yesterday.close };
  if (today && time < today.open)
    return { open: false as const, opensLabel: `hoy a las ${today.open}` };
  let d = nextDay(day);
  for (let i = 0; i < 7; i++, d = nextDay(d)) {
    const h = hours[d];
    if (h)
      return {
        open: false as const,
        opensLabel: `${i === 0 ? "mañana" : `el ${weekDayLabels[d].toLowerCase()}`} a las ${h.open}`,
      };
  }
  return { open: false as const, opensLabel: "" };
}

// ── Precio de un plato con lo que eligió el cliente ──

export type MenuSelection = {
  /** Índice del tamaño (si el plato tiene tamaños). */
  size?: number;
  /** Por grupo (mismo orden que optionGroups): índices de opciones marcadas. */
  groups: number[][];
};

/** Precio unitario y si la selección cumple los mínimos y máximos de cada grupo. */
export function priceFor(
  item: Pick<PublicMenuItem, "priceCents" | "sizes" | "optionGroups">,
  sel: MenuSelection
) {
  const errors: string[] = [];
  let cents = item.priceCents;
  if (item.sizes.length) {
    const size = item.sizes[sel.size ?? -1];
    if (!size) errors.push("Elige un tamaño");
    else cents = size.priceCents;
  }
  item.optionGroups.forEach((g, gi) => {
    const picked = Array.from(new Set(sel.groups[gi] ?? [])).filter(
      i => i >= 0 && i < g.options.length
    );
    if (picked.length < g.min)
      errors.push(
        g.min === 1
          ? `Elige ${g.name.toLowerCase()}`
          : `Elige al menos ${g.min} en ${g.name}`
      );
    if (picked.length > g.max) errors.push(`Máximo ${g.max} en ${g.name}`);
    for (const i of picked) cents += g.options[i]!.priceCents;
  });
  return { cents, ok: errors.length === 0, errors };
}

// ── Pedido de restaurante (parte 2) ──

export const restaurantOrderLine = z
  .object({
    itemId: z.number().int().positive(),
    size: z.number().int().min(0).max(4).optional(),
    groups: z.array(z.array(z.number().int().min(0).max(19)).max(10)).max(8),
    qty: z.number().int().min(1).max(20),
    note: z.string().trim().max(140).default(""),
  })
  .strict();
export type RestaurantOrderLine = z.infer<typeof restaurantOrderLine>;

export const restaurantPaymentMethods = ["cod", "yappy", "card_link", "transfer"] as const;

export const placeRestaurantOrderInput = z
  .object({
    slug: z.string().min(1).max(180).regex(/^[a-z0-9-]+$/),
    lines: z.array(restaurantOrderLine).min(1, "Tu pedido está vacío").max(30),
    recipientName: z.string().trim().min(1).max(160),
    phone: z.string().trim().min(7).max(30),
    /** Provincia del comprador: debe ser la del restaurante. */
    province: z.string().trim().min(1).max(60),
    city: z.string().trim().min(1).max(120),
    address: z.string().trim().min(1).max(500),
    point: z
      .object({ lat: z.number().finite(), lng: z.number().finite() })
      .strict(),
    paymentMethod: z.enum(restaurantPaymentMethods),
  })
  .strict();
export type PlaceRestaurantOrderInput = z.infer<typeof placeRestaurantOrderInput>;

/** Texto de una línea del pedido: «Hamburguesa (Grande) — Papas, Sin cebolla, Queso · Nota: sin sal». */
export function describeLine(
  item: Pick<PublicMenuItem, "name" | "sizes" | "optionGroups">,
  line: Pick<RestaurantOrderLine, "size" | "groups" | "note">
) {
  const size = item.sizes.length ? item.sizes[line.size ?? -1]?.name : undefined;
  const picked = item.optionGroups.flatMap((g, gi) =>
    Array.from(new Set(line.groups[gi] ?? []))
      .filter(i => i >= 0 && i < g.options.length)
      .map(i => g.options[i]!.name)
  );
  let text = item.name + (size ? ` (${size})` : "");
  if (picked.length) text += ` — ${picked.join(", ")}`;
  if (line.note) text += ` · Nota: ${line.note}`;
  return { text: text.slice(0, 240), size: size ?? null };
}
