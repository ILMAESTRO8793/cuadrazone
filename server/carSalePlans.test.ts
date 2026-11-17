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

  it("el alquiler de autos sigue con Básico, Mediano y Grande", () => {
    expect(sectionPlanIds("autos")).toEqual(["basico", "medio", "grande"]);
    expect(sectionPlanInfo("autos", "medio")?.monthlyCents).toBe(7999);
    expect(isSectionPlanId("vendedor", "autos")).toBe(false);
    expect(isSectionPlanId("basico", "autosventa")).toBe(false);
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
