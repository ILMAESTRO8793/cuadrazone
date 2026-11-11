/*
 * Vitrina de cada sección (estilo Amazon): un reel o video grande, tiendas
 * destacadas y productos promocionados que el administrador escoge.
 */
import { index, int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { czStores } from "./catalog-schema";

export const czShowcaseItems = mysqlTable(
  "cz_showcase_items",
  {
    id: int("id").autoincrement().primaryKey(),
    /** «todas», «comercios», «servicios», «autos», «bienes_raices», «empleos» o «eventos». */
    section: varchar("section", { length: 20 }).notNull(),
    /** «reel» (bloque grande con video o foto), «tienda» o «producto». */
    zone: varchar("zone", { length: 12 }).notNull(),
    title: varchar("title", { length: 80 }).notNull(),
    subtitle: varchar("subtitle", { length: 160 }).notNull().default(""),
    mediaUrl: varchar("mediaUrl", { length: 500 }),
    /** «image» o «video». */
    mediaType: varchar("mediaType", { length: 8 }).notNull().default("image"),
    linkUrl: varchar("linkUrl", { length: 300 }).notNull().default(""),
    /** Tienda destacada: su logo y su página se usan si no hay foto ni enlace. */
    storeId: int("storeId").references(() => czStores.id, { onDelete: "set null" }),
    active: int("active").notNull().default(1),
    sortOrder: int("sortOrder").notNull().default(0),
    startsOn: varchar("startsOn", { length: 10 }).notNull().default(""),
    endsOn: varchar("endsOn", { length: 10 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("cz_showcase_section_ix").on(table.section, table.zone, table.active)]
);
