import { customType } from "drizzle-orm/mysql-core";
import {
  foreignKey,
  index,
  uniqueIndex,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

const mediumBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "mediumblob",
  toDriver: value => value,
  fromDriver: value =>
    Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array),
});

/** Usuarios; openId = "google_<sub>" para cuentas de Google. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const czMembershipProfiles = mysqlTable("cz_membership_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .unique()
    .references(() => users.id),
  displayName: varchar("displayName", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  phoneVerifiedAt: timestamp("phoneVerifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const czDenominations = mysqlTable("cz_denominations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const czApplications = mysqlTable("cz_membership_applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .unique()
    .references(() => users.id),
  businessType: mysqlEnum("businessType", ["individual", "company"]).notNull(),
  businessName: varchar("businessName", { length: 160 }).notNull().default(""),
  identificationType: mysqlEnum("identificationType", [
    "cedula",
    "residencia",
  ]).notNull(),
  identificationNumber: varchar("identificationNumber", {
    length: 40,
  }).notNull(),
  documentExpiry: varchar("documentExpiry", { length: 10 })
    .notNull()
    .default(""),
  province: varchar("province", { length: 60 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  denominationId: int("denominationId")
    .notNull()
    .references(() => czDenominations.id),
  churchName: varchar("churchName", { length: 160 }).notNull(),
  pastorName: varchar("pastorName", { length: 100 }).notNull(),
  residenceConfirmed: int("residenceConfirmed").notNull().default(0),
  faithAccepted: int("faithAccepted").notNull().default(0),
  conductAccepted: int("conductAccepted").notNull().default(0),
  privacyAccepted: int("privacyAccepted").notNull().default(0),
  consentVersion: varchar("consentVersion", { length: 64 }).notNull(),
  identityDocumentId: int("identityDocumentId"),
  pastoralDocumentId: int("pastoralDocumentId"),
  status: mysqlEnum("status", ["draft", "pending", "approved", "rejected"])
    .notNull()
    .default("draft"),
  revision: int("revision").notNull().default(1),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
  submittedAt: timestamp("submittedAt"),
  reviewedAt: timestamp("reviewedAt"),
  reviewReason: text("reviewReason"),
  subscriptionStatus: mysqlEnum("subscriptionStatus", [
    "not_started",
    "active",
    "past_due",
    "cancelled",
  ])
    .notNull()
    .default("not_started"),
  /** Plan pagado vigente ("normal" | "mayor_visibilidad"); null si nunca pagó. */
  subscriptionPlanId: varchar("subscriptionPlanId", { length: 32 }),
  /** Fin del período pagado. Al pasar esta fecha la tienda se oculta sola. */
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
  /** Fin de la prueba gratuita (3 meses desde la aprobación). Mientras no llegue, la comisión es 8%. */
  trialEndsAt: timestamp("trialEndsAt"),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const czVerificationDocuments = mysqlTable("cz_verification_documents", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  kind: mysqlEnum("kind", ["identity", "pastoral"]).notNull(),
  fileName: varchar("fileName", { length: 200 }).notNull(),
  mimeType: varchar("mimeType", { length: 80 }).notNull(),
  size: int("size").notNull(),
  bytes: mediumBlob("bytes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [foreignKey({ name: "cz_documents_app_fk", columns: [table.applicationId], foreignColumns: [czApplications.id] })]);

export const czMembershipAudit = mysqlTable("cz_membership_audit", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  actorUserId: int("actorUserId").references(() => users.id),
  action: varchar("action", { length: 80 }).notNull(),
  reason: text("reason"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [foreignKey({ name: "cz_audit_app_fk", columns: [table.applicationId], foreignColumns: [czApplications.id] })]);

export const czPlanSelections = mysqlTable("cz_plan_selections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .unique()
    .references(() => users.id),
  planId: mysqlEnum("planId", ["normal", "mayor_visibilidad"]).notNull(),
  catalogVersion: varchar("catalogVersion", { length: 64 }).notNull(),
  revision: int("revision").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MembershipProfile = typeof czMembershipProfiles.$inferSelect;
export type Application = typeof czApplications.$inferSelect;
export type VerificationDocument = typeof czVerificationDocuments.$inferSelect;
export type PlanSelection = typeof czPlanSelections.$inferSelect;

/**
 * Pagos de suscripción registrados por un administrador (Yappy, transferencia,
 * efectivo). Cada pago extiende el período desde el vencimiento vigente o desde
 * la fecha de registro si ya había vencido.
 */
export const czSubscriptionPayments = mysqlTable(
  "cz_subscription_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    applicationId: int("applicationId").notNull(),
    userId: int("userId").notNull(),
    planId: varchar("planId", { length: 32 }).notNull(),
    months: int("months").notNull(),
    amountCents: int("amountCents").notNull(),
    method: mysqlEnum("method", ["yappy", "transferencia", "efectivo", "otro"]).notNull(),
    /** Número de comprobante; único por método para evitar registrar dos veces el mismo pago. */
    reference: varchar("reference", { length: 120 }),
    paidOn: varchar("paidOn", { length: 10 }).notNull(),
    periodStart: timestamp("periodStart").notNull(),
    periodEnd: timestamp("periodEnd").notNull(),
    recordedBy: int("recordedBy").notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byApplication: index("cz_subscription_payments_app_idx").on(table.applicationId, table.createdAt),
    uniqueReference: uniqueIndex("cz_subscription_payments_reference_uq").on(table.method, table.reference),
  })
);

export type SubscriptionPayment = typeof czSubscriptionPayments.$inferSelect;
