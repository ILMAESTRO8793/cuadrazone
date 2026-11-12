/*
 * Ubicaciones en el mapa. Se guardan en millonésimas de grado (enteros) para
 * no perder precisión. El público solo ve la zona aproximada; el punto exacto
 * lo ven las dos partes de un pedido (y el despachador, en la fase 3).
 */
import {
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  timestamp,
} from "drizzle-orm/mysql-core";
import { czOrders } from "./commerce-schema";

/** Punto de una tienda (comercio o servicios) o de un anuncio de autos, bienes raíces o empleos. */
export const czPlaces = mysqlTable(
  "cz_places",
  {
    kind: mysqlEnum("kind", ["tienda", "inmueble", "auto", "empleo"]).notNull(),
    refId: int("refId").notNull(),
    latE6: int("latE6").notNull(),
    lngE6: int("lngE6").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [primaryKey({ columns: [table.kind, table.refId] })]
);

/** Punto de entrega que marcó el comprador al hacer el pedido. */
export const czOrderPlaces = mysqlTable("cz_order_places", {
  orderId: int("orderId")
    .primaryKey()
    .references(() => czOrders.id, { onDelete: "cascade" }),
  latE6: int("latE6").notNull(),
  lngE6: int("lngE6").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
