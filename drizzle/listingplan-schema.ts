/*
 * Planes de anuncios por sección (Bienes raíces, Autos y Empleos). Cada cuenta
 * tiene a lo sumo un plan por sección: el mes gratis («prueba») o un plan
 * pagado (básico, mediano o grande) que activa un administrador.
 */
import {
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  timestamp,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";

export const czSectionPlans = mysqlTable(
  "cz_section_plans",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    section: varchar("section", { length: 20 }).notNull(),
    /** «prueba», «basico», «medio» o «grande». */
    planId: varchar("planId", { length: 20 }).notNull(),
    endsAt: timestamp("endsAt").notNull(),
    /** Cuándo usó su mes gratis en esta sección (solo se da una vez). */
    trialUsedAt: timestamp("trialUsedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [primaryKey({ columns: [table.userId, table.section] })]
);

/** Pagos de planes de anuncios registrados por un administrador. */
export const czSectionPlanPayments = mysqlTable(
  "cz_section_plan_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    section: varchar("section", { length: 20 }).notNull(),
    planId: varchar("planId", { length: 20 }).notNull(),
    months: int("months").notNull(),
    amountCents: int("amountCents").notNull(),
    method: mysqlEnum("method", [
      "yappy",
      "transferencia",
      "efectivo",
      "otro",
    ]).notNull(),
    reference: varchar("reference", { length: 120 }),
    paidOn: varchar("paidOn", { length: 10 }).notNull(),
    periodEnd: timestamp("periodEnd").notNull(),
    recordedBy: int("recordedBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("cz_section_plan_payments_user_idx").on(table.userId),
    uniqueIndex("cz_section_plan_payments_ref_idx").on(
      table.method,
      table.reference
    ),
  ]
);
