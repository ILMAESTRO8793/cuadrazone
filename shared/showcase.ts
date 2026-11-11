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
  store: { name: string; slug: string; logoUrl: string | null } | null;
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
