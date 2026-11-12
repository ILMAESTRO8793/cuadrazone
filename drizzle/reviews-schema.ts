/*
 * Reseñas de servicios, bienes raíces, autos y empleos (las de productos
 * siguen en cz_reviews). Solo reseña quien tuvo contacto real con el anuncio.
 */
import {
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";

export const czListingReviews = mysqlTable(
  "cz_listing_reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    /** «servicio», «inmueble», «auto» o «empleo». */
    kind: varchar("kind", { length: 12 }).notNull(),
    listingId: int("listingId").notNull(),
    /** Quién recibe la reseña: el dueño del anuncio. */
    ownerUserId: int("ownerUserId")
      .notNull()
      .references(() => users.id),
    reviewerUserId: int("reviewerUserId")
      .notNull()
      .references(() => users.id),
    rating: int("rating").notNull(),
    body: text("body").notNull(),
    /** Oculta por un administrador: no se muestra ni cuenta en el promedio. */
    hiddenAt: timestamp("hiddenAt"),
    hiddenReason: varchar("hiddenReason", { length: 300 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_listing_review_uq").on(
      table.kind,
      table.listingId,
      table.reviewerUserId
    ),
    index("cz_listing_review_listing_ix").on(
      table.kind,
      table.listingId,
      table.createdAt
    ),
    index("cz_listing_review_owner_ix").on(table.ownerUserId),
  ]
);

/**
 * Quién tocó «WhatsApp» o «Llamar» en un inmueble o un auto (con su sesión
 * iniciada). Es lo que le permite reseñar ese anuncio después.
 */
export const czListingContacts = mysqlTable(
  "cz_listing_contacts",
  {
    id: int("id").autoincrement().primaryKey(),
    kind: varchar("kind", { length: 12 }).notNull(),
    listingId: int("listingId").notNull(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("cz_listing_contact_uq").on(
      table.kind,
      table.listingId,
      table.userId
    ),
  ]
);
