import { describe, expect, it } from "vitest";
import { storeKindError } from "../shared/membership";
import { saveProductInput } from "../shared/marketplace";
import { durationLabel, saveServiceInput, servicePriceLabel } from "../shared/services";
import { validateVideoBytes } from "./services/catalogVideos";

describe("comercio o servicios: uno solo", () => {
  it("cada tipo usa sus propias categorías", () => {
    expect(storeKindError({ storeKind: "comercio", businessCategories: [], productCategories: ["Artesanías"] })).toBeNull();
    expect(storeKindError({ storeKind: "comercio", businessCategories: [], productCategories: [] })).toMatch(/productos/);
    expect(storeKindError({ storeKind: "comercio", businessCategories: [{}], productCategories: ["Artesanías"] })).toMatch(/servicios/);
    expect(storeKindError({ storeKind: "servicios", businessCategories: [{}], productCategories: [] })).toBeNull();
    expect(storeKindError({ storeKind: "servicios", businessCategories: [], productCategories: [] })).toMatch(/servicios/);
    expect(storeKindError({ storeKind: "servicios", businessCategories: [{}], productCategories: ["Ropa y calzado"] })).toMatch(/productos/);
  });
});

describe("servicios", () => {
  const base = {
    title: "Destape de tuberías", description: "Destapes, fugas e instalaciones con garantía del trabajo.", serviceType: "a_domicilio",
    categoryId: "hogar-y-construccion", priceType: "desde", priceCents: 2500, modalities: ["a_domicilio"], coverageProvinces: ["Panamá"],
  };
  it("acepta un servicio a domicilio con provincias", () => {
    expect(saveServiceInput.safeParse(base).success).toBe(true);
  });
  it("no tiene campos de envío ni inventario", () => {
    expect(saveServiceInput.safeParse({ ...base, deliveryModes: ["shipping"] }).success).toBe(false);
    expect(saveServiceInput.safeParse({ ...base, stock: 5 }).success).toBe(false);
  });
  it("exige provincias si va a domicilio, precio salvo «a cotizar» y una categoría de servicios", () => {
    expect(saveServiceInput.safeParse({ ...base, coverageProvinces: [] }).success).toBe(false);
    expect(saveServiceInput.safeParse({ ...base, priceCents: null }).success).toBe(false);
    expect(saveServiceInput.safeParse({ ...base, priceType: "cotizar", priceCents: null }).success).toBe(true);
    expect(saveServiceInput.safeParse({ ...base, categoryId: "Artesanías" }).success).toBe(false);
    expect(saveServiceInput.safeParse({ ...base, modalities: ["en_linea"], coverageProvinces: [] }).success).toBe(true);
  });
  it("muestra precio y duración", () => {
    expect(servicePriceLabel({ priceType: "desde", priceCents: 2500 })).toBe("Desde US$25");
    expect(servicePriceLabel({ priceType: "por_hora", priceCents: 1500 })).toBe("US$15 por hora");
    expect(servicePriceLabel({ priceType: "cotizar", priceCents: null })).toBe("A cotizar");
    expect(durationLabel(90)).toBe("1 h 30 min");
    expect(durationLabel(1440)).toBe("1 día");
  });
});

describe("productos tangibles y videos", () => {
  it("acepta datos tangibles y videos de su propio producto", () => {
    const r = saveProductInput.safeParse({
      kind: "product", title: "Bolso tejido", description: "Bolso hecho a mano", category: "Artesanías", priceCents: 2500,
      images: [], deliveryModes: ["pickup"], variants: [{ sku: "B-1", stock: 3, priceCents: 2500 }],
      condition: "nuevo", brand: "Hecho a mano", weightGrams: 400, lengthCm: 30, widthCm: 10, heightCm: 25, warranty: "3 meses",
      videos: ["/media/catalog/products/7/videos/abc.mp4"],
    });
    expect(r.success).toBe(true);
  });
  it("solo acepta videos reales", () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(32)]);
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32)]);
    expect(() => validateVideoBytes(mp4, "video/mp4")).not.toThrow();
    expect(() => validateVideoBytes(mp4, "video/quicktime")).not.toThrow();
    expect(() => validateVideoBytes(webm, "video/webm")).not.toThrow();
    expect(() => validateVideoBytes(Buffer.from("<html>no soy un video</html>"), "video/mp4")).toThrow(/MP4/);
    expect(() => validateVideoBytes(webm, "video/mp4")).toThrow();
  });
});

import { validateBusinessRules } from "./services/membership";
import { applicationInput } from "../shared/membership";
describe("solicitud según el tipo de tienda", () => {
  const base = {
    businessType: "individual", businessName: "", identificationType: "cedula", identificationNumber: "8-888-1234", documentExpiry: "",
    province: "Panamá", city: "Chilibre", legalGivenNames: "Luis", legalSurnames: "Pérez", country: "PA", residenceConfirmed: true,
    faithAccepted: true, conductAccepted: true, privacyAccepted: true,
  };
  it("comercio se acepta solo con categorías de productos", () => {
    const comercio = applicationInput.parse({ ...base, storeKind: "comercio", productCategories: ["Artesanías"], businessCategories: [] });
    expect(() => validateBusinessRules(comercio)).not.toThrow();
  });
  it("servicios se acepta solo con categorías de servicio", () => {
    const servicios = applicationInput.parse({ ...base, storeKind: "servicios", businessCategories: [{ categoryId: "hogar-y-construccion", specialtyIds: [] }] });
    expect(() => validateBusinessRules(servicios)).not.toThrow();
    const sinCategorias = applicationInput.parse({ ...base, storeKind: "servicios", businessCategories: [] });
    expect(() => validateBusinessRules(sinCategorias)).toThrow();
  });
});
