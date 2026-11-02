/**
 * Autos: venta y alquiler de autos, motos y vehículos de trabajo. Mismas reglas
 * que bienes raíces: publicar requiere un plan activo (tienda o anunciante) y
 * Mayor Visibilidad marca los anuncios como destacados.
 */
import { z } from "zod";
import { provinceOptions } from "./marketplace";

export const vehicleOperations = ["venta", "alquiler"] as const;
export const vehicleTypes = ["sedan", "suv", "pickup", "hatchback", "coupe", "van", "moto", "camion"] as const;
export const transmissions = ["automatica", "manual"] as const;
export const fuels = ["gasolina", "diesel", "hibrido", "electrico"] as const;
export const conditions = ["nuevo", "usado"] as const;
export const rentPeriods = ["dia", "semana", "mes"] as const;
export const vehicleSellerTypes = ["particular", "concesionario", "rentadora"] as const;
export const vehicleStatuses = ["draft", "published", "paused", "closed"] as const;
export const vehicleFeatures = [
  "aire_acondicionado", "camara_reversa", "sensores", "bluetooth", "pantalla", "cuero", "sunroof", "rines", "traccion_4x4", "gps",
] as const;

/** Marcas más comunes en Panamá; «Otra» permite escribirla. */
export const vehicleMakes = [
  "Toyota", "Hyundai", "Kia", "Nissan", "Mitsubishi", "Honda", "Suzuki", "Mazda", "Chevrolet", "Ford", "Isuzu", "Volkswagen",
  "Jeep", "Subaru", "Lexus", "BMW", "Mercedes-Benz", "Audi", "Peugeot", "Renault", "JAC", "Chery", "Geely", "BYD", "MG",
  "Great Wall", "Changan", "Yamaha", "Otra",
] as const;

export type VehicleOperation = (typeof vehicleOperations)[number];
export type VehicleType = (typeof vehicleTypes)[number];
export type VehicleStatus = (typeof vehicleStatuses)[number];
export type RentPeriod = (typeof rentPeriods)[number];

export const vehicleOperationLabels: Record<VehicleOperation, string> = { venta: "Venta", alquiler: "Alquiler" };
export const vehicleTypeLabels: Record<VehicleType, string> = {
  sedan: "Sedán", suv: "SUV", pickup: "Pickup", hatchback: "Hatchback", coupe: "Coupé", van: "Van o microbús", moto: "Moto", camion: "Camión",
};
export const transmissionLabels: Record<(typeof transmissions)[number], string> = { automatica: "Automática", manual: "Manual" };
export const fuelLabels: Record<(typeof fuels)[number], string> = { gasolina: "Gasolina", diesel: "Diésel", hibrido: "Híbrido", electrico: "Eléctrico" };
export const conditionLabels: Record<(typeof conditions)[number], string> = { nuevo: "Nuevo", usado: "Usado" };
export const rentPeriodLabels: Record<RentPeriod, string> = { dia: "día", semana: "semana", mes: "mes" };
export const sellerTypeLabels: Record<(typeof vehicleSellerTypes)[number], string> = {
  particular: "Particular", concesionario: "Concesionario", rentadora: "Rentadora",
};
export const featureLabels: Record<(typeof vehicleFeatures)[number], string> = {
  aire_acondicionado: "Aire acondicionado", camara_reversa: "Cámara de reversa", sensores: "Sensores de parqueo", bluetooth: "Bluetooth",
  pantalla: "Pantalla táctil", cuero: "Asientos de cuero", sunroof: "Sunroof", rines: "Rines de lujo", traccion_4x4: "Tracción 4x4", gps: "GPS",
};
export const vehicleStatusLabels: Record<VehicleStatus, string> = {
  draft: "Borrador", published: "Publicado", paused: "Pausado", closed: "Vendido o alquilado",
};

export const MAX_VEHICLE_IMAGES = 12;
const THIS_YEAR = new Date().getFullYear();
const cents = z.number().int().min(0).max(10_000_000_000);

export const saveVehicleInput = z
  .object({
    id: z.number().int().positive().optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    operation: z.enum(vehicleOperations),
    vehicleType: z.enum(vehicleTypes),
    make: z.enum(vehicleMakes),
    otherMake: z.string().trim().max(40).default(""),
    model: z.string().trim().min(1, "Escribe el modelo").max(60),
    year: z.number().int().min(1950, "Año inválido").max(THIS_YEAR + 1, "Año inválido"),
    condition: z.enum(conditions),
    mileageKm: z.number().int().min(0).max(2_000_000),
    transmission: z.enum(transmissions),
    fuel: z.enum(fuels),
    color: z.string().trim().max(30).default(""),
    engine: z.string().trim().max(30).default(""),
    doors: z.number().int().min(0).max(6).nullable().default(null),
    title: z.string().trim().min(8, "Escribe un título de al menos 8 letras").max(120),
    description: z.string().trim().min(20, "Describe el vehículo en al menos 20 letras").max(4000),
    priceCents: cents.refine(v => v > 0, "Escribe el precio"),
    negotiable: z.boolean().default(false),
    titleInSellerName: z.boolean().default(true),
    rentPeriod: z.enum(rentPeriods).nullable().default(null),
    depositCents: cents.nullable().default(null),
    minDriverAge: z.number().int().min(18).max(80).nullable().default(null),
    features: z.array(z.enum(vehicleFeatures)).max(vehicleFeatures.length).default([]),
    province: z.enum(provinceOptions),
    district: z.string().trim().min(2, "Escribe el distrito").max(80),
    sellerType: z.enum(vehicleSellerTypes).default("particular"),
    contactPhone: z.string().trim().regex(/^\+507\d{8}$/, "Usa un celular de Panamá: +507 y 8 dígitos"),
    images: z.array(z.string().max(500)).max(MAX_VEHICLE_IMAGES).default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.make === "Otra" && v.otherMake.length < 2)
      ctx.addIssue({ code: "custom", path: ["otherMake"], message: "Escribe la marca" });
    if (v.operation === "alquiler" && !v.rentPeriod)
      ctx.addIssue({ code: "custom", path: ["rentPeriod"], message: "Indica si el precio es por día, semana o mes" });
    if (v.condition === "nuevo" && v.mileageKm > 1000)
      ctx.addIssue({ code: "custom", path: ["mileageKm"], message: "Un vehículo nuevo no puede tener más de 1,000 km" });
  });
export type SaveVehicleInput = z.infer<typeof saveVehicleInput>;

export const vehicleFiltersInput = z
  .object({
    operation: z.enum(vehicleOperations).optional(),
    vehicleType: z.enum(vehicleTypes).optional(),
    make: z.string().trim().max(40).optional(),
    province: z.enum(provinceOptions).optional(),
    transmission: z.enum(transmissions).optional(),
    fuel: z.enum(fuels).optional(),
    condition: z.enum(conditions).optional(),
    minYear: z.number().int().min(1950).max(THIS_YEAR + 1).optional(),
    maxYear: z.number().int().min(1950).max(THIS_YEAR + 1).optional(),
    minPriceCents: cents.optional(),
    maxPriceCents: cents.optional(),
    maxMileageKm: z.number().int().min(0).max(2_000_000).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.number().int().min(1).max(500).default(1),
  })
  .strict();
export type VehicleFilters = z.infer<typeof vehicleFiltersInput>;

export type VehicleDTO = Omit<SaveVehicleInput, "id" | "expectedRevision"> & {
  id: number;
  slug: string;
  status: VehicleStatus;
  featured: boolean;
  /** Marca para mostrar (la escrita si eligió «Otra»). */
  makeName: string;
  publishedAt: string | null;
  updatedAt: string;
};
export type OwnVehicleDTO = VehicleDTO & { revision: number };

export const vehicleUsd = (c: number) =>
  `US$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** «US$18,500», «US$45 por día». */
export function vehiclePriceLabel(v: { operation: VehicleOperation; priceCents: number; rentPeriod: RentPeriod | null }) {
  return v.operation === "alquiler" && v.rentPeriod ? `${vehicleUsd(v.priceCents)} por ${rentPeriodLabels[v.rentPeriod]}` : vehicleUsd(v.priceCents);
}

export const km = (n: number) => `${n.toLocaleString("en-US")} km`;
