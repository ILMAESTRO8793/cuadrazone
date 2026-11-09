/**
 * Servicios: lo que ofrecen las tiendas de tipo «servicios». No tienen envíos,
 * inventario ni carrito: el cliente ve el servicio, lo solicita y el proveedor
 * lo contacta para coordinar. No pagan comisión (solo la mensualidad del plan).
 */
import { z } from "zod";
import { businessCategories, getBusinessCategory } from "./businessCategories";
import { provinceOptions } from "./marketplace";

export const serviceTypes = ["clase", "curso", "a_domicilio", "consulta", "evento", "otro"] as const;
export const priceTypes = ["fijo", "por_hora", "desde", "cotizar"] as const;
export const serviceModalities = ["a_domicilio", "en_local", "en_linea"] as const;
export const serviceStatuses = ["draft", "published", "paused"] as const;
export const requestStatuses = ["nueva", "contactada", "cerrada"] as const;

export type ServiceType = (typeof serviceTypes)[number];
export type PriceType = (typeof priceTypes)[number];
export type ServiceModality = (typeof serviceModalities)[number];
export type ServiceStatus = (typeof serviceStatuses)[number];
export type RequestStatus = (typeof requestStatuses)[number];

export const serviceTypeLabels: Record<ServiceType, string> = {
  clase: "Clase o tutoría", curso: "Curso o taller", a_domicilio: "Servicio técnico o a domicilio", consulta: "Consulta o sesión profesional", evento: "Servicio para eventos", otro: "Otro servicio",
};
export const priceTypeLabels: Record<PriceType, string> = { fijo: "Precio fijo", por_hora: "Por hora", desde: "Desde", cotizar: "A cotizar" };
export const modalityLabels: Record<ServiceModality, string> = { a_domicilio: "A domicilio", en_local: "En mi local", en_linea: "En línea" };
export const serviceStatusLabels: Record<ServiceStatus, string> = { draft: "Borrador", published: "Publicado", paused: "Pausado" };
export const requestStatusLabels: Record<RequestStatus, string> = { nueva: "Nueva", contactada: "Contactada", cerrada: "Cerrada" };

export const MAX_SERVICE_IMAGES = 8;

export const saveServiceInput = z
  .object({
    id: z.number().int().positive().optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    title: z.string().trim().min(5, "Escribe el nombre del servicio").max(120),
    description: z.string().trim().min(20, "Describe el servicio en al menos 20 letras").max(5000),
    serviceType: z.enum(serviceTypes),
    categoryId: z.string().trim().max(80),
    specialtyId: z.string().trim().max(120).nullable().default(null),
    priceType: z.enum(priceTypes),
    priceCents: z.number().int().min(1).max(100_000_000).nullable().default(null),
    durationMinutes: z.number().int().min(5).max(60 * 24 * 30).nullable().default(null),
    modalities: z.array(z.enum(serviceModalities)).min(1, "Escoge al menos una modalidad").max(3),
    coverageProvinces: z.array(z.enum(provinceOptions)).max(provinceOptions.length).default([]),
    schedule: z.string().trim().max(300).default(""),
    images: z.array(z.string().max(500)).max(MAX_SERVICE_IMAGES).default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    const category = getBusinessCategory(v.categoryId);
    if (!category) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Escoge una categoría de servicios" });
    else if (v.specialtyId && !category.specialties.some(s => s.id === v.specialtyId))
      ctx.addIssue({ code: "custom", path: ["specialtyId"], message: "La especialidad no pertenece a la categoría" });
    if (v.priceType !== "cotizar" && !v.priceCents)
      ctx.addIssue({ code: "custom", path: ["priceCents"], message: "Escribe el precio o elige «A cotizar»" });
    if (v.modalities.includes("a_domicilio") && !v.coverageProvinces.length)
      ctx.addIssue({ code: "custom", path: ["coverageProvinces"], message: "Indica a qué provincias vas a domicilio" });
  });
export type SaveServiceInput = z.infer<typeof saveServiceInput>;

export const serviceFiltersInput = z
  .object({
    serviceType: z.enum(serviceTypes).optional(),
    categoryId: z.string().max(80).optional(),
    modality: z.enum(serviceModalities).optional(),
    province: z.enum(provinceOptions).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.number().int().min(1).max(500).default(1),
  })
  .strict();
export type ServiceFilters = z.infer<typeof serviceFiltersInput>;

export const serviceRequestInput = z
  .object({
    serviceId: z.number().int().positive(),
    name: z.string().trim().min(2, "Escribe tu nombre").max(120),
    phone: z.string().trim().regex(/^\+507\d{8}$/, "Usa un celular de Panamá: +507 y 8 dígitos"),
    message: z.string().trim().min(10, "Cuéntale al proveedor qué necesitas").max(1500),
    preferredDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(""),
    province: z.enum(provinceOptions),
  })
  .strict();

export type ServiceDTO = Omit<SaveServiceInput, "id" | "expectedRevision"> & {
  id: number;
  slug: string;
  status: ServiceStatus;
  categoryLabel: string;
  specialtyLabel: string | null;
  store: { name: string; slug: string; province: string; city: string; phone: string | null };
  /** El cliente puede reservar cita en el horario del proveedor. */
  bookable: boolean;
  publishedAt: string | null;
  updatedAt: string;
};
export type OwnServiceDTO = ServiceDTO & { revision: number; newRequests: number };

const usd = (c: number) => `US$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** «US$25», «US$15 por hora», «Desde US$40» o «A cotizar». */
export function servicePriceLabel(s: Pick<SaveServiceInput, "priceType" | "priceCents">) {
  if (s.priceType === "cotizar" || !s.priceCents) return "A cotizar";
  if (s.priceType === "por_hora") return `${usd(s.priceCents)} por hora`;
  if (s.priceType === "desde") return `Desde ${usd(s.priceCents)}`;
  return usd(s.priceCents);
}

/** «1 h 30 min», «45 min», «2 días». */
export function durationLabel(minutes: number | null) {
  if (!minutes) return "";
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? "día" : "días"}`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

export const serviceCategoryOptions = businessCategories.map(c => ({ id: c.id, label: c.label, specialties: c.specialties }));
