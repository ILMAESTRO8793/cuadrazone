/*
 * Estrellas de verificación de las tiendas (roja, amarilla, morada, azul y
 * verde). Solo un administrador las otorga o las retira, con acreditación real.
 */
import {
  index,
  int,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";
import { czStores } from "./catalog-schema";

export const czStoreStars = mysqlTable(
  "cz_store_stars",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId")
      .notNull()
      .references(() => czStores.id, { onDelete: "cascade" }),
    /** «roja» | «amarilla» | «morada» | «azul» | «verde». */
    star: varchar("star", { length: 16 }).notNull(),
    /** Qué acreditación la respalda (lo ve solo el administrador). */
    note: varchar("note", { length: 300 }).notNull().default(""),
    awardedBy: int("awardedBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("cz_store_stars_uq").on(table.storeId, table.star),
    index("cz_store_stars_store_ix").on(table.storeId),
  ]
);
