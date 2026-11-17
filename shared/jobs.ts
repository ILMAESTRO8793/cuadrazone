/**
 * Buscar empleo. Quien busca crea su CV gratis y aplica a vacantes; quien
 * publica necesita un plan activo (tienda o anunciante). El CV no es público:
 * solo lo ve la empresa a la que la persona aplicó.
 */
import { z } from "zod";
import { provinceOptions } from "./marketplace";

export const jobAreas = [
  "ventas", "atencion_cliente", "administracion", "contabilidad", "construccion", "educacion", "salud", "tecnologia",
  "gastronomia", "transporte", "limpieza", "seguridad", "turismo", "marketing", "ministerio", "otro",
] as const;
export const jobTypes = ["tiempo_completo", "medio_tiempo", "por_proyecto", "pasantia"] as const;
export const jobModalities = ["presencial", "remoto", "hibrido"] as const;
export const salaryPeriods = ["mes", "quincena", "hora", "proyecto"] as const;
export const availabilities = ["inmediata", "dos_semanas", "un_mes", "solo_fines"] as const;
export const languageLevels = ["basico", "intermedio", "avanzado", "nativo"] as const;
export const jobStatuses = ["draft", "published", "paused", "closed"] as const;
export const applicationStatuses = ["enviada", "vista", "entrevista", "descartada"] as const;

export type JobArea = (typeof jobAreas)[number];
export type JobType = (typeof jobTypes)[number];
export type JobModality = (typeof jobModalities)[number];
export type JobStatus = (typeof jobStatuses)[number];
export type ApplicationStatus = (typeof applicationStatuses)[number];

export const areaLabels: Record<JobArea, string> = {
  ventas: "Ventas", atencion_cliente: "Atención al cliente", administracion: "Administración", contabilidad: "Contabilidad y finanzas",
  construccion: "Construcción y mantenimiento", educacion: "Educación", salud: "Salud", tecnologia: "Tecnología",
  gastronomia: "Cocina y restaurantes", transporte: "Transporte y logística", limpieza: "Limpieza", seguridad: "Seguridad",
  turismo: "Turismo y hotelería", marketing: "Marketing y diseño", ministerio: "Iglesias y ministerios", otro: "Otro",
};
export const jobTypeLabels: Record<JobType, string> = {
  tiempo_completo: "Tiempo completo", medio_tiempo: "Medio tiempo", por_proyecto: "Por proyecto", pasantia: "Pasantía",
};
export const modalityLabels: Record<JobModality, string> = { presencial: "Presencial", remoto: "Remoto", hibrido: "Híbrido" };
export const salaryPeriodLabels: Record<(typeof salaryPeriods)[number], string> = { mes: "al mes", quincena: "por quincena", hora: "por hora", proyecto: "por proyecto" };
export const availabilityLabels: Record<(typeof availabilities)[number], string> = {
  inmediata: "Inmediata", dos_semanas: "En dos semanas", un_mes: "En un mes", solo_fines: "Solo fines de semana",
};
export const levelLabels: Record<(typeof languageLevels)[number], string> = { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado", nativo: "Nativo" };
/** Licencias de conducir y vehículo propio, para marcar con un clic en el CV. */
export const driverLicenses = ["moto", "auto", "camion", "transporte_publico", "equipo_pesado"] as const;
export const driverLicenseLabels: Record<(typeof driverLicenses)[number], string> = {
  moto: "Moto", auto: "Auto particular", camion: "Camión", transporte_publico: "Transporte público o taxi", equipo_pesado: "Equipo pesado",
};
export const ownVehicles = ["carro", "moto"] as const;
export const ownVehicleLabels: Record<(typeof ownVehicles)[number], string> = { carro: "Carro propio", moto: "Moto propia" };

/** Habilidades sugeridas: la persona las marca con un clic. */
export const skillGroups: { title: string; skills: string[] }[] = [
  { title: "Atención y ventas", skills: ["Atención al cliente", "Ventas", "Manejo de caja", "Cobros", "Servicio por WhatsApp", "Telemercadeo", "Negociación", "Manejo de quejas"] },
  { title: "Oficina y digital", skills: ["Excel", "Word", "Google Workspace", "Facturación", "Contabilidad básica", "Redes sociales", "Canva", "Inteligencia artificial (IA)", "Mecanografía rápida", "Archivo y documentos"] },
  { title: "Tecnología", skills: ["Programación", "Soporte técnico", "Diseño gráfico", "Edición de video", "Fotografía", "Marketing digital", "Análisis de datos", "Páginas web"] },
  { title: "Oficios técnicos", skills: ["Electricidad", "Plomería", "Refrigeración y aire acondicionado", "Mecánica automotriz", "Soldadura", "Carpintería", "Albañilería", "Pintura", "Mantenimiento general"] },
  { title: "Cocina y servicio", skills: ["Cocina", "Repostería", "Bartender", "Mesero", "Barista", "Limpieza", "Lavandería", "Cuidado de niños", "Cuidado de adultos mayores", "Manipulación de alimentos"] },
  { title: "Transporte y bodega", skills: ["Conducción", "Entregas a domicilio", "Montacargas", "Inventario", "Bodega", "Despacho"] },
  { title: "Habilidades personales", skills: ["Trabajo en equipo", "Puntualidad", "Liderazgo", "Comunicación", "Responsabilidad", "Resolución de problemas", "Organización", "Aprendo rápido", "Trabajo bajo presión", "Creatividad", "Adaptabilidad"] },
];
export const MAX_SKILLS = 30;
/** Idiomas sugeridos: se agregan al CV con un clic. */
export const suggestedLanguages = ["Español", "Inglés", "Francés", "Portugués", "Mandarín", "Alemán", "Lengua de señas"];

export const jobStatusLabels: Record<JobStatus, string> = { draft: "Borrador", published: "Publicada", paused: "Pausada", closed: "Cerrada" };
export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  enviada: "Enviada", vista: "Vista por la empresa", entrevista: "En entrevista", descartada: "No seleccionada",
};

const ym = z.string().regex(/^\d{4}-\d{2}$/, "Usa año y mes");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const cents = z.number().int().min(0).max(100_000_000);

// ───────────── CV ─────────────

export const experienceItem = z.object({
  company: z.string().trim().min(1, "Escribe la empresa").max(120),
  role: z.string().trim().min(1, "Escribe el cargo").max(120),
  start: ym,
  end: ym.nullable().default(null),
  current: z.boolean().default(false),
  description: z.string().trim().max(1000).default(""),
}).strict();
export const educationItem = z.object({
  institution: z.string().trim().min(1, "Escribe la institución").max(120),
  degree: z.string().trim().min(1, "Escribe el título o nivel").max(120),
  year: z.string().trim().regex(/^$|^\d{4}$/, "Año inválido").default(""),
}).strict();
export const languageItem = z.object({
  language: z.string().trim().min(2).max(40),
  level: z.enum(languageLevels),
}).strict();

export const courseItem = z.object({
  name: z.string().trim().min(2, "Escribe el curso o certificado").max(120),
  institution: z.string().trim().max(120).default(""),
  year: z.string().trim().regex(/^$|^\d{4}$/, "Año inválido").default(""),
}).strict();
export const referenceItem = z.object({
  name: z.string().trim().min(3, "Escribe el nombre de la referencia").max(120),
  role: z.string().trim().max(120).default(""),
  phone: z.string().trim().min(7, "Escribe el teléfono de la referencia").max(20),
}).strict();
const webLink = z.string().trim().max(200).regex(/^$|^https?:\/\/[^\s]+$/, "El enlace debe empezar con https://").default("");

export const saveResumeInput = z.object({
  fullName: z.string().trim().min(3, "Escribe tu nombre completo").max(120),
  headline: z.string().trim().min(3, "Escribe tu oficio o profesión").max(120),
  summary: z.string().trim().max(1500).default(""),
  phone: z.string().trim().regex(/^\+507\d{8}$/, "Usa un celular de Panamá: +507 y 8 dígitos"),
  email: z.string().trim().max(254).default(""),
  province: z.enum(provinceOptions),
  availability: z.enum(availabilities).default("inmediata"),
  experience: z.array(experienceItem).max(15).default([]),
  education: z.array(educationItem).max(10).default([]),
  skills: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  languages: z.array(languageItem).max(8).default([]),
  linkedinUrl: webLink,
  portfolioUrl: webLink,
  preferredModalities: z.array(z.enum(jobModalities)).max(3).default([]),
  canTravel: z.boolean().default(false),
  canRelocate: z.boolean().default(false),
  courses: z.array(courseItem).max(15).default([]),
  driverLicenses: z.array(z.enum(driverLicenses)).max(5).default([]),
  vehicles: z.array(z.enum(ownVehicles)).max(2).default([]),
  expectedSalaryCents: cents.nullable().default(null),
  references: z.array(referenceItem).max(5).default([]),
}).strict();
export type SaveResumeInput = z.infer<typeof saveResumeInput>;
/** El CV guardado; la foto se sube aparte. */
export type ResumeDTO = SaveResumeInput & { photoUrl: string; updatedAt: string };
/** Campos que se agregaron después: las copias viejas del CV no los traen. */
export const resumeExtraKeys = [
  "linkedinUrl", "portfolioUrl", "preferredModalities", "canTravel", "canRelocate",
  "courses", "driverLicenses", "vehicles", "expectedSalaryCents", "references",
] as const;
export const resumeExtrasDefaults = {
  linkedinUrl: "", portfolioUrl: "", preferredModalities: [] as (typeof jobModalities)[number][], canTravel: false, canRelocate: false,
  courses: [] as z.infer<typeof courseItem>[], driverLicenses: [] as (typeof driverLicenses)[number][],
  vehicles: [] as (typeof ownVehicles)[number][], expectedSalaryCents: null as number | null, references: [] as z.infer<typeof referenceItem>[],
};
/** Completa un CV (también una copia vieja de una postulación) con los campos que falten. */
export function withResumeDefaults<T extends object>(r: T): T & typeof resumeExtrasDefaults & { photoUrl: string } {
  return { ...resumeExtrasDefaults, photoUrl: "", ...r } as T & typeof resumeExtrasDefaults & { photoUrl: string };
}

/** Mensaje cuando una vacante no trae el sueldo base. */
export const SALARY_REQUIRED_MESSAGE = "Sin la publicación del sueldo ofrecido no se puede publicar. Escribe el sueldo base.";

// ───────────── Vacantes ─────────────

export const saveJobInput = z
  .object({
    id: z.number().int().positive().optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    title: z.string().trim().min(4, "Escribe el cargo").max(120),
    company: z.string().trim().min(2, "Escribe la empresa o tu nombre").max(120),
    area: z.enum(jobAreas),
    jobType: z.enum(jobTypes),
    modality: z.enum(jobModalities),
    province: z.enum(provinceOptions),
    district: z.string().trim().min(2, "Escribe el distrito").max(80),
    // El sueldo base es obligatorio; los bonos son opcionales.
    salaryMinCents: cents.nullable().default(null),
    salaryMaxCents: cents.nullable().default(null),
    salaryPeriod: z.enum(salaryPeriods).default("mes"),
    bonusCents: cents.nullable().default(null),
    bonusDetail: z.string().trim().max(200).default(""),
    description: z.string().trim().min(30, "Describe el puesto en al menos 30 letras").max(5000),
    requirements: z.string().trim().max(3000).default(""),
    benefits: z.string().trim().max(2000).default(""),
    closesOn: ymd,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.salaryMinCents)
      ctx.addIssue({ code: "custom", path: ["salaryMinCents"], message: SALARY_REQUIRED_MESSAGE });
    if (v.salaryMinCents && v.salaryMaxCents && v.salaryMaxCents < v.salaryMinCents)
      ctx.addIssue({ code: "custom", path: ["salaryMaxCents"], message: "El salario máximo no puede ser menor que el mínimo" });
  });
export type SaveJobInput = z.infer<typeof saveJobInput>;

export const jobFiltersInput = z.object({
  area: z.enum(jobAreas).optional(),
  jobType: z.enum(jobTypes).optional(),
  modality: z.enum(jobModalities).optional(),
  province: z.enum(provinceOptions).optional(),
  minSalaryCents: cents.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).max(500).default(1),
}).strict();
export type JobFilters = z.infer<typeof jobFiltersInput>;

export type JobDTO = Omit<SaveJobInput, "id" | "expectedRevision"> & {
  id: number;
  slug: string;
  status: JobStatus;
  featured: boolean;
  publishedAt: string | null;
  updatedAt: string;
};
export type OwnJobDTO = JobDTO & { revision: number; applicants: number; newApplicants: number };

export const jobUsd = (c: number) => `US$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** «US$800 – US$1,000 al mes» o «US$5 por hora». */
export function salaryLabel(j: Pick<SaveJobInput, "salaryMinCents" | "salaryMaxCents" | "salaryPeriod">) {
  if (!j.salaryMinCents) return "Sueldo no indicado";
  const period = salaryPeriodLabels[j.salaryPeriod];
  return j.salaryMaxCents && j.salaryMaxCents > j.salaryMinCents
    ? `${jobUsd(j.salaryMinCents)} – ${jobUsd(j.salaryMaxCents)} ${period}`
    : `${jobUsd(j.salaryMinCents)} ${period}`;
}

/** Fecha de hoy en Panamá (AAAA-MM-DD). */
export const todayPanama = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

/** «+ bonos de hasta US$150: comisión por ventas» o "" si no hay bonos. */
export function bonusLabel(j: Pick<SaveJobInput, "bonusCents" | "bonusDetail">) {
  if (!j.bonusCents && !j.bonusDetail) return "";
  const amount = j.bonusCents ? `Bonos de hasta ${jobUsd(j.bonusCents)}` : "Bonos";
  return j.bonusDetail ? `${amount}: ${j.bonusDetail}` : amount;
}
