/*
 * Finanzas internas de CuadraZone (solo administradores): gastos del negocio y
 * la configuración del reparto entre socios e impuestos que usa el Dashboard.
 */
import {
  index,
  int,
  json,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";

/** Gastos de CuadraZone: publicidad, plataformas de IA, servidores, etc. */
export const czExpenses = mysqlTable(
  "cz_expenses",
  {
    id: int("id").autoincrement().primaryKey(),
    category: varchar("category", { length: 32 }).notNull(),
    description: varchar("description", { length: 200 }).notNull(),
    amountCents: int("amountCents").notNull(),
    /** Fecha del gasto en Panamá, «2026-11-11». */
    spentOn: varchar("spentOn", { length: 10 }).notNull(),
    recordedBy: int("recordedBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("cz_expenses_spent_ix").on(table.spentOn)]
);

/** Una sola fila (id = 1) con socios, reserva de caja e impuestos. */
export const czFinanceSettings = mysqlTable("cz_finance_settings", {
  id: int("id").primaryKey(),
  settings: json("settings").notNull(),
  updatedBy: int("updatedBy").references(() => users.id),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Expense = typeof czExpenses.$inferSelect;
