import { describe, expect, it } from "vitest";
import {
  commissionBpsFor,
  isFeaturedPlan,
  listingLimitFor,
  listingPlanAmountCents,
  listingRange,
  LISTING_PLANS,
  plansForStoreKind,
  storeLimits,
  trialEndsFor,
} from "../shared/pricing";

describe("planes por cantidad (16/11/2026)", () => {
  it("comercios: pymes 99 productos, mediana 300, grande sin límite", () => {
    expect(storeLimits("normal", "comercio").productLimit).toBe(99);
    expect(storeLimits("mayor_visibilidad", "comercio").productLimit).toBe(99);
    expect(storeLimits("mediana", "comercio").productLimit).toBe(300);
    expect(storeLimits("grande", "comercio").productLimit).toBeNull();
    // Sin plan elegido vale el más básico de su tipo.
    expect(storeLimits(null, "comercio").productLimit).toBe(99);
  });

  it("servicios: Normal hasta 20, Mayor Visibilidad sin límite", () => {
    expect(storeLimits("normal", "servicios").serviceLimit).toBe(20);
    expect(
      storeLimits("mayor_visibilidad", "servicios").serviceLimit
    ).toBeNull();
    expect(plansForStoreKind("servicios")).toEqual([
      "normal",
      "mayor_visibilidad",
    ]);
  });

  it("restaurantes: 20, 50 o sin límite de menús y no venden productos", () => {
    expect(plansForStoreKind("restaurante")).toEqual([
      "rest_basico",
      "rest_medio",
      "rest_grande",
    ]);
    expect(storeLimits(null, "restaurante").dishLimit).toBe(20);
    expect(storeLimits("rest_medio", "restaurante").dishLimit).toBe(50);
    expect(storeLimits("rest_grande", "restaurante").dishLimit).toBeNull();
    expect(storeLimits("rest_basico", "restaurante").productLimit).toBe(0);
  });

  it("bienes raíces, autos y empleos: 20, 100 o sin límite", () => {
    expect(listingLimitFor("prueba")).toBe(20);
    expect(listingLimitFor("basico")).toBe(20);
    expect(listingLimitFor("medio")).toBe(100);
    expect(listingLimitFor("grande")).toBeNull();
    expect(LISTING_PLANS.basico.monthlyCents).toBe(4999);
    expect(LISTING_PLANS.medio.monthlyCents).toBe(7999);
    expect(LISTING_PLANS.grande.monthlyCents).toBe(14999);
  });

  it("comisión: 10/5/3 en comercios y restaurantes; 0 en el mes gratis", () => {
    const paid = null;
    expect(commissionBpsFor("normal", paid)).toBe(1000);
    expect(commissionBpsFor("mayor_visibilidad", paid)).toBe(500);
    expect(commissionBpsFor("mediana", paid)).toBe(500);
    expect(commissionBpsFor("grande", paid)).toBe(300);
    expect(commissionBpsFor("rest_basico", paid)).toBe(1000);
    expect(commissionBpsFor("rest_medio", paid)).toBe(500);
    expect(commissionBpsFor("rest_grande", paid)).toBe(300);
    expect(commissionBpsFor("prueba", paid)).toBe(0);
  });

  it("medianas y grandes tienen las 5 estrellas y «Destacados»", () => {
    expect(isFeaturedPlan("mediana")).toBe(true);
    expect(isFeaturedPlan("grande")).toBe(true);
    expect(isFeaturedPlan("normal")).toBe(false);
    expect(isFeaturedPlan("rest_grande")).toBe(true);
    expect(isFeaturedPlan("rest_medio")).toBe(true);
    expect(isFeaturedPlan("rest_basico")).toBe(false);
  });

  it("mes gratis: antes de enero de 2027 llega al 1 de febrero; después, 1 mes", () => {
    expect(trialEndsFor(new Date("2026-11-20T15:00:00Z")).toISOString()).toBe(
      "2027-02-01T05:00:00.000Z"
    );
    expect(trialEndsFor(new Date("2026-12-31T20:00:00Z")).toISOString()).toBe(
      "2027-02-01T05:00:00.000Z"
    );
    expect(
      trialEndsFor(new Date("2027-01-15T12:00:00Z")).toISOString().slice(0, 10)
    ).toBe("2027-02-15");
  });
});

describe("plan anual de Bienes raíces, Autos y Empleos", () => {
  it("12 meses llevan 10 % de descuento; menos meses, precio completo", () => {
    expect(listingPlanAmountCents("basico", 12)).toBe(53989);
    expect(listingPlanAmountCents("medio", 12)).toBe(86389);
    expect(listingPlanAmountCents("grande", 12)).toBe(161989);
    expect(listingPlanAmountCents("basico", 3)).toBe(4999 * 3);
  });
});

describe("Empleos: topes propios por mes", () => {
  it("hasta 10, de 11 a 20 y más de 20 vacantes", () => {
    expect(listingLimitFor("basico", "empleos")).toBe(10);
    expect(listingLimitFor("prueba", "empleos")).toBe(10);
    expect(listingLimitFor("medio", "empleos")).toBe(20);
    expect(listingLimitFor("grande", "empleos")).toBeNull();
    expect(listingRange("basico", "empleos")).toBe("Hasta 10");
    expect(listingRange("medio", "empleos")).toBe("De 11 a 20");
    expect(listingRange("grande", "empleos")).toBe("Más de 20");
  });
  it("bienes raíces en venta sigue en 20, 100 y sin límite", () => {
    expect(listingLimitFor("basico", "inmuebles")).toBe(20);
    expect(listingLimitFor("medio", "inmuebles")).toBe(100);
    expect(listingRange("medio", "inmuebles")).toBe("De 21 a 100");
  });
});
