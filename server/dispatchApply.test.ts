import { describe, expect, it } from "vitest";
import { applyDispatcherInput, dispatchDocKinds, vehicleNeedsPlate } from "../shared/dispatch";

const base = { fullName: "Carlos Ríos", phone: "+50761234567", province: "Panamá" };

describe("solicitud de despachador", () => {
  it("moto y carro piden placa", () => {
    expect(applyDispatcherInput.safeParse({ ...base, vehicle: "moto", plate: "" }).success).toBe(false);
    expect(applyDispatcherInput.safeParse({ ...base, vehicle: "carro", plate: " " }).success).toBe(false);
    expect(applyDispatcherInput.safeParse({ ...base, vehicle: "moto", plate: "AB1234" }).success).toBe(true);
  });
  it("la bicicleta eléctrica no necesita placa", () => {
    expect(vehicleNeedsPlate("bicicleta")).toBe(false);
    expect(applyDispatcherInput.safeParse({ ...base, vehicle: "bicicleta", plate: "" }).success).toBe(true);
  });
  it("pide cuatro documentos: licencia, récord, selfie y vehículo", () => {
    expect([...dispatchDocKinds]).toEqual(["licencia", "record", "selfie", "vehiculo"]);
  });
});
