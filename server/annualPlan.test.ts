import { describe, expect, it } from "vitest";
import { planAmountCents, sellerPlanAnnualLabel } from "@shared/pricing";
import { expectedAmountCents } from "./services/subscriptions";

describe("plan anual con 10 % de descuento", () => {
  it("Normal: 12 × 19.99 = 239.88 → 215.89", () => {
    expect(planAmountCents("normal", 12)).toBe(21589);
    expect(sellerPlanAnnualLabel("normal")).toBe("US$215.89");
  });
  it("Mayor Visibilidad: 12 × 39.99 = 479.88 → 431.89", () => {
    expect(planAmountCents("mayor_visibilidad", 12)).toBe(43189);
    expect(sellerPlanAnnualLabel("mayor_visibilidad")).toBe("US$431.89");
  });
  it("los demás meses no tienen descuento", () => {
    expect(planAmountCents("normal", 1)).toBe(1999);
    expect(planAmountCents("normal", 6)).toBe(11994);
  });
  it("el servidor exige el mismo monto al registrar el pago", () => {
    expect(expectedAmountCents("normal", 12)).toBe(21589);
    expect(expectedAmountCents("mayor_visibilidad", 3)).toBe(11997);
  });
});
