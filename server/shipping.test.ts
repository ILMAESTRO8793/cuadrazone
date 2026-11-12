import { describe, expect, it } from "vitest";
import { coveredProvinces, readFeeMap, saveStoreInput, shippingFeeFor } from "../shared/marketplace";
import { deliveryQuote } from "./services/commerce";
import { MIN_ORDER_CENTS, meetsMinimum, shippingDeal } from "../shared/shippingRules";

const perProvince = { shippingFeeCents: 300, deliveryProvinces: ["Panamá", "Chiriquí"], shippingFeesByProvince: { "Panamá": 300, "Chiriquí": 1200 } };
const legacy = { shippingFeeCents: 500, deliveryProvinces: ["Panamá", "Colón"], shippingFeesByProvince: null };

describe("envío por provincia", () => {
  it("usa el precio de la provincia del comprador", () => {
    expect(shippingFeeFor(perProvince, "Panamá")).toBe(300);
    expect(shippingFeeFor(perProvince, "Chiriquí")).toBe(1200);
    expect(shippingFeeFor(perProvince, "Colón")).toBeNull();
  });
  it("las tiendas con tarifa única siguen funcionando", () => {
    expect(shippingFeeFor(legacy, "Colón")).toBe(500);
    expect(shippingFeeFor(legacy, "Chiriquí")).toBeNull();
    expect(coveredProvinces(legacy)).toEqual(["Panamá", "Colón"]);
  });
  it("lee el mapa aunque venga como texto y descarta provincias inválidas", () => {
    expect(readFeeMap('{"Panamá":300,"Narnia":100,"Coclé":-5}')).toEqual({ "Panamá": 300 });
    expect(readFeeMap(null)).toEqual({});
  });
  it("el formulario acepta solo algunas provincias", () => {
    const parsed = saveStoreInput.parse({ name: "Tienda", description: "", province: "Panamá", city: "Chilibre", shippingFeesByProvince: { "Chiriquí": 1200 } });
    expect(parsed.shippingFeesByProvince).toEqual({ "Chiriquí": 1200 });
    expect(saveStoreInput.safeParse({ name: "Tienda", description: "", province: "Panamá", city: "Chilibre", shippingFeesByProvince: { "Narnia": 1 } }).success).toBe(false);
  });
  it("en la compra la entrega siempre es 0: gratis o acordada aparte", () => {
    const store = { ...perProvince, homeFeeCents: 200 } as any;
    expect(deliveryQuote(store, "shipping", "Chiriquí")).toBe(0);
    expect(deliveryQuote(store, "shipping", "Colón")).toBe(0);
  });
});

describe("reglas de entrega de comercios", () => {
  it("gratis en la misma provincia, sin importar tildes ni mayúsculas", () => {
    expect(shippingDeal("Chiriquí", "chiriqui")).toBe("free");
    expect(shippingDeal("Panamá", "Colón")).toBe("coordinate");
    expect(shippingDeal("", "Panamá")).toBe("coordinate");
  });
  it("compra mínima de US$10 por tienda", () => {
    expect(MIN_ORDER_CENTS).toBe(1000);
    expect(meetsMinimum(999)).toBe(false);
    expect(meetsMinimum(1000)).toBe(true);
  });
});
