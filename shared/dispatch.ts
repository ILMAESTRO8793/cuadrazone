import { z } from "zod";
import { provinceOptions } from "./marketplace";

/** El despachador gana la mitad de la comisión del pedido... */
export const DISPATCH_SHARE_PCT = 50;
/** ...y nunca menos de US$2 (p. ej. si el vendedor está en su prueba gratis). */
export const DISPATCH_MIN_CENTS = 200;
/** Cada cuánto manda su posición mientras va en camino. */
export const DISPATCH_PING_MS = 15_000;
/** Una posición más vieja que esto ya no se muestra como «en vivo». */
export const DISPATCH_STALE_MS = 2 * 60_000;

export function dispatchEarningCents(commissionCents: number) {
  const share = Math.round(
    (Math.max(0, commissionCents) * DISPATCH_SHARE_PCT) / 100
  );
  return Math.max(DISPATCH_MIN_CENTS, share);
}

export const dispatchVehicles = ["moto", "carro", "bicicleta", "otro"] as const;
export type DispatchVehicle = (typeof dispatchVehicles)[number];
export const dispatchVehicleLabels: Record<DispatchVehicle, string> = {
  moto: "Moto",
  carro: "Carro",
  bicicleta: "Bicicleta eléctrica",
  otro: "Otro",
};
/** Lo que se puede elegir al aplicar («otro» queda solo para cuentas viejas). */
export const dispatchVehicleChoices = ["moto", "carro", "bicicleta"] as const;
/** Moto y carro llevan placa; la bicicleta eléctrica normalmente no. */
export const vehicleNeedsPlate = (v: DispatchVehicle) => v === "moto" || v === "carro";

/** Documentos obligatorios para aplicar. Selfie y vehículo: solo fotos. */
export const dispatchDocKinds = ["licencia", "record", "selfie", "vehiculo"] as const;
export type DispatchDocKind = (typeof dispatchDocKinds)[number];
export const dispatchDocLabels: Record<DispatchDocKind, string> = {
  licencia: "Licencia de conducir",
  record: "Récord policivo",
  selfie: "Selfie (tu cara de frente)",
  vehiculo: "Foto de tu vehículo",
};
export const dispatchPhotoOnlyDocs: readonly DispatchDocKind[] = ["selfie", "vehiculo"];
export const DISPATCH_DOCS_MISSING =
  "Sube tu licencia, tu récord policivo, una selfie y la foto de tu vehículo para poder aplicar.";

export const dispatcherStatusLabels = {
  pending: "En revisión",
  approved: "Aprobado",
  suspended: "Suspendido",
  rejected: "Rechazado",
} as const;

export const applyDispatcherInput = z
  .object({
    fullName: z.string().trim().min(3, "Escribe tu nombre completo").max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\+507\d{8}$/, "Usa un celular de Panamá: +507 y 8 dígitos"),
    province: z
      .string()
      .refine(
        v => (provinceOptions as readonly string[]).includes(v),
        "Provincia no válida"
      ),
    vehicle: z.enum(dispatchVehicles),
    plate: z.string().trim().max(20).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (vehicleNeedsPlate(v.vehicle) && v.plate.replace(/[^A-Za-z0-9]/g, "").length < 2)
      ctx.addIssue({ code: "custom", path: ["plate"], message: "Escribe la placa de tu vehículo" });
  });
export type ApplyDispatcherInput = z.infer<typeof applyDispatcherInput>;
