import { describe, expect, it } from "vitest";
import { priceLabel, savePropertyInput } from "../shared/realEstate";
import { slugify } from "./services/realEstate";

const base = {
  operation: "venta", propertyType: "casa", title: "Casa con patio en Las Cumbres", description: "Casa amplia de tres recámaras, cerca de escuelas.",
  priceCents: 18_500_000, province: "Panamá", district: "Panamá", contactPhone: "+50761234567",
  bedrooms: 3, bathrooms: 2, areaBuiltM2: 120,
};

describe("anuncios de bienes raíces", () => {
  it("una casa necesita habitaciones, baños y metros de construcción", () => {
    expect(savePropertyInput.safeParse(base).success).toBe(true);
    const sinCuartos = savePropertyInput.safeParse({ ...base, bedrooms: null });
    expect(sinCuartos.success).toBe(false);
    expect(JSON.stringify(sinCuartos.error?.issues)).toContain("habitaciones");
    expect(savePropertyInput.safeParse({ ...base, areaBuiltM2: null }).success).toBe(false);
  });
  it("un terreno necesita metros de terreno y no habitaciones", () => {
    const terreno = { ...base, propertyType: "terreno", bedrooms: null, bathrooms: null, areaBuiltM2: null };
    expect(savePropertyInput.safeParse(terreno).success).toBe(false);
    expect(savePropertyInput.safeParse({ ...terreno, areaLandM2: 1500, landUse: "agricola" }).success).toBe(true);
  });
  it("valida precio, teléfono y campos desconocidos", () => {
    expect(savePropertyInput.safeParse({ ...base, priceCents: 0 }).success).toBe(false);
    expect(savePropertyInput.safeParse({ ...base, contactPhone: "6123-4567" }).success).toBe(false);
    expect(savePropertyInput.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });
  it("muestra el precio de venta o el mensual", () => {
    expect(priceLabel({ operation: "venta", priceCents: 18_500_000 })).toBe("US$185,000");
    expect(priceLabel({ operation: "alquiler", priceCents: 85_000 })).toBe("US$850 al mes");
    expect(priceLabel({ operation: "alquiler", priceCents: 85_050 })).toBe("US$850.50 al mes");
  });
  it("crea enlaces limpios", () => {
    expect(slugify("Apartamento en Costa del Este ¡con vista!")).toBe("apartamento-en-costa-del-este-con-vista");
    expect(slugify("¡¡!!")).toBe("anuncio");
  });
});
