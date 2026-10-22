import { getPlanSelection } from "./sellerPlans";
import { addMonths } from "./subscriptions";
import { TRIAL_MONTHS, TRIAL_PLAN_ID } from "@shared/pricing";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  applicationInput,
  CONSENT_VERSION,
  documentKinds,
  type ApplicationInput,
  type ApplicationStatus,
  type Denomination,
  type MembershipSnapshot,
  provinceOptions,
  type ProfileInput,
  type ProfileSnapshot,
  type ProviderReadiness,
  type ApplicationSnapshot,
  type DocumentSnapshot,
} from "@shared/membership";
import {
  businessSelectionsInput,
  readBusinessSelections,
} from "@shared/businessCategories";
import { getDb } from "../db";
import {
  czApplications,
  czDenominations,
  czMembershipAudit,
  czMembershipProfiles,
  czVerificationDocuments,
  users,
  type Application,
  type MembershipProfile,
  type User,
} from "../../drizzle/schema";

/**
 * emailReady: el correo se verifica con la cuenta de Google (ya confirmada por Google).
 * phoneReady: no hay proveedor de SMS; el teléfono lo verifica un administrador.
 */
export const PROVIDERS: ProviderReadiness = {
  emailReady: true,
  phoneReady: false,
};
const PANAMA_PHONE = /^\+507\d{8}$/;
const PANAMA_TODAY = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) =>
    parts.find(part => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

export class MembershipError extends Error {
  constructor(
    public code: TRPCError["code"],
    message: string
  ) {
    super(message);
    this.name = "MembershipError";
  }
}

/** El correo coincide con el de la cuenta de Google con la que inició sesión. */
export function accountEmailMatches(
  user: { loginMethod?: string | null; email?: string | null },
  email: string
): boolean {
  return (
    user.loginMethod === "google" &&
    typeof user.email === "string" &&
    user.email.length > 0 &&
    user.email.trim().toLowerCase() === email.trim().toLowerCase()
  );
}

/**
 * Requisitos de contacto por etapa. Para enviar basta el correo verificado y un
 * teléfono de Panamá; el teléfono lo verifica un administrador durante la
 * revisión. Para aprobar, ambos deben estar verificados.
 */
export function contactRequirementError(
  stage: "submit" | "approve",
  profile: { phone: string; emailVerifiedAt: unknown; phoneVerifiedAt: unknown }
): string | null {
  if (!profile.emailVerifiedAt)
    return "Verifica tu correo: debe ser el mismo de tu cuenta de Google";
  if (!PANAMA_PHONE.test(profile.phone))
    return "Guarda un teléfono de Panamá (+507 y 8 dígitos) en tu perfil";
  if (stage === "approve" && !profile.phoneVerifiedAt)
    return "Verifica el teléfono del solicitante antes de aprobar";
  return null;
}

export function toTRPCError(error: unknown): TRPCError {
  if (error instanceof MembershipError)
    return new TRPCError({ code: error.code, message: error.message });
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "No se pudo completar la operación",
  });
}

export async function serviceCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toTRPCError(error);
  }
}

function requireDb() {
  return getDb().then(db => {
    if (!db)
      throw new MembershipError(
        "INTERNAL_SERVER_ERROR",
        "La base de datos no está disponible"
      );
    return db;
  });
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function bool(value: number | boolean | null | undefined): boolean {
  return value === true || value === 1;
}

function updateChanged(result: unknown): boolean {
  const value = result as
    | { affectedRows?: number }
    | [{ affectedRows?: number }];
  const affectedRows = Array.isArray(value)
    ? value[0]?.affectedRows
    : value && typeof value === "object"
      ? value.affectedRows
      : undefined;
  return typeof affectedRows === "number" && affectedRows >= 1;
}

function mapProfile(
  row: MembershipProfile | undefined
): ProfileSnapshot | null {
  if (!row) return null;
  return {
    displayName: row.displayName,
    email: row.email,
    phone: row.phone,
    emailVerifiedAt: iso(row.emailVerifiedAt),
    phoneVerifiedAt: iso(row.phoneVerifiedAt),
  };
}

function mapDocument(row: {
  id: number;
  kind: "identity" | "pastoral";
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}): DocumentSnapshot {
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapApplication(row: Application): ApplicationSnapshot {
  return {
    businessType: row.businessType,
    businessName: row.businessName,
    businessCategories: readBusinessSelections(row.details),
    identificationType: row.identificationType,
    identificationNumber: row.identificationNumber,
    documentExpiry: row.documentExpiry,
    province: row.province,
    city: row.city,
    denominationId: row.denominationId,
    churchName: row.churchName,
    pastorName: row.pastorName,
    residenceConfirmed: bool(row.residenceConfirmed),
    faithAccepted: bool(row.faithAccepted),
    conductAccepted: bool(row.conductAccepted),
    privacyAccepted: bool(row.privacyAccepted),
    id: row.id,
    status: row.status,
    revision: row.revision,
    consentVersion: row.consentVersion,
    reviewReason: row.reviewReason,
    submittedAt: iso(row.submittedAt),
    reviewedAt: iso(row.reviewedAt),
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    storeStatus:
      row.status === "approved" && row.subscriptionStatus === "active"
        ? "active"
        : row.status === "approved"
          ? "awaiting_payment"
          : "inactive",
  };
}

async function profileFor(db: any, userId: number) {
  const rows = await db
    .select()
    .from(czMembershipProfiles)
    .where(eq(czMembershipProfiles.userId, userId))
    .limit(1);
  return rows[0] as MembershipProfile | undefined;
}

async function applicationFor(db: any, userId: number) {
  const rows = await db
    .select()
    .from(czApplications)
    .where(eq(czApplications.userId, userId))
    .limit(1);
  return rows[0] as Application | undefined;
}

async function documentsFor(db: any, applicationId: number) {
  return await db
    .select({
      id: czVerificationDocuments.id,
      kind: czVerificationDocuments.kind,
      fileName: czVerificationDocuments.fileName,
      mimeType: czVerificationDocuments.mimeType,
      size: czVerificationDocuments.size,
      createdAt: czVerificationDocuments.createdAt,
    })
    .from(czVerificationDocuments)
    .where(eq(czVerificationDocuments.applicationId, applicationId))
    .orderBy(
      desc(czVerificationDocuments.createdAt),
      desc(czVerificationDocuments.id)
    );
}

async function audit(
  db: any,
  applicationId: number | null,
  userId: number,
  actorUserId: number | null,
  action: string,
  reason: string | null,
  metadata?: Record<string, unknown>
) {
  await db.insert(czMembershipAudit).values({
    applicationId,
    userId,
    actorUserId,
    action,
    reason,
    metadata: metadata ?? null,
  });
}

export function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function validateDocumentExpiry(value: string): void {
  if (!isValidCalendarDate(value))
    throw new MembershipError(
      "BAD_REQUEST",
      "El carné de residencia requiere una fecha de vencimiento válida"
    );
}

function validateBusinessRules(input: ApplicationInput) {
  const parsed = applicationInput.safeParse(input);
  if (!parsed.success) {
    throw new MembershipError(
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ?? "La solicitud contiene datos no válidos"
    );
  }
  const categories = businessSelectionsInput.safeParse(input.businessCategories);
  if (!categories.success) {
    throw new MembershipError(
      "BAD_REQUEST",
      categories.error.issues[0]?.message ?? "Selecciona al menos una categoría de negocio"
    );
  }
  if (
    !provinceOptions.includes(
      input.province as (typeof provinceOptions)[number]
    )
  ) {
    throw new MembershipError(
      "BAD_REQUEST",
      "La provincia seleccionada no está permitida"
    );
  }
  if (input.businessType === "company" && !input.businessName.trim()) {
    throw new MembershipError(
      "BAD_REQUEST",
      "Las empresas deben indicar el nombre comercial"
    );
  }
  if (input.identificationType === "residencia")
    validateDocumentExpiry(input.documentExpiry);
}

function ensureEditable(status: ApplicationStatus | undefined) {
  if (status && status !== "draft" && status !== "rejected") {
    throw new MembershipError(
      "PRECONDITION_FAILED",
      "La solicitud pendiente o aprobada no puede editarse"
    );
  }
}

function ensureCurrentExpiry(app: Application) {
  if (
    app.identificationType === "residencia" &&
    (!isValidCalendarDate(app.documentExpiry) ||
      app.documentExpiry < PANAMA_TODAY())
  ) {
    throw new MembershipError(
      "PRECONDITION_FAILED",
      "El carné de residencia debe estar vigente en America/Panama"
    );
  }
}

export function assertConsentVersion(version: string) {
  if (version !== CONSENT_VERSION) throw new MembershipError("PRECONDITION_FAILED", "Debes aceptar la versión vigente de fe, conducta y privacidad");
}
export function assertDraftRevision(current: number | null, expected: number | undefined) {
  if ((current !== null && current !== expected) || (current === null && expected !== undefined)) throw new MembershipError("CONFLICT", "El borrador cambió en otra sesión; recarga antes de guardar");
}

async function ensureSubmissionGuards(
  db: any,
  app: Application,
  profile: MembershipProfile | undefined,
  stage: "submit" | "approve"
) {
  const categories = businessSelectionsInput.safeParse(readBusinessSelections(app.details));
  if (!categories.success || categories.data.length === 0)
    throw new MembershipError(
      "PRECONDITION_FAILED",
      categories.error?.issues[0]?.message ?? "Debes seleccionar al menos una categoría de negocio"
    );
  assertConsentVersion(app.consentVersion);
  if (!profile)
    throw new MembershipError(
      "PRECONDITION_FAILED",
      "Guarda tu perfil antes de enviar la solicitud"
    );
  const contactError = contactRequirementError(stage, profile);
  if (contactError) throw new MembershipError("PRECONDITION_FAILED", contactError);
  if (app.contactEmail !== profile.email || app.contactPhone !== profile.phone)
    throw new MembershipError(
      "PRECONDITION_FAILED",
      "Los contactos de la solicitud no coinciden con el perfil verificado"
    );
  if (
    !bool(app.residenceConfirmed) ||
    !bool(app.conductAccepted) ||
    !bool(app.privacyAccepted)
  )
    throw new MembershipError(
      "PRECONDITION_FAILED",
      "Debes aceptar residencia, conducta y privacidad"
    );
  ensureCurrentExpiry(app);
  const docs = await documentsFor(db, app.id);
  const latestByKind = new Map<string, number>();
  for (const doc of docs)
    if (!latestByKind.has(doc.kind)) latestByKind.set(doc.kind, doc.id);
  // Solo la identificación es obligatoria; la carta pastoral es opcional.
  if (!app.identityDocumentId || latestByKind.get("identity") !== app.identityDocumentId)
    throw new MembershipError(
      "PRECONDITION_FAILED",
      "Debes cargar tu documento de identidad vigente"
    );
}

export function sellerCapabilities(
  status: ApplicationStatus | null,
  subscriptionStatus: string | null,
  admin: boolean
) {
  return {
    buyer: true,
    sellerVerified: status === "approved",
    sellerActive: status === "approved" && subscriptionStatus === "active",
    admin,
  };
}

export function canEditApplication(status: ApplicationStatus) {
  return status === "draft" || status === "rejected";
}

export function validateDocumentBytes(
  bytes: Buffer,
  mimeType: string,
  maxBytes = 5 * 1024 * 1024
): void {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0)
    throw new MembershipError(
      "BAD_REQUEST",
      "El documento está vacío o no es binario"
    );
  if (bytes.length > maxBytes)
    throw new MembershipError(
      "PAYLOAD_TOO_LARGE",
      "El documento supera el límite de 5 MiB"
    );
  const signatures: Record<string, (value: Buffer) => boolean> = {
    "application/pdf": value =>
      value.subarray(0, 5).toString("ascii") === "%PDF-",
    "image/png": value =>
      value
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/jpeg": value =>
      value.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
    "image/webp": value =>
      value.subarray(0, 4).toString("ascii") === "RIFF" &&
      value.subarray(8, 12).toString("ascii") === "WEBP",
  };
  const signature = signatures[mimeType];
  if (!signature || !signature(bytes))
    throw new MembershipError(
      "UNSUPPORTED_MEDIA_TYPE",
      "El tipo MIME y la firma del archivo no coinciden"
    );
}

export async function readiness(): Promise<ProviderReadiness> {
  return PROVIDERS;
}

export async function getMembership(user: User): Promise<MembershipSnapshot> {
  const db = await requireDb();
  const [profile, app, planSelection] = await Promise.all([
    profileFor(db, user.id),
    applicationFor(db, user.id),
    getPlanSelection(user.id),
  ]);
  const docs = app ? await documentsFor(db, app.id) : [];
  return {
    profile: mapProfile(profile),
    application: app ? mapApplication(app) : null,
    planSelection,
    documents: docs.map(mapDocument),
    capabilities: sellerCapabilities(
      app?.status ?? null,
      app?.subscriptionStatus ?? null,
      user.role === "admin"
    ),
    providers: PROVIDERS,
  };
}

export async function saveProfile(
  user: User,
  input: ProfileInput
): Promise<ProfileSnapshot> {
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const existing = await profileFor(tx, user.id);
    const app = await applicationFor(tx, user.id);
    const changedEmail = existing && existing.email !== input.email;
    const changedPhone = existing && existing.phone !== input.phone;
    if (
      (app?.status === "pending" || app?.status === "approved") &&
      (changedEmail || changedPhone)
    )
      throw new MembershipError(
        "PRECONDITION_FAILED",
        "No puedes cambiar contacto mientras la solicitud está pendiente o aprobada"
      );
    const values = {
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
    };
    // Google ya verificó el correo de la cuenta: si coincide, queda verificado.
    const googleVerified = accountEmailMatches(user, input.email);
    const verifyNow = googleVerified && (!existing || changedEmail || !existing.emailVerifiedAt);
    if (!existing)
      await tx
        .insert(czMembershipProfiles)
        .values({ userId: user.id, ...values, emailVerifiedAt: googleVerified ? new Date() : null });
    else
      await tx
        .update(czMembershipProfiles)
        .set({
          ...values,
          ...(changedEmail ? { emailVerifiedAt: verifyNow ? new Date() : null } : {}),
          ...(!changedEmail && verifyNow ? { emailVerifiedAt: new Date() } : {}),
          ...(changedPhone ? { phoneVerifiedAt: null } : {}),
        })
        .where(eq(czMembershipProfiles.userId, user.id));
    if (verifyNow)
      await audit(tx, app?.id ?? null, user.id, user.id, "email_verified_google", null, { method: "google_account" });
    const fresh = await profileFor(tx, user.id);
    if (!fresh)
      throw new MembershipError(
        "INTERNAL_SERVER_ERROR",
        "No se pudo guardar el perfil"
      );
    return mapProfile(fresh)!;
  });
}

export async function listDenominations(): Promise<Denomination[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(czDenominations)
    .where(eq(czDenominations.active, 1))
    .orderBy(czDenominations.name);
  return rows.map((row: typeof czDenominations.$inferSelect) => ({
    id: row.id,
    name: row.name,
    active: bool(row.active),
  }));
}

export async function listAllDenominations(): Promise<Denomination[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(czDenominations)
    .orderBy(czDenominations.name);
  return rows.map((row: typeof czDenominations.$inferSelect) => ({
    id: row.id,
    name: row.name,
    active: bool(row.active),
  }));
}

export async function saveApplication(
  user: User,
  input: ApplicationInput,
  expectedRevision?: number,
  consentVersion: string = CONSENT_VERSION
): Promise<{ id: number; status: ApplicationStatus; revision: number }> {
  validateBusinessRules(input);
  assertConsentVersion(consentVersion);
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const profile = await profileFor(tx, user.id);
    if (!profile)
      throw new MembershipError(
        "PRECONDITION_FAILED",
        "Guarda tu perfil antes de completar la solicitud"
      );
    // La denominación es opcional; si se indica, debe existir y estar activa.
    if (input.denominationId !== null) {
      const denomination = await tx
        .select()
        .from(czDenominations)
        .where(
          and(
            eq(czDenominations.id, input.denominationId),
            eq(czDenominations.active, 1)
          )
        )
        .limit(1);
      if (!denomination.length)
        throw new MembershipError(
          "BAD_REQUEST",
          "La denominación no está activa o no existe"
        );
    }
    const existing = await applicationFor(tx, user.id);
    ensureEditable(existing?.status);
    assertDraftRevision(existing?.revision ?? null, expectedRevision);
    const values = {
      userId: user.id,
      businessType: input.businessType,
      businessName: input.businessName,
      identificationType: input.identificationType,
      identificationNumber: input.identificationNumber,
      documentExpiry: input.documentExpiry,
      province: input.province,
      city: input.city,
      denominationId: input.denominationId,
      churchName: input.churchName,
      pastorName: input.pastorName,
      residenceConfirmed: input.residenceConfirmed ? 1 : 0,
      faithAccepted: input.faithAccepted ? 1 : 0,
      conductAccepted: input.conductAccepted ? 1 : 0,
      privacyAccepted: input.privacyAccepted ? 1 : 0,
      consentVersion: CONSENT_VERSION,
      contactEmail: profile.email,
      contactPhone: profile.phone,
      details: input,
    };
    if (!existing) {
      await tx
        .insert(czApplications)
        .values({ ...values, status: "draft", revision: 1 });
      const created = await applicationFor(tx, user.id);
      if (!created)
        throw new MembershipError(
          "INTERNAL_SERVER_ERROR",
          "No se pudo crear la solicitud"
        );
      await audit(tx, created.id, user.id, user.id, "application_saved", null, { consentVersion, faithAccepted: input.faithAccepted, conductAccepted: input.conductAccepted, privacyAccepted: input.privacyAccepted });
      return {
        id: created.id,
        status: created.status,
        revision: created.revision,
      };
    }
    const nextRevision = existing.revision + 1;
    const updated = await tx
      .update(czApplications)
      .set({
        ...values,
        revision: nextRevision,
        status: existing.status,
        reviewReason:
          existing.status === "rejected" ? existing.reviewReason : null,
      })
      .where(
        and(
          eq(czApplications.id, existing.id),
          eq(czApplications.revision, existing.revision),
          sql`${czApplications.status} in ('draft','rejected')`
        )
      );
    if (!updateChanged(updated))
      throw new MembershipError(
        "CONFLICT",
        "La solicitud cambió mientras la guardabas"
      );
    await audit(tx, existing.id, user.id, user.id, "application_saved", null, { revision: nextRevision, consentVersion, faithAccepted: input.faithAccepted, conductAccepted: input.conductAccepted, privacyAccepted: input.privacyAccepted });
    return { id: existing.id, status: existing.status, revision: nextRevision };
  });
}

export async function submitApplication(
  user: User,
  revision: number
): Promise<{ status: "pending" }> {
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const app = await applicationFor(tx, user.id);
    const profile = await profileFor(tx, user.id);
    if (!app || app.revision !== revision || !canEditApplication(app.status))
      throw new MembershipError(
        "CONFLICT",
        "La solicitud cambió o ya no está editable"
      );
    await ensureSubmissionGuards(tx, app, profile, "submit");
    const nextRevision = app.revision + 1;
    const updated = await tx
      .update(czApplications)
      .set({
        status: "pending",
        revision: nextRevision,
        submittedAt: new Date(),
        reviewReason: null,
        consentVersion: CONSENT_VERSION,
      })
      .where(
        and(
          eq(czApplications.id, app.id),
          eq(czApplications.revision, revision),
          sql`${czApplications.status} in ('draft','rejected')`
        )
      );
    if (!updateChanged(updated))
      throw new MembershipError(
        "CONFLICT",
        "La solicitud cambió durante el envío"
      );
    await audit(tx, app.id, user.id, user.id, "application_submitted", null, {
      revision: nextRevision,
      consentVersion: CONSENT_VERSION,
    });
    return { status: "pending" };
  });
}

/** Verifica el correo del perfil cuando coincide con el de la cuenta de Google. */
export async function verifyEmailWithAccount(user: User): Promise<ProfileSnapshot> {
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const profile = await profileFor(tx, user.id);
    if (!profile)
      throw new MembershipError("PRECONDITION_FAILED", "Guarda tu perfil antes de verificar el correo");
    if (!profile.emailVerifiedAt) {
      if (!accountEmailMatches(user, profile.email))
        throw new MembershipError(
          "PRECONDITION_FAILED",
          "El correo del perfil debe ser el mismo de tu cuenta de Google"
        );
      await tx
        .update(czMembershipProfiles)
        .set({ emailVerifiedAt: new Date() })
        .where(and(eq(czMembershipProfiles.userId, user.id), eq(czMembershipProfiles.email, profile.email)));
      const app = await applicationFor(tx, user.id);
      await audit(tx, app?.id ?? null, user.id, user.id, "email_verified_google", null, { method: "google_account" });
    }
    const fresh = await profileFor(tx, user.id);
    return mapProfile(fresh)!;
  });
}

/**
 * Un administrador confirma el teléfono del solicitante (llamada o WhatsApp)
 * durante la revisión. Solo para solicitudes pendientes y con el mismo teléfono
 * que se envió; queda en el historial quién lo verificó, cuándo y cómo.
 */
export async function adminSetPhoneVerification(
  admin: User,
  applicationId: number,
  revision: number,
  verified: boolean,
  note: string
): Promise<{ phoneVerified: boolean }> {
  const cleanNote = note.trim();
  if (cleanNote.length < 5)
    throw new MembershipError("BAD_REQUEST", "Anota cómo confirmaste el teléfono (mínimo 5 caracteres)");
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const apps = await tx
      .select()
      .from(czApplications)
      .where(and(eq(czApplications.id, applicationId), eq(czApplications.revision, revision)))
      .limit(1);
    const app = apps[0] as Application | undefined;
    if (!app || app.status !== "pending")
      throw new MembershipError("CONFLICT", "La solicitud no está pendiente o cambió de versión");
    const profile = await profileFor(tx, app.userId);
    if (!profile || profile.phone !== app.contactPhone || !PANAMA_PHONE.test(app.contactPhone))
      throw new MembershipError("PRECONDITION_FAILED", "El teléfono del perfil no coincide con el de la solicitud");
    if (Boolean(profile.phoneVerifiedAt) === verified)
      throw new MembershipError("CONFLICT", verified ? "El teléfono ya está verificado" : "El teléfono no está verificado");
    const updated = await tx
      .update(czMembershipProfiles)
      .set({ phoneVerifiedAt: verified ? new Date() : null })
      .where(and(eq(czMembershipProfiles.userId, app.userId), eq(czMembershipProfiles.phone, app.contactPhone)));
    if (!updateChanged(updated))
      throw new MembershipError("CONFLICT", "El perfil cambió durante la verificación");
    await audit(
      tx,
      app.id,
      app.userId,
      admin.id,
      verified ? "phone_verified_admin" : "phone_verification_revoked",
      cleanNote,
      { phoneLast4: app.contactPhone.slice(-4), method: "admin_manual" }
    );
    return { phoneVerified: verified };
  });
}

export async function listApplications(
  status: "all" | ApplicationStatus,
  cursor: number | undefined,
  limit: number
) {
  const db = await requireDb();
  const filters = [];
  if (status !== "all") filters.push(eq(czApplications.status, status));
  if (cursor !== undefined) filters.push(lt(czApplications.id, cursor));
  const apps = await db
    .select()
    .from(czApplications)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(czApplications.id))
    .limit(limit + 1);
  const page = apps.slice(0, limit) as Application[];
  const items = await Promise.all(
    page.map(async app => {
      const profile = await profileFor(db, app.userId);
      return {
        id: app.id,
        status: app.status,
        revision: app.revision,
        displayName: profile?.displayName ?? "",
        email: profile?.email ?? app.contactEmail,
        churchName: app.churchName,
        province: app.province,
        submittedAt: iso(app.submittedAt),
      };
    })
  );
  return {
    items,
    nextCursor:
      apps.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export async function adminDetail(id: number) {
  const db = await requireDb();
  const apps = await db
    .select()
    .from(czApplications)
    .where(eq(czApplications.id, id))
    .limit(1);
  const app = apps[0] as Application | undefined;
  if (!app) throw new MembershipError("NOT_FOUND", "Solicitud no encontrada");
  const [profile, userRows, docs, audits] = await Promise.all([
    profileFor(db, app.userId),
    db.select().from(users).where(eq(users.id, app.userId)).limit(1),
    documentsFor(db, app.id),
    db
      .select()
      .from(czMembershipAudit)
      .where(or(
        eq(czMembershipAudit.applicationId, app.id),
        and(eq(czMembershipAudit.userId, app.userId), eq(czMembershipAudit.action, "plan_selected"))
      ))
      .orderBy(desc(czMembershipAudit.createdAt)),
  ]);
  const user = userRows[0] as User | undefined;
  const snapshot: MembershipSnapshot = {
    profile: mapProfile(profile),
    application: mapApplication(app),
    planSelection: await getPlanSelection(app.userId),
    documents: docs.map(mapDocument),
    capabilities: sellerCapabilities(
      app.status,
      app.subscriptionStatus,
      user?.role === "admin"
    ),
    providers: PROVIDERS,
  };
  return {
    ...snapshot,
    applicant: {
      userId: app.userId,
      displayName: profile?.displayName ?? "",
      email: profile?.email ?? user?.email ?? app.contactEmail,
    },
    audit: audits.map((entry: typeof czMembershipAudit.$inferSelect) => ({
      id: entry.id,
      action: entry.action,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export async function reviewApplication(
  admin: User,
  id: number,
  revision: number,
  decision: "approved" | "rejected",
  reason: string,
  documentsReviewed: boolean
): Promise<{ status: "approved" | "rejected" }> {
  if (decision === "rejected" && reason.trim().length < 10)
    throw new MembershipError(
      "BAD_REQUEST",
      "El motivo de rechazo debe tener al menos 10 caracteres"
    );
  if (decision === "approved" && !documentsReviewed)
    throw new MembershipError(
      "PRECONDITION_FAILED",
      "Debes confirmar que revisaste los documentos"
    );
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const apps = await tx
      .select()
      .from(czApplications)
      .where(
        and(eq(czApplications.id, id), eq(czApplications.revision, revision))
      )
      .limit(1);
    const app = apps[0] as Application | undefined;
    if (!app || app.status !== "pending")
      throw new MembershipError(
        "CONFLICT",
        "La solicitud no está pendiente o cambió de versión"
      );
    if (decision === "approved")
      await ensureSubmissionGuards(tx, app, await profileFor(tx, app.userId), "approve");
    const nextRevision = app.revision + 1;
    const now = new Date();
    // Prueba gratuita: la primera aprobación activa la tienda 3 meses sin mensualidad (comisión 8%).
    const startsTrial = decision === "approved" && app.subscriptionStatus === "not_started";
    const trialEndsAt = startsTrial ? addMonths(now, TRIAL_MONTHS) : null;
    const updated = await tx
      .update(czApplications)
      .set({
        status: decision,
        revision: nextRevision,
        reviewedAt: now,
        reviewReason: decision === "rejected" ? reason.trim() : null,
        ...(startsTrial
          ? { subscriptionStatus: "active" as const, subscriptionPlanId: TRIAL_PLAN_ID, subscriptionEndsAt: trialEndsAt, trialEndsAt }
          : {}),
      })
      .where(
        and(
          eq(czApplications.id, id),
          eq(czApplications.revision, revision),
          eq(czApplications.status, "pending")
        )
      );
    if (!updateChanged(updated))
      throw new MembershipError(
        "CONFLICT",
        "La solicitud cambió durante la revisión"
      );
    await audit(
      tx,
      id,
      app.userId,
      admin.id,
      decision === "approved" ? "application_approved" : "application_rejected",
      reason.trim() || null,
      { documentsReviewed, revision: nextRevision }
    );
    if (startsTrial)
      await audit(tx, id, app.userId, admin.id, "trial_started", null, {
        months: TRIAL_MONTHS,
        endsAt: trialEndsAt!.toISOString(),
      });
    return { status: decision };
  });
}

export async function saveDenomination(input: {
  id?: number;
  name: string;
  active: boolean;
}): Promise<Denomination> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160)
    throw new MembershipError(
      "BAD_REQUEST",
      "La denominación debe tener entre 2 y 160 caracteres"
    );
  const db = await requireDb();
  if (input.id !== undefined) {
    const existing = await db
      .select({ id: czDenominations.id })
      .from(czDenominations)
      .where(eq(czDenominations.id, input.id))
      .limit(1);
    if (!existing.length)
      throw new MembershipError("NOT_FOUND", "Denominación no encontrada");
  }
  const duplicate = await db
    .select()
    .from(czDenominations)
    .where(sql`lower(${czDenominations.name}) = lower(${name})`)
    .limit(1);
  if (duplicate.length && duplicate[0].id !== input.id)
    throw new MembershipError(
      "CONFLICT",
      "Ya existe una denominación con ese nombre"
    );
  if (input.id === undefined)
    await db
      .insert(czDenominations)
      .values({ name, active: input.active ? 1 : 0 });
  else {
    const updated = await db
      .update(czDenominations)
      .set({ name, active: input.active ? 1 : 0 })
      .where(eq(czDenominations.id, input.id));
    if (!updateChanged(updated))
      throw new MembershipError(
        "CONFLICT",
        "La denominación cambió mientras la guardabas"
      );
  }
  const row = (
    await db
      .select()
      .from(czDenominations)
      .where(sql`lower(${czDenominations.name}) = lower(${name})`)
      .limit(1)
  )[0];
  if (!row)
    throw new MembershipError(
      "INTERNAL_SERVER_ERROR",
      "No se pudo guardar la denominación"
    );
  return { id: row.id, name: row.name, active: bool(row.active) };
}

export { documentKinds, applicationInput };
