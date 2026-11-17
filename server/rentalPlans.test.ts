import { describe, expect, it } from "vitest";
import {
  RENTAL_PLANS,
  isSectionPlanId,
  listingLimitFor,
  listingPlanAmountCents,
  listingPlanName,
  listingRange,
  sectionPlanIds,
  sectionPlanInfo,
} from "../shared/pricing";
import { RENTAL_PLANS_SINCE, propertyVisible } from "./services/realEstate";

describe("planes de alquiler de bienes raíces", () => {
  it("Particular, Agente, Agencia e Inmobiliaria con sus precios y topes al mes", () => {
    expect(sectionPlanIds("alquileres")).toEqual(["particular", "agente", "agencia", "inmobiliaria"]);
    expect(Object.values(RENTAL_PLANS).map(p => [p.name, p.monthlyCents, p.limit])).toEqual([
      ["Particular", 1999, 5],
      ["Agente", 4999, 20],
      ["Agencia", 7999, 50],
      ["Inmobiliaria", 14999, null],
    ]);
    expect(listingRange("agencia", "alquileres")).toBe("De 21 a 50");
    expect(listingPlanName("inmobiliaria")).toBe("Inmobiliaria");
    // La prueba gratis cuenta como Particular.
    expect(listingLimitFor("prueba", "alquileres")).toBe(5);
    // Pago anual con 10 % de descuento: 19.99 × 12 × 0.9 = 215.89.
    expect(listingPlanAmountCents("particular", 12)).toBe(21589);
  });

  it("la venta sigue con sus planes y no acepta los de alquiler", () => {
    expect(sectionPlanIds("inmuebles")).toEqual(["basico", "medio", "grande"]);
    expect(sectionPlanInfo("inmuebles", "basico")?.monthlyCents).toBe(4999);
    expect(isSectionPlanId("agente", "inmuebles")).toBe(false);
    expect(isSectionPlanId("basico", "alquileres")).toBe(false);
    expect(isSectionPlanId("agente", "alquileres")).toBe(true);
  });

  it("qué inmuebles se ven según el plan", () => {
    const on = { active: true, featured: false };
    const off = { active: false, featured: false };
    const before = new Date(RENTAL_PLANS_SINCE.getTime() - 86400_000);
    const after = new Date(RENTAL_PLANS_SINCE.getTime() + 86400_000);
    // Venta: plan de venta.
    expect(propertyVisible({ operation: "venta", publishedAt: after }, on, off).visible).toBe(true);
    expect(propertyVisible({ operation: "venta", publishedAt: after }, off, on).visible).toBe(false);
    // Alquiler nuevo: necesita el plan de alquiler.
    expect(propertyVisible({ operation: "alquiler", publishedAt: after }, on, off).visible).toBe(false);
    expect(propertyVisible({ operation: "alquiler", publishedAt: after }, off, on).visible).toBe(true);
    // Alquiler publicado antes del cambio: sigue visible con el plan de venta activo.
    expect(propertyVisible({ operation: "alquiler", publishedAt: before }, on, off).visible).toBe(true);
    expect(propertyVisible({ operation: "alquiler", publishedAt: before }, off, off).visible).toBe(false);
  });
});
