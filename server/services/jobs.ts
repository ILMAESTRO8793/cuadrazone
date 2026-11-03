// Buscar empleo. El CV es privado: la empresa solo ve la copia que el candidato
// envió al aplicar a su vacante. Publicar vacantes exige plan activo, igual que
// bienes raíces y autos; crear el CV y aplicar es gratis.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { czJobApplications, czJobs, czResumes } from "../../drizzle/catalog-schema";
import type { User } from "../../drizzle/schema";
import {
  saveJobInput,
  saveResumeInput,
  todayPanama,
  type ApplicationStatus,
  type JobDTO,
  type JobFilters,
  type OwnJobDTO,
  type ResumeDTO,
  type SaveJobInput,
  type SaveResumeInput,
} from "@shared/jobs";
import { getDb } from "../db";
import { queueEmail, recipientFor } from "./email";
import { publishPlans, slugify } from "./realEstate";
import { isDuplicateKeyError } from "./subscriptions";

const PAGE_SIZE = 25;

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
const changed = (r: unknown) => Number(((Array.isArray(r) ? r[0] : r) as { affectedRows?: number })?.affectedRows ?? 0) > 0;
function json<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") { try { return JSON.parse(value) as T; } catch { return fallback; } }
  return (value ?? fallback) as T;
}

// ───────────── CV ─────────────

function resumeDTO(row: any): ResumeDTO {
  return {
    fullName: row.fullName,
    headline: row.headline,
    summary: row.summary ?? "",
    phone: row.phone,
    email: row.email ?? "",
    province: row.province,
    availability: row.availability,
    experience: json(row.experience, []),
    education: json(row.education, []),
    skills: json(row.skills, []),
    languages: json(row.languages, []),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function myResume(user: User): Promise<ResumeDTO | null> {
  const db = await requireDb();
  const rows = await db.select().from(czResumes).where(eq(czResumes.userId, user.id)).limit(1);
  return rows[0] ? resumeDTO(rows[0]) : null;
}

export async function saveResume(user: User, raw: unknown): Promise<ResumeDTO> {
  const parsed = saveResumeInput.safeParse(raw);
  if (!parsed.success) fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const v: SaveResumeInput = parsed.data;
  const db = await requireDb();
  const values = { ...v, summary: v.summary };
  await db.insert(czResumes).values({ userId: user.id, ...values }).onDuplicateKeyUpdate({ set: values });
  return (await myResume(user))!;
}

// ───────────── Vacantes ─────────────

function jobDTO(row: any, featured: boolean): JobDTO {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    featured,
    title: row.title,
    company: row.company,
    area: row.area,
    jobType: row.jobType,
    modality: row.modality,
    province: row.province,
    district: row.district,
    salaryNegotiable: Boolean(row.salaryNegotiable),
    salaryMinCents: row.salaryMinCents ?? null,
    salaryMaxCents: row.salaryMaxCents ?? null,
    salaryPeriod: row.salaryPeriod,
    description: row.description,
    requirements: row.requirements ?? "",
    benefits: row.benefits ?? "",
    closesOn: row.closesOn,
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function jobColumns(v: SaveJobInput) {
  return {
    title: v.title,
    company: v.company,
    area: v.area,
    jobType: v.jobType,
    modality: v.modality,
    province: v.province,
    district: v.district,
    salaryNegotiable: v.salaryNegotiable ? 1 : 0,
    salaryMinCents: v.salaryMinCents,
    salaryMaxCents: v.salaryMinCents ? v.salaryMaxCents : null,
    salaryPeriod: v.salaryPeriod,
    description: v.description,
    requirements: v.requirements,
    benefits: v.benefits,
    closesOn: v.closesOn,
  };
}

async function ownJob(db: any, userId: number, id: number) {
  const rows = await db.select().from(czJobs).where(and(eq(czJobs.id, id), eq(czJobs.userId, userId))).limit(1);
  if (!rows[0]) fail("NOT_FOUND", "La vacante no existe");
  return rows[0];
}

export async function saveJob(user: User, raw: unknown) {
  const parsed = saveJobInput.safeParse(raw);
  if (!parsed.success) fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const v = parsed.data;
  const db = await requireDb();
  if (!v.id) {
    const inserted = await db.insert(czJobs).values({ userId: user.id, slug: `tmp-${crypto.randomUUID()}`, ...jobColumns(v) });
    const id = Number((Array.isArray(inserted) ? inserted[0] : inserted).insertId);
    await db.update(czJobs).set({ slug: `${slugify(`${v.title} ${v.company}`)}-${id}` }).where(eq(czJobs.id, id));
    return { id };
  }
  const current = await ownJob(db, user.id, v.id);
  if (v.expectedRevision !== undefined && v.expectedRevision !== current.revision)
    fail("CONFLICT", "La vacante cambió en otra ventana. Recarga y vuelve a intentarlo.");
  const result = await db
    .update(czJobs)
    .set({ ...jobColumns(v), slug: `${slugify(`${v.title} ${v.company}`)}-${v.id}`, revision: current.revision + 1 })
    .where(and(eq(czJobs.id, v.id), eq(czJobs.userId, user.id), eq(czJobs.revision, current.revision)));
  if (!changed(result)) fail("CONFLICT", "La vacante cambió en otra ventana. Recarga y vuelve a intentarlo.");
  return { id: v.id };
}

export async function setJobStatus(user: User, id: number, status: "published" | "paused" | "closed" | "draft") {
  const db = await requireDb();
  const row = await ownJob(db, user.id, id);
  if (status === "published") {
    const plan = (await publishPlans(db, [user.id])).get(user.id);
    if (!plan?.active)
      fail("PRECONDITION_FAILED", "Para publicar vacantes necesitas un plan activo (Normal o Mayor Visibilidad). Escríbenos para activarlo.");
    if (row.closesOn < todayPanama()) fail("PRECONDITION_FAILED", "La fecha de cierre ya pasó. Cámbiala antes de publicar.");
  }
  await db
    .update(czJobs)
    .set({ status, revision: row.revision + 1, ...(status === "published" && !row.publishedAt ? { publishedAt: new Date() } : {}) })
    .where(eq(czJobs.id, id));
  return { status };
}

export async function deleteJob(user: User, id: number) {
  const db = await requireDb();
  await ownJob(db, user.id, id);
  await db.delete(czJobs).where(and(eq(czJobs.id, id), eq(czJobs.userId, user.id)));
  return { deleted: true };
}

export async function myJobs(user: User) {
  const db = await requireDb();
  const plan = (await publishPlans(db, [user.id])).get(user.id) ?? { active: false, featured: false, source: null, planId: null, endsAt: null };
  const rows = await db.select().from(czJobs).where(eq(czJobs.userId, user.id)).orderBy(desc(czJobs.updatedAt)).limit(200);
  const ids = rows.map((r: any) => r.id);
  const counts = ids.length
    ? await db
        .select({ jobId: czJobApplications.jobId, total: sql<number>`count(*)`, fresh: sql<number>`sum(${czJobApplications.status} = 'enviada')` })
        .from(czJobApplications)
        .where(inArray(czJobApplications.jobId, ids))
        .groupBy(czJobApplications.jobId)
    : [];
  const byJob = new Map(counts.map((c: any) => [c.jobId, c]));
  return {
    plan,
    jobs: rows.map((r: any): OwnJobDTO => ({
      ...jobDTO(r, plan.featured),
      revision: r.revision,
      applicants: Number((byJob.get(r.id) as any)?.total ?? 0),
      newApplicants: Number((byJob.get(r.id) as any)?.fresh ?? 0),
    })),
  };
}

/** Vacante visible: publicada, sin vencer y con el plan del publicador activo. */
async function visibleJobs(db: any, rows: any[]) {
  const today = todayPanama();
  const plans = await publishPlans(db, [...new Set<number>(rows.map(r => r.userId))]);
  return rows.filter(r => r.closesOn >= today && plans.get(r.userId)?.active).map(r => jobDTO(r, Boolean(plans.get(r.userId)?.featured)));
}

export async function publicJobs(filters: JobFilters) {
  const db = await requireDb();
  const conditions = [eq(czJobs.status, "published")];
  if (filters.area) conditions.push(eq(czJobs.area, filters.area));
  if (filters.jobType) conditions.push(eq(czJobs.jobType, filters.jobType));
  if (filters.modality) conditions.push(eq(czJobs.modality, filters.modality));
  if (filters.province) conditions.push(eq(czJobs.province, filters.province));
  const rows = await db.select().from(czJobs).where(and(...conditions)).orderBy(desc(czJobs.publishedAt)).limit(1000);
  const q = filters.q?.toLowerCase();
  const visible = (await visibleJobs(db, rows))
    .filter(j => filters.minSalaryCents === undefined || (j.salaryMaxCents ?? j.salaryMinCents ?? 0) >= filters.minSalaryCents)
    .filter(j => !q || `${j.title} ${j.company} ${j.district} ${j.description}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.featured) - Number(a.featured));
  const start = (filters.page - 1) * PAGE_SIZE;
  return { total: visible.length, page: filters.page, pageSize: PAGE_SIZE, items: visible.slice(start, start + PAGE_SIZE) };
}

export async function publicJob(slug: string, viewer: User | null) {
  const db = await requireDb();
  const rows = await db.select().from(czJobs).where(and(eq(czJobs.slug, slug), eq(czJobs.status, "published"))).limit(1);
  const [job] = rows[0] ? await visibleJobs(db, rows) : [];
  if (!job) fail("NOT_FOUND", "Esta vacante ya no está disponible");
  let applied: ApplicationStatus | null = null;
  if (viewer) {
    const mine = await db
      .select({ status: czJobApplications.status })
      .from(czJobApplications)
      .where(and(eq(czJobApplications.jobId, job.id), eq(czJobApplications.applicantUserId, viewer.id)))
      .limit(1);
    applied = mine[0]?.status ?? null;
  }
  return { job, applied, isOwner: Boolean(viewer && rows[0].userId === viewer.id) };
}

// ───────────── Postulaciones ─────────────

export async function applyToJob(user: User, jobId: number, message: string) {
  const db = await requireDb();
  const rows = await db.select().from(czJobs).where(and(eq(czJobs.id, jobId), eq(czJobs.status, "published"))).limit(1);
  const [job] = rows[0] ? await visibleJobs(db, rows) : [];
  if (!job) fail("NOT_FOUND", "Esta vacante ya no recibe postulaciones");
  if (rows[0].userId === user.id) fail("BAD_REQUEST", "No puedes aplicar a tu propia vacante");
  const resume = await myResume(user);
  if (!resume) fail("PRECONDITION_FAILED", "Primero crea tu CV en «Mi CV».");
  try {
    await db.insert(czJobApplications).values({ jobId, applicantUserId: user.id, resume, message: message.trim().slice(0, 1000) });
  } catch (error) {
    if (isDuplicateKeyError(error)) fail("CONFLICT", "Ya aplicaste a esta vacante");
    throw error;
  }
  await queueEmail(db, `job-application:${jobId}:${user.id}`, await recipientFor(db, rows[0].userId), {
    subject: `Nuevo candidato para ${job.title}`,
    title: "Recibiste una postulación",
    paragraphs: [`${resume.fullName} (${resume.headline}) aplicó a tu vacante «${job.title}».`, "Revisa su CV y márcalo como visto, en entrevista o no seleccionado."],
    cta: { label: "Ver candidatos", path: "/empleos/mis-vacantes" },
  });
  return { status: "enviada" as const };
}

export async function myApplications(user: User) {
  const db = await requireDb();
  const rows = await db
    .select({ id: czJobApplications.id, status: czJobApplications.status, createdAt: czJobApplications.createdAt, job: czJobs })
    .from(czJobApplications)
    .innerJoin(czJobs, eq(czJobs.id, czJobApplications.jobId))
    .where(eq(czJobApplications.applicantUserId, user.id))
    .orderBy(desc(czJobApplications.createdAt))
    .limit(200);
  return rows.map((r: any) => ({
    id: r.id,
    status: r.status as ApplicationStatus,
    appliedAt: new Date(r.createdAt).toISOString(),
    job: { title: r.job.title, company: r.job.company, slug: r.job.slug, province: r.job.province, open: r.job.status === "published" },
  }));
}

/** Candidatos de una vacante, solo para quien la publicó. */
export async function jobApplicants(user: User, jobId: number) {
  const db = await requireDb();
  const job = await ownJob(db, user.id, jobId);
  const rows = await db
    .select()
    .from(czJobApplications)
    .where(eq(czJobApplications.jobId, jobId))
    .orderBy(desc(czJobApplications.createdAt))
    .limit(500);
  return {
    job: { id: job.id, title: job.title },
    applicants: rows.map((r: any) => ({
      id: r.id,
      status: r.status as ApplicationStatus,
      message: r.message,
      appliedAt: new Date(r.createdAt).toISOString(),
      resume: json<ResumeDTO>(r.resume, null as unknown as ResumeDTO),
    })),
  };
}

export async function setApplicationStatus(user: User, applicationId: number, status: ApplicationStatus) {
  const db = await requireDb();
  const rows = await db
    .select({ app: czJobApplications, job: czJobs })
    .from(czJobApplications)
    .innerJoin(czJobs, eq(czJobs.id, czJobApplications.jobId))
    .where(eq(czJobApplications.id, applicationId))
    .limit(1);
  const row = rows[0];
  if (!row || row.job.userId !== user.id) fail("NOT_FOUND", "La postulación no existe");
  if (row.app.status === status) return { status };
  await db.update(czJobApplications).set({ status }).where(eq(czJobApplications.id, applicationId));
  // Solo avisa al candidato cuando hay una decisión, no al marcarla como vista.
  if (status === "entrevista" || status === "descartada")
    await queueEmail(db, `job-status:${applicationId}:${status}`, await recipientFor(db, row.app.applicantUserId), {
      subject: status === "entrevista" ? `Te quieren entrevistar: ${row.job.title}` : `Sobre tu postulación a ${row.job.title}`,
      title: status === "entrevista" ? "¡Pasaste a entrevista!" : "Tu postulación no fue seleccionada",
      paragraphs:
        status === "entrevista"
          ? [`${row.job.company} quiere entrevistarte para «${row.job.title}». Te contactarán al celular o correo de tu CV.`]
          : [`${row.job.company} eligió a otra persona para «${row.job.title}». ¡No te desanimes! Sigue aplicando a nuevas vacantes.`],
      cta: { label: "Ver mis postulaciones", path: "/empleos/mis-postulaciones" },
    });
  return { status };
}
