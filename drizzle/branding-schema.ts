/*
 * Marca de la tienda (beneficio de Mayor Visibilidad): portada, lema y color
 * propio. La insignia «Tienda Destacada» sale sola con el plan vigente.
 */
import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { czStores } from "./catalog-schema";

export const czStoreBranding = mysqlTable("cz_store_branding", {
  storeId: int("storeId")
    .primaryKey()
    .references(() => czStores.id, { onDelete: "cascade" }),
  /** Foto de portada (/media/catalog/stores/<id>/cover/…). */
  coverUrl: varchar("coverUrl", { length: 500 }),
  /** Frase corta debajo del nombre, p. ej. «Repostería artesanal desde 2015». */
  tagline: varchar("tagline", { length: 90 }).notNull().default(""),
  /** Color de marca en hexadecimal, p. ej. «#7a1f2b». */
  brandColor: varchar("brandColor", { length: 7 }).notNull().default(""),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
