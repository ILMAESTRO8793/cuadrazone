import { z } from "zod";

export const productKinds = ["product", "book"] as const;
export const productStatuses = ["draft", "published", "archived"] as const;
export const deliveryModes = ["shipping", "pickup", "home"] as const;
export const catalogSorts = [
  "newest",
  "price_asc",
  "price_desc",
  "popular",
] as const;
export const provinceOptions = [
  "Panamá",
  "Panamá Oeste",
  "Chiriquí",
  "Colón",
  "Coclé",
  "Herrera",
  "Los Santos",
  "Veraguas",
  "Bocas del Toro",
  "Darién",
] as const;

function isSafeCatalogImageRef(value: string): boolean {
  if (value.startsWith("/media/catalog/")) {
    const key = value.slice("/media/".length);
    return (
      key.length > 0 &&
      !key.split("/").some(part => !part || part === "." || part === "..") &&
      /^[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=@%/-]*$/.test(key)
    );
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export const catalogImageRef = z
  .string()
  .trim()
  .max(2048)
  .refine(isSafeCatalogImageRef, {
    message:
      "La imagen debe ser una ruta /media/catalog/ válida o una URL HTTPS segura",
  });

export const bookInput = z.object({
  author: z.string().trim().min(1).max(160),
  publisher: z.string().trim().max(160).default(""),
  isbn: z.string().trim().max(32).default(""),
  language: z.string().trim().max(64).default(""),
  format: z.string().trim().max(64).default(""),
  condition: z.enum(["new", "used"]),
});

export const variantInput = z.object({
  id: z.number().int().positive().optional(),
  sku: z.string().trim().min(1).max(80),
  size: z.string().trim().max(80).nullable().optional(),
  color: z.string().trim().max(80).nullable().optional(),
  stock: z.number().int().min(0).max(2_147_483_647),
  priceCents: z.number().int().min(0).max(2_147_483_647).optional(),
});

export const saveStoreInput = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000),
  province: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(100),
  shippingFeeCents: z
    .number()
    .int()
    .min(0)
    .max(2_147_483_647)
    .nullable()
    .default(null),
  homeFeeCents: z
    .number()
    .int()
    .min(0)
    .max(2_147_483_647)
    .nullable()
    .default(null),
  deliveryProvinces: z.array(z.enum(provinceOptions)).default([]),
  /** Precio de envío para cada provincia a la que envía (centavos). */
  shippingFeesByProvince: z
    .partialRecord(z.enum(provinceOptions), z.number().int().min(0).max(100_000))
    .default({}),
  /** Celular de Yappy del vendedor (+507 y 8 dígitos) o vacío. */
  yappyPhone: z.string().trim().regex(/^$|^\+507\d{8}$/, "Usa un celular de Panamá: +507 y 8 dígitos").default(""),
  /** Nombre en el Directorio de Yappy Comercial o vacío. */
  yappyDirectory: z.string().trim().max(80).default(""),
  /** Link de pago con tarjeta de una plataforma reconocida, o vacío. */
  cardPaymentUrl: z.string().trim().max(500).refine(value => value === "" || isAllowedCardLink(value), "Usa un link https de Tilopay, PagueloFácil o PayPal").default(""),
  /** El vendedor cobra con datáfono al retirar o entregar. */
  cardOnDelivery: z.boolean().default(false),
});

export const saveProductInput = z
  .object({
    id: z.number().int().positive().optional(),
    expectedRevision: z.number().int().positive().optional(),
    title: z.string().trim().min(2).max(240),
    description: z.string().trim().max(10000),
    category: z.string().trim().min(2).max(120),
    kind: z.enum(productKinds),
    priceCents: z.number().int().min(0).max(2_147_483_647),
    images: z.array(catalogImageRef).max(12),
    deliveryModes: z.array(z.enum(deliveryModes)).min(1).max(3),
    variants: z.array(variantInput).max(100),
    book: bookInput.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "book" && !value.book) {
      ctx.addIssue({
        code: "custom",
        path: ["book"],
        message: "Los libros requieren metadatos",
      });
    }
    if (value.kind === "product" && value.book) {
      ctx.addIssue({
        code: "custom",
        path: ["book"],
        message: "Solo los libros aceptan metadatos de libro",
      });
    }
    if (value.id !== undefined && value.expectedRevision === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["expectedRevision"],
        message: "La revisión esperada es obligatoria al editar",
      });
    }
  });

export const listPublicInput = z
  .object({
    q: z.string().trim().max(120).optional(),
    kind: z.enum(productKinds).optional(),
    category: z.string().trim().max(120).optional(),
    province: z.string().trim().max(60).optional(),
    minPriceCents: z.number().int().min(0).optional(),
    maxPriceCents: z.number().int().min(0).optional(),
    minRating: z.number().min(0).max(5).optional(),
    minSold: z.number().int().min(1).optional(),
    sort: z.enum(catalogSorts).default("newest"),
    limit: z.number().int().min(1).max(50).default(20),
    cursor: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.minPriceCents !== undefined &&
      value.maxPriceCents !== undefined &&
      value.minPriceCents > value.maxPriceCents
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minPriceCents"],
        message: "El precio mínimo no puede superar al máximo",
      });
    }
  });

export const suggestInput = z.object({ q: z.string().trim().min(1).max(120) });
export const slugInput = z.object({ slug: z.string().trim().min(1).max(240) });
export const setStatusInput = z.object({
  id: z.number().int().positive(),
  expectedRevision: z.number().int().positive(),
  status: z.enum(productStatuses),
});

export type ProductKind = (typeof productKinds)[number];
export type ProductStatus = (typeof productStatuses)[number];
export type DeliveryMode = (typeof deliveryModes)[number];
export type BookMetadata = z.infer<typeof bookInput>;
export type VariantInput = z.infer<typeof variantInput>;
export type SaveStoreInput = z.infer<typeof saveStoreInput>;
export type SaveProductInput = z.infer<typeof saveProductInput>;
export type ListPublicInput = z.infer<typeof listPublicInput>;

export type PublicStore = {
  id: number;
  slug: string;
  name: string;
  description: string;
  province: string;
  city: string;
  churchName: string;
  shippingFeeCents: number | null;
  homeFeeCents: number | null;
  deliveryProvinces: string[];
  shippingFeesByProvince: Record<string, number>;
  verified: true;
  createdAt: string;
  updatedAt: string;
};

export type OwnerStore = Omit<
  PublicStore,
  "verified" | "createdAt" | "updatedAt" | "churchName"
> & {
  verified: boolean;
  yappyPhone: string | null;
  yappyDirectory: string | null;
  cardPaymentUrl: string | null;
  cardOnDelivery: boolean;
};

/**
 * Plataformas de cobro con tarjeta aceptadas para el link de pago del vendedor.
 * Se limita a dominios conocidos para que nadie pueda usar un link falso que
 * robe datos de tarjeta. Agregar otras aquí si un vendedor lo necesita.
 */
export const CARD_LINK_HOSTS = ["tilopay.com", "paguelofacil.com", "paypal.com", "paypal.me"] as const;

export function isAllowedCardLink(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return CARD_LINK_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * Precio de envío de una tienda a una provincia, o null si no envía allí.
 * Con precios por provincia se usa ese precio; las tiendas antiguas con tarifa
 * única la aplican a todas sus provincias de cobertura.
 */
export function shippingFeeFor(
  store: { shippingFeeCents: number | null; deliveryProvinces: readonly string[] | unknown; shippingFeesByProvince?: Record<string, number> | null | unknown },
  province: string
): number | null {
  const byProvince = readFeeMap(store.shippingFeesByProvince);
  if (Object.keys(byProvince).length) return byProvince[province] ?? null;
  const provinces = Array.isArray(store.deliveryProvinces) ? (store.deliveryProvinces as string[]) : [];
  return store.shippingFeeCents != null && provinces.includes(province) ? store.shippingFeeCents : null;
}

/** Provincias que cubre la tienda (con precio por provincia o tarifa única). */
export function coveredProvinces(store: { deliveryProvinces: readonly string[] | unknown; shippingFeesByProvince?: Record<string, number> | null | unknown }): string[] {
  const byProvince = Object.keys(readFeeMap(store.shippingFeesByProvince));
  if (byProvince.length) return byProvince;
  return Array.isArray(store.deliveryProvinces) ? (store.deliveryProvinces as string[]) : [];
}

/** Lee el mapa de precios aunque venga como texto JSON (MariaDB) o vacío. */
export function readFeeMap(value: unknown): Record<string, number> {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return {}; } }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([k, v]) => (provinceOptions as readonly string[]).includes(k) && Number.isInteger(v) && (v as number) >= 0
    )
  ) as Record<string, number>;
}

/** El vendedor puede recibir pagos por Yappy si registró un celular o un nombre en el directorio. */
export function storeAcceptsYappy(store: { yappyPhone?: string | null; yappyDirectory?: string | null }) {
  return Boolean(store.yappyPhone || store.yappyDirectory);
}

export type PublicVariant = {
  id: number;
  sku: string;
  size: string | null;
  color: string | null;
  stock: number;
  priceCents: number;
};

export type PublicProduct = {
  id: number;
  slug: string;
  kind: ProductKind;
  title: string;
  description: string;
  category: string;
  priceCents: number;
  images: string[];
  deliveryModes: DeliveryMode[];
  book: BookMetadata | null;
  variants: PublicVariant[];
  store: PublicStore;
  rating: number;
  reviewCount: number;
  soldCount: number;
  createdAt: string;
  revision: number;
};

export type OwnerProduct = Omit<PublicProduct, "store"> & {
  store: OwnerStore;
  status: ProductStatus;
};

export const catalogCategories = [
  "Hogar",
  "Ropa",
  "Tecnología",
  "Alimentos",
  "Belleza",
  "Artesanías",
  "Papelería",
  "Música",
  "Accesorios",
  "Salud y bienestar",
  "Educación",
  "Libros cristianos",
  "Devocionales",
  "Biblias",
  "Regalos",
  "Servicios",
] as const;

export const publicProductDtoFields = [
  "id",
  "slug",
  "kind",
  "title",
  "description",
  "category",
  "priceCents",
  "images",
  "deliveryModes",
  "book",
  "variants",
  "store",
  "rating",
  "reviewCount",
  "soldCount",
  "createdAt",
  "revision",
] as const;
