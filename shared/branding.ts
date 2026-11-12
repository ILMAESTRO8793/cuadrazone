import { z } from "zod";

/** Marca de la tienda: beneficio de Mayor Visibilidad. */
export const BRAND_BADGE_LABEL = "Tienda Destacada";

/** Colores sugeridos; el vendedor también puede escoger uno propio. */
export const brandColorPresets = [
  "#7a1f2b",
  "#b8862b",
  "#2e6b3a",
  "#1f6fc5",
  "#6d3fa0",
  "#c0583a",
  "#0b2a4a",
  "#2f6f73",
  "#a3315f",
  "#3a3a3a",
] as const;

export const brandColorSchema = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6})?$/, "El color debe tener el formato #RRGGBB");

export const saveBrandingInput = z
  .object({
    tagline: z
      .string()
      .trim()
      .max(90, "El lema puede tener hasta 90 caracteres")
      .default(""),
    brandColor: brandColorSchema.default(""),
  })
  .strict();
export type SaveBrandingInput = z.infer<typeof saveBrandingInput>;

export type PublicBranding = {
  featured: true;
  coverUrl: string | null;
  tagline: string;
  brandColor: string;
};

/** Texto blanco o casi negro según qué se lea mejor sobre ese color. */
export function readableTextOn(hex: string): "#ffffff" | "#14181f" {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#14181f";
  const [r, g, b] = [m[1], m[2], m[3]].map(v => {
    const c = parseInt(v!, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contraste contra blanco (1.05/(L+0.05)) frente a contra casi negro.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.0607 ? "#ffffff" : "#14181f";
}
