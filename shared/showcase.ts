import { z } from "zod";
import { isSafeBannerLink } from "./siteContent";

export const showcaseSections = ["todas", "comercios", "servicios", "autos", "bienes_raices", "empleos", "eventos"] as const;
export type ShowcaseSection = (typeof showcaseSections)[number];
export const showcaseSectionLabels: Record<ShowcaseSection, string> = {
  todas: "Todas las secciones",
  comercios: "Comercios",
  servicios: "Servicios",
  autos: "Autos",
  bienes_raices: "Bienes raíces",
  empleos: "Empleos",
  eventos: "Eventos",
};
export const showcaseZones = ["reel", "tienda", "producto"] as const;
export type ShowcaseZone = (typeof showcaseZones)[number];
export const showcaseZoneLabels: Record<ShowcaseZone, string> = {
  reel: "Reel o video grande",
  tienda: "Tienda destacada",
  producto: "Producto promocionado",
};
export const MAX_SHOWCASE_TILES = 12;

/** Una foto que ya está en CuadraZone (logo, producto o servicio). */
export const catalogMediaPath = z
  .string()
  .max(500)
  .regex(/^\/media\/catalog\/[A-Za-z0-9][A-Za-z0-9._\/-]*$/, "Foto inválida")
  .refine(v => !v.includes(".."), "Foto inválida");

/** Algo que se puede promocionar: una tienda, un producto o un servicio. */
export type PromoCandidate = {
  key: string;
  kind: "tienda" | "producto" | "servicio";
  title: string;
  subtitle: string;
  imageUrl: string | null;
  linkUrl: string;
  storeId: number;
  storeName: string;
  featured: boolean;
};

const day = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Fecha inválida").default("");
export const saveShowcaseInput = z
  .object({
    id: z.number().int().positive().optional(),
    section: z.enum(showcaseSections),
    zone: z.enum(showcaseZones),
    title: z.string().trim().min(2, "Escribe un título").max(80),
    subtitle: z.string().trim().max(160).default(""),
    linkUrl: z.string().trim().max(300).default("").refine(isSafeBannerLink, {
      message: "El enlace debe empezar con / (página de CuadraZone) o https://",
    }),
    storeId: z.number().int().positive().nullable().default(null),
    /** Foto ya existente (al escoger un producto); si no, se sube aparte. */
    mediaUrl: catalogMediaPath.nullable().optional(),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999).default(0),
    startsOn: day,
    endsOn: day,
  })
  .strict()
  .refine(b => !b.startsOn || !b.endsOn || b.startsOn <= b.endsOn, {
    message: "La fecha final debe ser igual o posterior a la inicial",
    path: ["endsOn"],
  });
export type SaveShowcaseInput = z.infer<typeof saveShowcaseInput>;

export type ShowcaseTile = {
  id: number;
  zone: ShowcaseZone;
  title: string;
  subtitle: string;
  mediaUrl: string | null;
  mediaType: "image" | "video";
  linkUrl: string;
  /** `featured` = la tienda tiene Mayor Visibilidad vigente (solo en la vitrina pública). */
  store: { name: string; slug: string; logoUrl: string | null; featured?: boolean } | null;
  /** Precio actual del servicio o producto enlazado, p. ej. «US$15.00 por hora». */
  priceLabel?: string | null;
};
export type AdminShowcaseItem = ShowcaseTile & {
  section: ShowcaseSection;
  storeId: number | null;
  active: boolean;
  sortOrder: number;
  startsOn: string;
  endsOn: string;
};

/** ¿Se muestra hoy? Fechas vacías = sin límite. */
export function isShowcaseLive(item: { active: boolean; startsOn: string; endsOn: string }, today: string) {
  return item.active && (!item.startsOn || item.startsOn <= today) && (!item.endsOn || item.endsOn >= today);
}
