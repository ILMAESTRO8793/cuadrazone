/*
 * Restaurantes: una tienda de comercio que vende comida por menú (secciones,
 * platos con tamaños, combos, «quitar» y extras), con horario y tiempo de
 * preparación. Sin inventario: cada plato está Disponible o Agotado.
 */
import {
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { czStores } from "./catalog-schema";
import { czOrders } from "./commerce-schema";
import type { MenuOptionGroup, MenuSize, WeekHours } from "../shared/menu";

export const czRestaurants = mysqlTable("cz_restaurants", {
  storeId: int("storeId")
    .primaryKey()
    .references(() => czStores.id, { onDelete: "cascade" }),
  enabled: int("enabled").notNull().default(1),
  prepMinutes: int("prepMinutes").notNull().default(25),
  hours: json("hours").$type<WeekHours>().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const czMenuSections = mysqlTable(
  "cz_menu_sections",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId")
      .notNull()
      .references(() => czStores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    sortOrder: int("sortOrder").notNull().default(0),
  },
  table => [index("cz_menu_sections_store_ix").on(table.storeId)]
);

export const czMenuItems = mysqlTable(
  "cz_menu_items",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId")
      .notNull()
      .references(() => czStores.id, { onDelete: "cascade" }),
    sectionId: int("sectionId")
      .notNull()
      .references(() => czMenuSections.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    description: text("description").notNull(),
    imageUrl: varchar("imageUrl", { length: 500 }),
    priceCents: int("priceCents").notNull(),
    available: int("available").notNull().default(1),
    tags: json("tags").$type<string[]>().notNull(),
    /** Tamaños con su precio; vacío = un solo tamaño a `priceCents`. */
    sizes: json("sizes").$type<MenuSize[]>().notNull(),
    /** Acompañante, bebida, quitar, extras… */
    optionGroups: json("optionGroups").$type<MenuOptionGroup[]>().notNull(),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("cz_menu_items_store_ix").on(table.storeId)]
);

/** Marca un pedido (cz_orders) como pedido de restaurante. */
export const czRestaurantOrders = mysqlTable("cz_restaurant_orders", {
  orderId: int("orderId")
    .primaryKey()
    .references(() => czOrders.id, { onDelete: "cascade" }),
  prepMinutes: int("prepMinutes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
