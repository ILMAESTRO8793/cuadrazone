/**
 * Bienes raíces: venta y alquiler de casas, apartamentos, terrenos, locales y
 * oficinas. Publicar requiere un plan activo (el de la tienda o un plan de
 * anunciante); Mayor Visibilidad marca los anuncios como destacados.
 */
import { z } from "zod";
import { provinceOptions } from "./marketplace";

export const propertyOperations = ["venta", "alquiler"] as const;
export const propertyTypes = ["casa", "apartamento", "terreno", "local", "oficina"] as const;
export const landUses = ["residencial", "comercial", "agricola", "mixto"] as const;
export const advertiserTypes = ["dueno", "agente"] as const;
export const propertyStatuses = ["draft", "published", "paused", "closed"] as const;
export const propertyAmenities = [
  "piscina", "seguridad", "areas_sociales", "aire_acondicionado", "linea_blanca", "balcon", "patio", "gimnasio", "ascensor", "planta_electrica",
] as const;

export type PropertyOperation = (typeof propertyOperations)[number];
export type PropertyType = (typeof propertyTypes)[number];
export type PropertyStatus = (typeof propertyStatuses)[number];

export const operationLabels: Record<PropertyOperation, string> = { venta: "Venta", alquiler: "Alquiler" };
export const propertyTypeLabels: Record<PropertyType, string> = {
  casa: "Casa", apartamento: "Apartamento", terreno: "Terreno", local: "Local comercial", oficina: "Oficina",
};
export const landUseLabels: Record<(typeof landUses)[number], string> = {
  residencial: "Residencial", comercial: "Comercial", agricola: "Agrícola", mixto: "Mixto",
};
export const amenityLabels: Record<(typeof propertyAmenities)[number], string> = {
  piscina: "Piscina", seguridad: "Seguridad 24 h", areas_sociales: "Áreas sociales", aire_acondicionado: "Aire acondicionado",
  linea_blanca: "Línea blanca", balcon: "Balcón", patio: "Patio", gimnasio: "Gimnasio", ascensor: "Ascensor", planta_electrica: "Planta eléctrica",
};
export const statusLabels: Record<PropertyStatus, string> = {
  draft: "Borrador", published: "Publicado", paused: "Pausado", closed: "Vendido o alquilado",
};

/** Tipos con habitaciones y baños (los terrenos no los tienen). */
export const hasRooms = (type: PropertyType) => type === "casa" || type === "apartamento";

const cents = z.number().int().min(0).max(1_000_000_000);
const smallInt = (max: number) => z.number().int().min(0).max(max);

export const MAX_PROPERTY_IMAGES = 15;

export const savePropertyInput = z
  .object({
    id: z.number().int().positive().optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    operation: z.enum(propertyOperations),
    propertyType: z.enum(propertyTypes),
    title: z.string().trim().min(8, "Escribe un título de al menos 8 letras").max(120),
    description: z.string().trim().min(20, "Describe la propiedad en al menos 20 letras").max(4000),
    priceCents: cents.refine(v => v > 0, "Escribe el precio"),
    depositCents: cents.nullable().default(null),
    minLeaseMonths: smallInt(60).nullable().default(null),
    province: z.enum(provinceOptions),
    district: z.string().trim().min(2, "Escribe el distrito").max(80),
    neighborhood: z.string().trim().max(120).default(""),
    areaBuiltM2: smallInt(100_000).nullable().default(null),
    areaLandM2: smallInt(10_000_000).nullable().default(null),
    bedrooms: smallInt(30).nullable().default(null),
    bathrooms: smallInt(30).nullable().default(null),
    parking: smallInt(30).nullable().default(null),
    floor: smallInt(150).nullable().default(null),
    furnished: z.boolean().default(false),
    petsAllowed: z.boolean().default(false),
    landUse: z.enum(landUses).nullable().default(null),
    hasTitle: z.boolean().default(false),
    hasWater: z.boolean().default(false),
    hasPower: z.boolean().default(false),
    amenities: z.array(z.enum(propertyAmenities)).max(propertyAmenities.length).default([]),
    advertiserType: z.enum(advertiserTypes).default("dueno"),
    contactPhone: z.string().trim().regex(/^\+507\d{8}$/, "Usa un celular de Panamá: +507 y 8 dígitos"),
    showPhone: z.boolean().default(true),
    images: z.array(z.string().max(500)).max(MAX_PROPERTY_IMAGES).default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (hasRooms(v.propertyType)) {
      if (v.bedrooms === null) ctx.addIssue({ code: "custom", path: ["bedrooms"], message: "Indica cuántas habitaciones tiene" });
      if (v.bathrooms === null) ctx.addIssue({ code: "custom", path: ["bathrooms"], message: "Indica cuántos baños tiene" });
    }
    if (v.propertyType === "terreno" && v.areaLandM2 === null)
      ctx.addIssue({ code: "custom", path: ["areaLandM2"], message: "Indica los metros cuadrados del terreno" });
    if (v.propertyType !== "terreno" && v.areaBuiltM2 === null)
      ctx.addIssue({ code: "custom", path: ["areaBuiltM2"], message: "Indica los metros cuadrados de construcción" });
  });
export type SavePropertyInput = z.infer<typeof savePropertyInput>;

export const propertyFiltersInput = z
  .object({
    operation: z.enum(propertyOperations).optional(),
    propertyType: z.enum(propertyTypes).optional(),
    province: z.enum(provinceOptions).optional(),
    minPriceCents: cents.optional(),
    maxPriceCents: cents.optional(),
    minBedrooms: smallInt(30).optional(),
    minBathrooms: smallInt(30).optional(),
    furnished: z.boolean().optional(),
    petsAllowed: z.boolean().optional(),
    q: z.string().trim().max(100).optional(),
    page: z.number().int().min(1).max(500).default(1),
  })
  .strict();
export type PropertyFilters = z.infer<typeof propertyFiltersInput>;

export type PropertyDTO = Omit<SavePropertyInput, "id" | "expectedRevision" | "contactPhone" | "showPhone"> & {
  id: number;
  slug: string;
  status: PropertyStatus;
  featured: boolean;
  /** Solo si el anunciante eligió mostrarlo. */
  contactPhone: string | null;
  publishedAt: string | null;
  updatedAt: string;
};
export type OwnPropertyDTO = PropertyDTO & { showPhone: boolean; revision: number; contactPhoneRaw: string };

export const usd = (cents: number) =>
  `US$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** «US$185,000» en venta, «US$850 al mes» en alquiler. */
export function priceLabel(p: { operation: PropertyOperation; priceCents: number }) {
  return p.operation === "alquiler" ? `${usd(p.priceCents)} al mes` : usd(p.priceCents);
}
