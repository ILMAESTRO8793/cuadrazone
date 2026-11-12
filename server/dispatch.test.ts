import { describe, expect, it } from "vitest";
import {
  applyDispatcherInput,
  dispatchEarningCents,
  DISPATCH_MIN_CENTS,
} from "../shared/dispatch";

describe("despachadores", () => {
  it("gana el 50 % de la comisión, mínimo US$2", () => {
    // Venta de US$50 con plan Normal: comisión US$5, gana US$2.50.
    expect(dispatchEarningCents(500)).toBe(250);
    // Mayor Visibilidad, venta de US$20: comisión US$1, gana el mínimo.
    expect(dispatchEarningCents(100)).toBe(DISPATCH_MIN_CENTS);
    // Vendedor en prueba gratis: comisión 0, gana el mínimo.
    expect(dispatchEarningCents(0)).toBe(200);
    expect(dispatchEarningCents(1001)).toBe(501);
  });

  it("valida la solicitud", () => {
    const ok = applyDispatcherInput.safeParse({
      fullName: "Ana Pérez",
      phone: "+50761234567",
      province: "Panamá",
      vehicle: "moto",
      plate: "ab123",
    });
    expect(ok.success).toBe(true);
    expect(
      applyDispatcherInput.safeParse({
        fullName: "Ana",
        phone: "61234567",
        province: "Panamá",
        vehicle: "moto",
      }).success
    ).toBe(false);
    expect(
      applyDispatcherInput.safeParse({
        fullName: "Ana Pérez",
        phone: "+50761234567",
        province: "Narnia",
        vehicle: "moto",
      }).success
    ).toBe(false);
  });
});
