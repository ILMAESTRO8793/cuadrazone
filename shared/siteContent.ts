/*
 * Etapa 6 · Portada administrable: banners de la página de inicio y categorías
 * de productos que el administrador agrega, renombra, ordena u oculta.
 */
import { z } from "zod";

export const MAX_ACTIVE_BANNERS = 6;

/**
 * Enlace de un banner: una página de CuadraZone («/mercado», «/evento/x») o una
 * dirección https. Nada de «//otro-sitio» ni javascript:.
 */
export function isSafeBannerLink(link: string) {
  if (link === "") return true;
  if (/^\/(?![/\\])[^\s]*$/.test(link)) return true;
  try {
    const url = new URL(link);
    return url.protocol === "https:" && !/\s/.test(link);
  } catch {
    return false;
  }
}

/** Fecha opcional en formato AAAA-MM-DD (día en Panamá). */
const optionalDay = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Fecha inválida")
  .default("");

export const saveBannerInput = z
  .object({
    id: z.number().int().positive().optional(),
    title: z
      .string()
      .trim()
      .min(3, "El título debe tener al menos 3 caracteres")
      .max(80),
    subtitle: z.string().trim().max(160).default(""),
    linkUrl: z.string().trim().max(300).default("").refine(isSafeBannerLink, {
      message: "El enlace debe empezar con / (página de CuadraZone) o https://",
    }),
    /** Foto ya existente en CuadraZone (al escoger una tienda o producto). */
    imageUrl: z
      .string()
      .max(500)
      .regex(/^\/media\/catalog\/[A-Za-z0-9][A-Za-z0-9._\/-]*$/, "Foto inválida")
      .refine(v => !v.includes(".."), "Foto inválida")
      .optional(),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999).default(0),
    startsOn: optionalDay,
    endsOn: optionalDay,
  })
  .strict()
  .refine(b => !b.startsOn || !b.endsOn || b.startsOn <= b.endsOn, {
    message: "La fecha final debe ser igual o posterior a la inicial",
    path: ["endsOn"],
  });
export type SaveBannerInput = z.infer<typeof saveBannerInput>;

export const saveCategoryInput = z
  .object({
    id: z.number().int().positive().optional(),
    name: z
      .string()
      .trim()
      .min(2, "La categoría debe tener al menos 2 caracteres")
      .max(120),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();
export type SaveCategoryInput = z.infer<typeof saveCategoryInput>;

export type BannerDTO = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  linkUrl: string;
};

export type AdminBannerDTO = BannerDTO & {
  active: boolean;
  sortOrder: number;
  startsOn: string;
  endsOn: string;
  /** ¿Se ve hoy en la portada? (activo, con foto y dentro de sus fechas). */
  live: boolean;
};

export type AdminCategoryDTO = {
  id: number;
  name: string;
  active: boolean;
  sortOrder: number;
  products: number;
};

/** Inicio y fin (exclusivo) en UTC de un día de Panamá (UTC−5, sin horario de verano). */
export function panamaDayRange(day: string) {
  const start = new Date(`${day}T05:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Día de Panamá (AAAA-MM-DD) de una fecha guardada como inicio de ese día. */
export function panamaDayOf(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(new Date(d).getTime() - 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** ¿El banner se muestra en este momento? */
export function isBannerLive(
  b: {
    active: boolean | number;
    imageUrl: string | null;
    startsAt: Date | string | null;
    endsAt: Date | string | null;
  },
  now: Date = new Date()
) {
  if (!b.active || !b.imageUrl) return false;
  if (b.startsAt && new Date(b.startsAt) > now) return false;
  if (b.endsAt && new Date(b.endsAt) <= now) return false;
  return true;
}
