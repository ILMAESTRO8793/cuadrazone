import type { PlanSelectionSnapshot } from "./pricing";
import { z } from "zod";
import { businessSelectionsInput, type BusinessSelection } from "@shared/businessCategories";

export const applicationStatuses = ["draft", "pending", "approved", "rejected"] as const;
export type ApplicationStatus = typeof applicationStatuses[number];
export const profileInput = z.object({
  displayName: z.string().trim().min(2, "Escribe tu nombre completo").max(100),
  email: z.string().trim().toLowerCase().email("Correo no válido").max(320),
  phone: z.string().trim().regex(/^$|^\+507\d{8}$/, "Usa un teléfono de Panamá: +507 y 8 dígitos"),
}).strict();
export const applicationInput = z.object({
  businessType: z.enum(["individual", "company"]),
  businessName: z.string().trim().max(160).default(""),
  businessCategories: businessSelectionsInput,
  identificationType: z.enum(["cedula", "residencia"]),
  identificationNumber: z.string().trim().min(4).max(40),
  documentExpiry: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(""),
  province: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(100),
  // CuadraZone está abierto a vendedores cristianos y no cristianos (decisión del
  // 24/10/2026): iglesia, pastor y denominación son opcionales. Lo obligatorio es
  // aceptar los valores cristianos de la plataforma (faithAccepted).
  denominationId: z.number().int().positive().nullable().default(null),
  churchName: z.string().trim().max(160).default("").refine(value => value === "" || value.length >= 2, "Escribe el nombre completo de la iglesia o déjalo vacío"),
  pastorName: z.string().trim().max(100).default("").refine(value => value === "" || value.length >= 2, "Escribe el nombre completo del pastor o déjalo vacío"),
  residenceConfirmed: z.boolean(),
  /** Compromiso obligatorio con los valores cristianos de CuadraZone (ver VALUES_COMMITMENT). */
  faithAccepted: z.boolean().default(false),
  conductAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
}).strict();
export type ApplicationInput = z.infer<typeof applicationInput>;
export type { BusinessSelection };
export type ProfileInput = z.infer<typeof profileInput>;
export type ProfileSnapshot = ProfileInput & { emailVerifiedAt: string | null; phoneVerifiedAt: string | null };
export type ApplicationSnapshot = ApplicationInput & {
  id: number; status: ApplicationStatus; revision: number; consentVersion: string; reviewReason: string | null;
  submittedAt: string | null; reviewedAt: string | null; contactEmail: string; contactPhone: string;
  storeStatus: "inactive" | "awaiting_payment" | "active";
};
export type DocumentSnapshot = { id: number; kind: "identity" | "pastoral"; fileName: string; mimeType: string; size: number; createdAt: string };
export type ProviderReadiness = { emailReady: boolean; phoneReady: boolean };
export type MembershipSnapshot = {
  profile: ProfileSnapshot | null; application: ApplicationSnapshot | null; documents: DocumentSnapshot[];
  planSelection?: PlanSelectionSnapshot | null;
  capabilities: { buyer: boolean; sellerVerified: boolean; sellerActive: boolean; admin: boolean };
  providers: ProviderReadiness;
};
export type Denomination = { id: number; name: string; active: boolean };
export const provinceOptions = ["Panamá", "Panamá Oeste", "Colón", "Chiriquí", "Coclé", "Herrera", "Los Santos", "Veraguas", "Bocas del Toro", "Darién", "Guna Yala", "Emberá-Wounaan", "Ngäbe-Buglé"];
export const documentKinds = ["identity", "pastoral"] as const;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const CONSENT_VERSION = "2026-10-24";

/** Confesión que todo vendedor acepta; se registra con la versión del consentimiento. */
/**
 * Compromiso que todo vendedor acepta, sea o no cristiano. Los valores no se negocian:
 * incumplirlos puede llevar a cerrar la tienda.
 */
export const VALUES_COMMITMENT =
  "Acepto los valores cristianos de CuadraZone: honestidad, respeto, trato justo y no publicar nada contrario a la fe cristiana. Entiendo que estos valores no se negocian y que incumplirlos puede llevar al cierre de mi tienda.";
export const saveApplicationInput = applicationInput.extend({
  revision: z.number().int().positive().optional(),
  consentVersion: z.literal(CONSENT_VERSION),
}).strict();
export const statusLabels: Record<ApplicationStatus, string> = { draft: "Borrador", pending: "Pendiente de revisión", approved: "Aprobado · pago pendiente", rejected: "Rechazado · requiere correcciones" };

/** Separa los campos de control (revision, consentVersion) de la solicitud que se valida. */
export function splitApplicationSave(input: z.infer<typeof saveApplicationInput>) {
  const { revision, consentVersion, ...application } = input;
  return { revision, consentVersion, application: application as ApplicationInput };
}

/** Mensaje que ve el solicitante después de enviar su solicitud. */
export const REVIEW_RESPONSE_MESSAGE =
  "¡Gracias! Recibimos tu solicitud. En un plazo de 1 a 3 días te daremos respuesta para confirmarte si fue aprobada o rechazada. Te avisaremos por correo y también puedes ver el estado en Mi tienda.";
