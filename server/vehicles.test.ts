import { describe, expect, it } from "vitest";
import { km, saveVehicleInput, vehiclePriceLabel } from "../shared/vehicles";

const base = {
  operation: "venta", vehicleType: "sedan", make: "Toyota", model: "Corolla", year: 2020, condition: "usado", mileageKm: 45000,
  transmission: "automatica", fuel: "gasolina", title: "Toyota Corolla 2020 automático", description: "Un solo dueño, mantenimientos en agencia.",
  priceCents: 1_850_000, province: "Panamá", district: "San Miguelito", contactPhone: "+50761234567",
};

describe("anuncios de autos", () => {
  it("acepta un auto usado completo", () => {
    expect(saveVehicleInput.safeParse(base).success).toBe(true);
  });
  it("«Otra» marca obliga a escribirla", () => {
    expect(saveVehicleInput.safeParse({ ...base, make: "Otra" }).success).toBe(false);
    expect(saveVehicleInput.safeParse({ ...base, make: "Otra", otherMake: "Tesla" }).success).toBe(true);
    expect(saveVehicleInput.safeParse({ ...base, make: "Marca inventada" }).success).toBe(false);
  });
  it("el alquiler necesita el período", () => {
    const r = saveVehicleInput.safeParse({ ...base, operation: "alquiler" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("día, semana o mes");
    expect(saveVehicleInput.safeParse({ ...base, operation: "alquiler", rentPeriod: "dia", priceCents: 4500 }).success).toBe(true);
  });
  it("un auto nuevo no puede tener mucho kilometraje y el año debe ser real", () => {
    expect(saveVehicleInput.safeParse({ ...base, condition: "nuevo", mileageKm: 15000 }).success).toBe(false);
    expect(saveVehicleInput.safeParse({ ...base, year: 1900 }).success).toBe(false);
    expect(saveVehicleInput.safeParse({ ...base, year: new Date().getFullYear() + 5 }).success).toBe(false);
  });
  it("muestra precios y kilometraje", () => {
    expect(vehiclePriceLabel({ operation: "venta", priceCents: 1_850_000, rentPeriod: null })).toBe("US$18,500");
    expect(vehiclePriceLabel({ operation: "alquiler", priceCents: 4500, rentPeriod: "dia" })).toBe("US$45 por día");
    expect(km(45000)).toBe("45,000 km");
  });
});

describe("videos de autos", () => {
  const auto = {
    operation: "venta", vehicleType: "sedan", make: "Toyota", model: "Corolla", year: 2020, condition: "usado", mileageKm: 45000,
    transmission: "automatica", fuel: "gasolina", title: "Toyota Corolla 2020 automático", description: "Un solo dueño, mantenimientos en agencia.",
    priceCents: 1_850_000, province: "Panamá", district: "San Miguelito", contactPhone: "+50761234567",
  };
  it("acepta hasta 3 videos", () => {
    const v = (n: number) => Array.from({ length: n }, (_, i) => `/media/catalog/vehicles/1/videos/v${i}.mp4`);
    expect(saveVehicleInput.safeParse({ ...auto, videos: v(3) }).success).toBe(true);
    expect(saveVehicleInput.safeParse({ ...auto, videos: v(4) }).success).toBe(false);
    expect(saveVehicleInput.parse(auto).videos).toEqual([]);
  });
});
