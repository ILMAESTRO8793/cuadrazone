import type { Product, Variant } from "../drizzle/catalog-schema";
import { describe, expect, it } from "vitest";
import {
  listPublicInput,
  saveProductInput,
  saveStoreInput,
  variantInput,
  catalogCategories,
} from "@shared/marketplace";
import {
  categories,
  CatalogError,
  validatePublishable,
} from "./services/catalog";

describe("contrato del catálogo CuadraZone", () => {
  it("mantiene categorías variadas sin sembrar personas", () => {
    expect(categories()).toEqual(catalogCategories);
    expect(categories().length).toBeGreaterThan(8);
  });

  it("valida precios, límites y orden de búsqueda", () => {
    expect(
      listPublicInput.parse({
        sort: "price_asc",
        limit: 10,
        minPriceCents: 100,
        maxPriceCents: 900,
      }).sort
    ).toBe("price_asc");
    expect(() =>
      listPublicInput.parse({ minPriceCents: 900, maxPriceCents: 100 })
    ).toThrow();
    expect(() => listPublicInput.parse({ limit: 51 })).toThrow();
  });

  it("requiere metadatos para libros y rechaza book en productos", () => {
    const base = {
      title: "Libro",
      description: "Descripción",
      category: "Libros cristianos",
      priceCents: 1000,
      images: [],
      deliveryModes: ["shipping"],
      variants: [],
    };
    expect(() => saveProductInput.parse({ ...base, kind: "book" })).toThrow();
    expect(() =>
      saveProductInput.parse({
        ...base,
        kind: "product",
        book: {
          author: "Autor",
          publisher: "",
          isbn: "",
          language: "es",
          format: "tapa",
          condition: "nuevo",
        },
      })
    ).toThrow();
  });

  it("no permite inventario negativo y acepta variante BASE mínima", () => {
    expect(variantInput.parse({ sku: "BASE", stock: 0 })).toMatchObject({
      sku: "BASE",
      stock: 0,
    });
    expect(() => variantInput.parse({ sku: "BASE", stock: -1 })).toThrow();
  });

  it("acepta imágenes internas y HTTPS, pero nunca esquemas inseguros", () => {
    const base = {
      title: "Producto",
      description: "Descripción",
      category: "Hogar",
      kind: "product" as const,
      priceCents: 1000,
      deliveryModes: ["shipping"] as const,
      variants: [],
    };
    expect(
      saveProductInput.parse({
        ...base,
        images: [
          "/media/catalog/imagen.webp",
          "https://cdn.example.test/image.webp",
        ],
      }).images
    ).toHaveLength(2);
    for (const url of [
      "http://cdn.example.test/image.webp",
      "data:image/png;base64,abc",
      "javascript:alert(1)",
      "/media/catalog/../secret.webp",
      "/media/documentos/cedula.png",
    ]) {
      expect(() =>
        saveProductInput.parse({ ...base, images: [url] })
      ).toThrow();
    }
  });

  it("exige revisión al editar y conserva condiciones new/used de libros", () => {
    const base = {
      title: "Biblia",
      description: "Descripción",
      category: "Biblias",
      kind: "book" as const,
      priceCents: 1000,
      images: [],
      deliveryModes: ["shipping"] as const,
      variants: [],
      book: {
        author: "Autor",
        publisher: "",
        isbn: "",
        language: "es",
        format: "tapa",
        condition: "new" as const,
      },
    };
    expect(() => saveProductInput.parse({ ...base, id: 7 })).toThrow(
      /revisión/i
    );
    expect(
      saveProductInput.parse({ ...base, id: 7, expectedRevision: 2 }).book
        ?.condition
    ).toBe("new");
    expect(
      saveProductInput.parse({
        ...base,
        book: { ...base.book, condition: "used" },
      }).book?.condition
    ).toBe("used");
  });

  it("valida tarifas explícitas y provincias de cobertura de la tienda", () => {
    expect(
      saveStoreInput.parse({
        name: "Tienda",
        description: "",
        province: "Panamá",
        city: "Panamá",
        shippingFeeCents: 0,
        homeFeeCents: null,
        deliveryProvinces: ["Panamá", "Colón"],
      })
    ).toMatchObject({ shippingFeeCents: 0, homeFeeCents: null });
    expect(
      saveStoreInput.parse({
        name: "Tienda",
        description: "",
        province: "Panamá",
        city: "Panamá",
      })
    ).toMatchObject({
      shippingFeeCents: null,
      homeFeeCents: null,
      deliveryProvinces: [],
    });
    expect(() =>
      saveStoreInput.parse({
        name: "Tienda",
        description: "",
        province: "Panamá",
        city: "Panamá",
        deliveryProvinces: ["No existe"],
      })
    ).toThrow();
  });

  it("usa errores de dominio sin exponer secretos", () => {
    const error = new CatalogError("CONFLICT", "La revisión cambió");
    expect(error.code).toBe("CONFLICT");
    expect(error.message).not.toMatch(/password|secret|token/i);
  });
});

describe("integridad de artículos publicados", () => {
  const product: Product = {
    id: 1,
    storeId: 1,
    ownerUserId: 1,
    slug: "prueba-unitaria",
    kind: "product",
    title: "Producto",
    description: "Descripción",
    category: "Hogar",
    priceCents: 1000,
    status: "published",
    revision: 1,
    bookMetadata: null,
    imageUrls: ["/media/catalog/prueba.webp"],
    deliveryModes: ["pickup"],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const variant: Variant = {
    id: 1,
    productId: 1,
    sku: "BASE",
    size: null,
    color: null,
    stock: 3,
    priceCents: 1000,
    active: 1,
  };
  it("no admite retirar todas las fotos, descripción o entrega de un artículo publicado", () => {
    expect(() => validatePublishable(product, [variant])).not.toThrow();
    expect(() =>
      validatePublishable({ ...product, imageUrls: [] }, [variant])
    ).toThrow(/imagen/);
    expect(() =>
      validatePublishable({ ...product, description: "" }, [variant])
    ).toThrow(/incompleta/);
    expect(() =>
      validatePublishable({ ...product, deliveryModes: [] }, [variant])
    ).toThrow(/entrega/);
  });
  it("no admite precios cero de variantes publicadas ni libros sin autor", () => {
    expect(() =>
      validatePublishable(product, [{ ...variant, priceCents: 0 }])
    ).toThrow(/precio/);
    expect(() =>
      validatePublishable(
        {
          ...product,
          kind: "book",
          bookMetadata: {
            author: "",
            publisher: "",
            isbn: "",
            language: "",
            format: "",
            condition: "new",
          },
        },
        [variant]
      )
    ).toThrow(/metadata/);
  });
});
