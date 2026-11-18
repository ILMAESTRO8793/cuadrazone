import { describe, expect, it } from "vitest";
import {
  CAR_SALE_PLANS,
  isSectionPlanId,
  listingLimitFor,
  listingPlanAmountCents,
  listingPlanName,
  listingRange,
  sectionPlanIds,
  sectionPlanInfo,
} from "../shared/pricing";
import { CAR_SALE_PLANS_SINCE, vehicleVisible } from "./services/vehicles";

describe("planes de venta de autos", () => {
  it("Particular, Vendedor, Agencia y Concesionario con sus precios y topes al mes", () => {
    expect(sectionPlanIds("autosventa")).toEqual(["particular", "vendedor", "agencia", "concesionario"]);
    expect(Object.values(CAR_SALE_PLANS).map(p => [p.name, p.monthlyCents, p.limit])).toEqual([
      ["Particular", 1999, 5],
      ["Vendedor", 4999, 20],
      ["Agencia", 7999, 50],
      ["Concesionario", 14999, null],
    ]);
    expect(listingRange("concesionario", "autosventa")).toBe("51 o más");
    expect(listingPlanName("vendedor")).toBe("Vendedor");
    expect(listingLimitFor("prueba", "autosventa")).toBe(5);
    expect(listingPlanAmountCents("concesionario", 1)).toBe(14999);
  });

  it("el alquiler de autos tiene los mismos planes que la venta", () => {
    expect(sectionPlanIds("autos")).toEqual(["particular", "vendedor", "agencia", "concesionario"]);
    expect(sectionPlanInfo("autos", "vendedor")?.monthlyCents).toBe(4999);
    expect(listingLimitFor("agencia", "autos")).toBe(50);
    expect(listingLimitFor("prueba", "autos")).toBe(5);
    expect(listingRange("concesionario", "autos")).toBe("51 o más");
    expect(isSectionPlanId("vendedor", "autos")).toBe(true);
    expect(isSectionPlanId("basico", "autos")).toBe(false);
    expect(isSectionPlanId("basico", "autosventa")).toBe(false);
  });

  it("los planes anteriores del alquiler de autos conservan su tope hasta que vencen", () => {
    expect(listingLimitFor("basico", "autos")).toBe(20);
    expect(listingLimitFor("medio", "autos")).toBe(100);
    expect(listingLimitFor("grande", "autos")).toBeNull();
    expect(listingRange("medio", "autos")).toBe("De 21 a 100");
    expect(sectionPlanInfo("autos", "medio")?.name).toBe("Mediano");
  });

  it("qué autos se ven según el plan", () => {
    const on = { active: true, featured: false };
    const off = { active: false, featured: false };
    const before = new Date(CAR_SALE_PLANS_SINCE.getTime() - 86400_000);
    const after = new Date(CAR_SALE_PLANS_SINCE.getTime() + 86400_000);
    // Alquiler: plan de siempre.
    expect(vehicleVisible({ operation: "alquiler", publishedAt: after }, on, off).visible).toBe(true);
    expect(vehicleVisible({ operation: "alquiler", publishedAt: after }, off, on).visible).toBe(false);
    // Venta nueva: necesita el plan de venta.
    expect(vehicleVisible({ operation: "venta", publishedAt: after }, on, off).visible).toBe(false);
    expect(vehicleVisible({ operation: "venta", publishedAt: after }, off, on).visible).toBe(true);
    // Venta publicada antes del cambio: sigue visible con el plan de siempre.
    expect(vehicleVisible({ operation: "venta", publishedAt: before }, on, off).visible).toBe(true);
  });
});
