import {
  bigint,
  boolean,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
  text,
} from "drizzle-orm/mysql-core";
import { users, czApplications } from "./schema";
import type { BookMetadata, DeliveryMode, ProductKind, ProductStatus } from "@shared/marketplace";

export const czStores = mysqlTable(
  "cz_stores",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    /** Copia del tipo de la solicitud, para filtrar Comercios y Servicios. */
    storeKind: varchar("storeKind", { length: 20 }).notNull().default("comercio"),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull(),
    province: varchar("province", { length: 60 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    shippingFeeCents: int("shippingFeeCents"),
    homeFeeCents: int("homeFeeCents"),
    deliveryProvinces: json("deliveryProvinces").$type<string[]>(),
    /** Precio de envío por provincia en centavos: { "Chiriquí": 1200, … }. */
    shippingFeesByProvince: json("shippingFeesByProvince").$type<Record<string, number>>(),
    /** Yappy donde el vendedor recibe los pagos de sus compradores (celular +507). */
    yappyPhone: varchar("yappyPhone", { length: 20 }),
    /** Nombre en el Directorio de Yappy Comercial, si el vendedor tiene uno. */
    yappyDirectory: varchar("yappyDirectory", { length: 80 }),
    /** Link de pago con tarjeta (Tilopay, PagueloFácil, PayPal) del vendedor. */
    cardPaymentUrl: varchar("cardPaymentUrl", { length: 500 }),
    /** 1 si el vendedor cobra con datáfono al retirar o entregar. */
    cardOnDelivery: int("cardOnDelivery").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_stores_slug_uq").on(table.slug),
    uniqueIndex("cz_stores_user_uq").on(table.userId),
    index("cz_stores_province_ix").on(table.province),
    foreignKey({ name: "cz_stores_user_fk", columns: [table.userId], foreignColumns: [users.id] }),
    foreignKey({ name: "cz_stores_app_fk", columns: [table.userId], foreignColumns: [czApplications.userId] }),
  ],
);

export const czProducts = mysqlTable(
  "cz_products",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    kind: mysqlEnum("kind", ["product", "book"]).$type<ProductKind>().notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    /** Datos de cosas tangibles y videos (solo tiendas de comercio). */
    condition: varchar("condition", { length: 20 }).notNull().default("nuevo"),
    brand: varchar("brand", { length: 80 }).notNull().default(""),
    weightGrams: int("weightGrams"),
    lengthCm: int("lengthCm"),
    widthCm: int("widthCm"),
    heightCm: int("heightCm"),
    warranty: varchar("warranty", { length: 200 }).notNull().default(""),
    videos: json("videos").$type<string[]>(),
    priceCents: int("priceCents").notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).$type<ProductStatus>().notNull().default("draft"),
    revision: int("revision").notNull().default(1),
    bookMetadata: json("bookMetadata").$type<BookMetadata | null>(),
    imageUrls: json("imageUrls").$type<string[]>().notNull(),
    deliveryModes: json("deliveryModes").$type<DeliveryMode[]>().notNull(),
    /** Etapa 6: oculto por un administrador; el vendedor no puede volver a publicarlo. */
    moderatedAt: timestamp("moderatedAt"),
    moderationReason: varchar("moderationReason", { length: 300 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_products_slug_uq").on(table.slug),
    index("cz_products_store_ix").on(table.storeId),
    index("cz_products_owner_ix").on(table.ownerUserId),
    index("cz_products_status_ix").on(table.status),
    index("cz_products_category_ix").on(table.category),
    foreignKey({ name: "cz_products_store_fk", columns: [table.storeId], foreignColumns: [czStores.id] }),
    foreignKey({ name: "cz_products_owner_fk", columns: [table.ownerUserId], foreignColumns: [users.id] }),
  ],
);

export const czVariants = mysqlTable(
  "cz_variants",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    sku: varchar("sku", { length: 80 }).notNull(),
    size: varchar("size", { length: 80 }),
    color: varchar("color", { length: 80 }),
    stock: int("stock").notNull().default(0),
    priceCents: int("priceCents").notNull(),
    active: int("active").notNull().default(1),
  },
  table => [
    uniqueIndex("cz_variants_product_sku_uq").on(table.productId, table.sku),
    index("cz_variants_product_ix").on(table.productId),
    foreignKey({ name: "cz_variants_product_fk", columns: [table.productId], foreignColumns: [czProducts.id] }),
  ],
);

/** Application-level photo index; objects remain durable storage assets. */
export const czProductImages = mysqlTable(
  "cz_product_images",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    storageKey: varchar("storageKey", { length: 320 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    mimeType: varchar("mimeType", { length: 80 }).notNull(),
    size: int("size").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("cz_product_images_key_uq").on(table.storageKey),
    index("cz_product_images_product_ix").on(table.productId),
    foreignKey({ name: "cz_product_images_product_fk", columns: [table.productId], foreignColumns: [czProducts.id] }),
    foreignKey({ name: "cz_product_images_owner_fk", columns: [table.ownerUserId], foreignColumns: [users.id] }),
  ],
);

export type Store = typeof czStores.$inferSelect;
export type Product = typeof czProducts.$inferSelect;
export type Variant = typeof czVariants.$inferSelect;
export type ProductImage = typeof czProductImages.$inferSelect;
export type NewStore = typeof czStores.$inferInsert;
export type NewProduct = typeof czProducts.$inferInsert;
export type NewVariant = typeof czVariants.$inferInsert;

/** Anuncios de bienes raíces (venta y alquiler). */
export const czProperties = mysqlTable(
  "cz_properties",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    slug: varchar("slug", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "paused", "closed"]).notNull().default("draft"),
    revision: int("revision").notNull().default(0),
    operation: mysqlEnum("operation", ["venta", "alquiler"]).notNull(),
    propertyType: mysqlEnum("propertyType", ["casa", "apartamento", "terreno", "local", "oficina"]).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull(),
    priceCents: bigint("priceCents", { mode: "number" }).notNull(),
    depositCents: bigint("depositCents", { mode: "number" }),
    minLeaseMonths: int("minLeaseMonths"),
    province: varchar("province", { length: 60 }).notNull(),
    district: varchar("district", { length: 80 }).notNull(),
    neighborhood: varchar("neighborhood", { length: 120 }).notNull().default(""),
    areaBuiltM2: int("areaBuiltM2"),
    areaLandM2: int("areaLandM2"),
    bedrooms: int("bedrooms"),
    bathrooms: int("bathrooms"),
    parking: int("parking"),
    floor: int("floor"),
    furnished: int("furnished").notNull().default(0),
    petsAllowed: int("petsAllowed").notNull().default(0),
    landUse: mysqlEnum("landUse", ["residencial", "comercial", "agricola", "mixto"]),
    hasTitle: int("hasTitle").notNull().default(0),
    hasWater: int("hasWater").notNull().default(0),
    hasPower: int("hasPower").notNull().default(0),
    amenities: json("amenities").$type<string[]>(),
    advertiserType: mysqlEnum("advertiserType", ["dueno", "agente"]).notNull().default("dueno"),
    contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
    showPhone: int("showPhone").notNull().default(1),
    images: json("images").$type<string[]>(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_properties_slug_uq").on(table.slug),
    index("cz_properties_search_idx").on(table.status, table.operation, table.propertyType, table.province),
    index("cz_properties_owner_idx").on(table.userId, table.updatedAt),
  ]
);

/** Plan de anunciante: para publicar bienes raíces (y luego autos y empleos) sin tener tienda. */
export const czAdvertiserPlans = mysqlTable("cz_advertiser_plans", {
  userId: int("userId").primaryKey().references(() => users.id),
  planId: varchar("planId", { length: 40 }).notNull(),
  endsAt: timestamp("endsAt").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Pagos del plan de anunciante registrados por un administrador. */
export const czAdvertiserPayments = mysqlTable(
  "cz_advertiser_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    planId: varchar("planId", { length: 40 }).notNull(),
    months: int("months").notNull(),
    amountCents: int("amountCents").notNull(),
    method: mysqlEnum("method", ["yappy", "transferencia", "efectivo", "otro"]).notNull(),
    reference: varchar("reference", { length: 120 }),
    paidOn: varchar("paidOn", { length: 10 }).notNull(),
    periodEnd: timestamp("periodEnd").notNull(),
    recordedBy: int("recordedBy").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("cz_advertiser_payment_reference_uq").on(table.method, table.reference)]
);

/** Anuncios de autos (venta y alquiler). */
export const czVehicles = mysqlTable(
  "cz_vehicles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    slug: varchar("slug", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "paused", "closed"]).notNull().default("draft"),
    revision: int("revision").notNull().default(0),
    operation: mysqlEnum("operation", ["venta", "alquiler"]).notNull(),
    vehicleType: mysqlEnum("vehicleType", ["sedan", "suv", "pickup", "hatchback", "coupe", "van", "moto", "camion"]).notNull(),
    make: varchar("make", { length: 40 }).notNull(),
    otherMake: varchar("otherMake", { length: 40 }).notNull().default(""),
    model: varchar("model", { length: 60 }).notNull(),
    year: int("year").notNull(),
    condition: mysqlEnum("condition", ["nuevo", "usado"]).notNull(),
    mileageKm: int("mileageKm").notNull(),
    transmission: mysqlEnum("transmission", ["automatica", "manual"]).notNull(),
    fuel: mysqlEnum("fuel", ["gasolina", "diesel", "hibrido", "electrico"]).notNull(),
    color: varchar("color", { length: 30 }).notNull().default(""),
    engine: varchar("engine", { length: 30 }).notNull().default(""),
    doors: int("doors"),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull(),
    priceCents: bigint("priceCents", { mode: "number" }).notNull(),
    negotiable: int("negotiable").notNull().default(0),
    titleInSellerName: int("titleInSellerName").notNull().default(1),
    rentPeriod: mysqlEnum("rentPeriod", ["dia", "semana", "mes"]),
    depositCents: bigint("depositCents", { mode: "number" }),
    minDriverAge: int("minDriverAge"),
    features: json("features").$type<string[]>(),
    province: varchar("province", { length: 60 }).notNull(),
    district: varchar("district", { length: 80 }).notNull(),
    sellerType: mysqlEnum("sellerType", ["particular", "concesionario", "rentadora"]).notNull().default("particular"),
    contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
    images: json("images").$type<string[]>(),
    /** Videos del vehículo (recorrido, motor encendido, interior). */
    videos: json("videos").$type<string[]>(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_vehicles_slug_uq").on(table.slug),
    index("cz_vehicles_search_idx").on(table.status, table.operation, table.vehicleType, table.province),
    index("cz_vehicles_owner_idx").on(table.userId, table.updatedAt),
  ]
);

/** CV de quien busca empleo (uno por usuario). */
export const czResumes = mysqlTable("cz_resumes", {
  userId: int("userId").primaryKey().references(() => users.id),
  fullName: varchar("fullName", { length: 120 }).notNull(),
  headline: varchar("headline", { length: 120 }).notNull(),
  summary: text("summary").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().default(""),
  province: varchar("province", { length: 60 }).notNull(),
  availability: varchar("availability", { length: 20 }).notNull().default("inmediata"),
  experience: json("experience"),
  education: json("education"),
  skills: json("skills"),
  languages: json("languages"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Vacantes de empleo. */
export const czJobs = mysqlTable(
  "cz_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    slug: varchar("slug", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "paused", "closed"]).notNull().default("draft"),
    revision: int("revision").notNull().default(0),
    title: varchar("title", { length: 120 }).notNull(),
    company: varchar("company", { length: 120 }).notNull(),
    area: varchar("area", { length: 30 }).notNull(),
    jobType: varchar("jobType", { length: 30 }).notNull(),
    modality: varchar("modality", { length: 20 }).notNull(),
    province: varchar("province", { length: 60 }).notNull(),
    district: varchar("district", { length: 80 }).notNull(),
    salaryNegotiable: int("salaryNegotiable").notNull().default(0),
    salaryMinCents: int("salaryMinCents"),
    salaryMaxCents: int("salaryMaxCents"),
    salaryPeriod: varchar("salaryPeriod", { length: 20 }).notNull().default("mes"),
    description: text("description").notNull(),
    requirements: text("requirements").notNull(),
    benefits: text("benefits").notNull(),
    closesOn: varchar("closesOn", { length: 10 }).notNull(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_jobs_slug_uq").on(table.slug),
    index("cz_jobs_search_idx").on(table.status, table.area, table.province),
    index("cz_jobs_owner_idx").on(table.userId, table.updatedAt),
  ]
);

/** Postulaciones: guardan una copia del CV al momento de aplicar. */
export const czJobApplications = mysqlTable(
  "cz_job_applications",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull().references(() => czJobs.id, { onDelete: "cascade" }),
    applicantUserId: int("applicantUserId").notNull().references(() => users.id),
    resume: json("resume").notNull(),
    message: text("message").notNull(),
    status: mysqlEnum("status", ["enviada", "vista", "entrevista", "descartada"]).notNull().default("enviada"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_job_applications_uq").on(table.jobId, table.applicantUserId),
    index("cz_job_applications_applicant_idx").on(table.applicantUserId, table.createdAt),
  ]
);

/** Servicios de las tiendas de servicios (sin envíos ni inventario). */
export const czServices = mysqlTable(
  "cz_services",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId").notNull().references(() => czStores.id),
    userId: int("userId").notNull().references(() => users.id),
    slug: varchar("slug", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "paused"]).notNull().default("draft"),
    revision: int("revision").notNull().default(0),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull(),
    serviceType: varchar("serviceType", { length: 20 }).notNull(),
    categoryId: varchar("categoryId", { length: 80 }).notNull(),
    specialtyId: varchar("specialtyId", { length: 120 }),
    priceType: varchar("priceType", { length: 20 }).notNull(),
    priceCents: int("priceCents"),
    durationMinutes: int("durationMinutes"),
    modalities: json("modalities").$type<string[]>().notNull(),
    coverageProvinces: json("coverageProvinces").$type<string[]>(),
    schedule: varchar("schedule", { length: 300 }).notNull().default(""),
    /** Etapa 4: el cliente puede reservar cita en el horario del proveedor. */
    bookable: boolean("bookable").notNull().default(false),
    images: json("images").$type<string[]>(),
    /** Etapa 6: oculto por un administrador; el vendedor no puede volver a publicarlo. */
    moderatedAt: timestamp("moderatedAt"),
    moderationReason: varchar("moderationReason", { length: 300 }),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_services_slug_uq").on(table.slug),
    index("cz_services_store_ix").on(table.storeId),
    index("cz_services_search_ix").on(table.status, table.serviceType, table.categoryId),
  ]
);

/** Solicitudes de servicio: el cliente pide y el proveedor lo contacta. */
export const czServiceRequests = mysqlTable(
  "cz_service_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    serviceId: int("serviceId").notNull().references(() => czServices.id, { onDelete: "cascade" }),
    requesterUserId: int("requesterUserId").notNull().references(() => users.id),
    name: varchar("name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    message: text("message").notNull(),
    preferredDate: varchar("preferredDate", { length: 10 }).notNull().default(""),
    province: varchar("province", { length: 60 }).notNull(),
    status: mysqlEnum("status", ["nueva", "contactada", "cerrada"]).notNull().default("nueva"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("cz_service_requests_service_ix").on(table.serviceId, table.createdAt)]
);

/* ═══════════ Etapa 4: eventos y boletos con QR ═══════════ */

/** Evento publicado por un vendedor aprobado (concierto, conferencia, culto…). */
export const czEvents = mysqlTable(
  "cz_events",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId").notNull().references(() => czStores.id),
    userId: int("userId").notNull().references(() => users.id),
    slug: varchar("slug", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "cancelled"]).notNull().default("draft"),
    revision: int("revision").notNull().default(0),
    title: varchar("title", { length: 140 }).notNull(),
    artist: varchar("artist", { length: 140 }).notNull().default(""),
    description: text("description").notNull(),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt"),
    venueName: varchar("venueName", { length: 140 }).notNull(),
    address: varchar("address", { length: 240 }).notNull().default(""),
    province: varchar("province", { length: 60 }).notNull(),
    city: varchar("city", { length: 80 }).notNull().default(""),
    mapUrl: varchar("mapUrl", { length: 500 }).notNull().default(""),
    images: json("images").$type<string[]>(),
    /** Etapa 6: oculto por un administrador; el vendedor no puede volver a publicarlo. */
    moderatedAt: timestamp("moderatedAt"),
    moderationReason: varchar("moderationReason", { length: 300 }),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_events_slug_uq").on(table.slug),
    index("cz_events_store_ix").on(table.storeId),
    index("cz_events_public_ix").on(table.status, table.startsAt),
  ]
);

/** Tipos de entrada de un evento (General, VIP…) con su precio y aforo. */
export const czEventTicketTypes = mysqlTable(
  "cz_event_ticket_types",
  {
    id: int("id").autoincrement().primaryKey(),
    eventId: int("eventId").notNull().references(() => czEvents.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    priceCents: int("priceCents").notNull().default(0),
    capacity: int("capacity").notNull(),
    /** Boletos apartados o pagados; nunca puede superar capacity. */
    taken: int("taken").notNull().default(0),
    position: int("position").notNull().default(0),
  },
  table => [index("cz_event_ticket_types_event_ix").on(table.eventId)]
);

/** Reserva de boletos: pendiente de pago, pagada o cancelada. */
export const czTicketOrders = mysqlTable(
  "cz_ticket_orders",
  {
    id: int("id").autoincrement().primaryKey(),
    eventId: int("eventId").notNull().references(() => czEvents.id),
    ticketTypeId: int("ticketTypeId").notNull().references(() => czEventTicketTypes.id),
    storeId: int("storeId").notNull().references(() => czStores.id),
    buyerUserId: int("buyerUserId").notNull().references(() => users.id),
    quantity: int("quantity").notNull(),
    unitPriceCents: int("unitPriceCents").notNull(),
    totalCents: int("totalCents").notNull(),
    status: mysqlEnum("status", ["reserved", "paid", "cancelled"]).notNull().default("reserved"),
    buyerName: varchar("buyerName", { length: 120 }).notNull(),
    buyerPhone: varchar("buyerPhone", { length: 20 }).notNull(),
    commissionBps: int("commissionBps").notNull().default(0),
    commissionCents: int("commissionCents").notNull().default(0),
    /** Pago de comisión (cz_commission_payments) que saldó esta venta. */
    commissionPaymentId: int("commissionPaymentId"),
    /** Una reserva sin pagar se libera sola al vencer. */
    expiresAt: timestamp("expiresAt"),
    paidAt: timestamp("paidAt"),
    cancelledAt: timestamp("cancelledAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("cz_ticket_orders_event_ix").on(table.eventId, table.status),
    index("cz_ticket_orders_buyer_ix").on(table.buyerUserId),
    index("cz_ticket_orders_store_ix").on(table.storeId, table.status, table.paidAt),
    index("cz_ticket_orders_commission_ix").on(table.storeId, table.commissionPaymentId),
    index("cz_ticket_orders_expiry_ix").on(table.status, table.expiresAt),
  ]
);

/** Cada boleto con su código QR único. Solo vale una vez en la entrada. */
export const czTickets = mysqlTable(
  "cz_tickets",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull().references(() => czTicketOrders.id, { onDelete: "cascade" }),
    eventId: int("eventId").notNull().references(() => czEvents.id),
    ticketTypeId: int("ticketTypeId").notNull().references(() => czEventTicketTypes.id),
    holderUserId: int("holderUserId").notNull().references(() => users.id),
    code: varchar("code", { length: 32 }).notNull(),
    status: mysqlEnum("status", ["valid", "used", "cancelled"]).notNull().default("valid"),
    usedAt: timestamp("usedAt"),
    usedByUserId: int("usedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("cz_tickets_code_uq").on(table.code),
    index("cz_tickets_event_ix").on(table.eventId, table.status),
    index("cz_tickets_holder_ix").on(table.holderUserId),
  ]
);

/* ═══════════ Etapa 4: citas de servicios ═══════════ */

/** Horario semanal de atención de una tienda de servicios (hora de Panamá). */
export const czServiceAvailability = mysqlTable(
  "cz_service_availability",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId").notNull().references(() => czStores.id, { onDelete: "cascade" }),
    /** 0 = domingo … 6 = sábado. */
    weekday: int("weekday").notNull(),
    /** Minutos desde la medianoche: 8:00 → 480. */
    startMinute: int("startMinute").notNull(),
    endMinute: int("endMinute").notNull(),
  },
  table => [index("cz_service_availability_store_ix").on(table.storeId, table.weekday)]
);

/** Cita reservada por un cliente en el horario del proveedor. */
export const czAppointments = mysqlTable(
  "cz_appointments",
  {
    id: int("id").autoincrement().primaryKey(),
    serviceId: int("serviceId").notNull().references(() => czServices.id),
    storeId: int("storeId").notNull().references(() => czStores.id),
    providerUserId: int("providerUserId").notNull().references(() => users.id),
    clientUserId: int("clientUserId").notNull().references(() => users.id),
    serviceTitle: varchar("serviceTitle", { length: 120 }).notNull(),
    priceLabel: varchar("priceLabel", { length: 60 }).notNull().default(""),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt").notNull(),
    status: mysqlEnum("status", ["confirmed", "cancelled", "completed", "no_show"]).notNull().default("confirmed"),
    clientName: varchar("clientName", { length: 120 }).notNull(),
    clientPhone: varchar("clientPhone", { length: 20 }).notNull(),
    note: varchar("note", { length: 500 }).notNull().default(""),
    cancelledBy: mysqlEnum("cancelledBy", ["client", "provider"]),
    cancelReason: varchar("cancelReason", { length: 300 }),
    cancelledAt: timestamp("cancelledAt"),
    reminderSentAt: timestamp("reminderSentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("cz_appointments_store_ix").on(table.storeId, table.startsAt),
    index("cz_appointments_client_ix").on(table.clientUserId, table.startsAt),
    index("cz_appointments_status_ix").on(table.status, table.startsAt),
  ]
);

/**
 * Bloques de 15 minutos ocupados por cada cita. La clave única (tienda, inicio
 * del bloque) hace que dos citas nunca se solapen, aunque se reserven a la vez.
 */
export const czAppointmentBlocks = mysqlTable(
  "cz_appointment_blocks",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId").notNull().references(() => czStores.id),
    blockStart: timestamp("blockStart").notNull(),
    appointmentId: int("appointmentId").notNull().references(() => czAppointments.id, { onDelete: "cascade" }),
  },
  table => [
    uniqueIndex("cz_appointment_blocks_uq").on(table.storeId, table.blockStart),
    index("cz_appointment_blocks_appt_ix").on(table.appointmentId),
  ]
);
