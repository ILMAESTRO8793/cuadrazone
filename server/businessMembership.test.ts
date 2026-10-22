import { CONSENT_VERSION } from "../shared/membership";
import { describe, expect, it } from "vitest";
import {
  applicationInput,
  saveApplicationInput,
} from "@shared/membership";
import {
  businessSelectionsInput,
  readBusinessSelections,
} from "@shared/businessCategories";

const allFields = {
  businessType: "individual" as const,
  businessName: "Taller de prueba",
  businessCategories: [
    { categoryId: "tecnologia-y-digital", specialtyIds: ["tecnologia-y-digital-01", "tecnologia-y-digital-02"] },
    { categoryId: "eventos", specialtyIds: [] },
  ],
  identificationType: "cedula" as const,
  identificationNumber: "8-888-888",
  documentExpiry: "",
  province: "Panamá",
  city: "Panamá",
  denominationId: 1,
  churchName: "Iglesia de prueba",
  pastorName: "Pastor de prueba",
  residenceConfirmed: true,
  faithAccepted: true,
  conductAccepted: true,
  privacyAccepted: true,
};

const saveFields = { ...allFields, consentVersion: CONSENT_VERSION };

describe("business membership classification contract", () => {
  it("accepts a complete application and save DTO with business categories", () => {
    expect(applicationInput.safeParse(allFields).success).toBe(true);
    expect(saveApplicationInput.safeParse(saveFields).success).toBe(true);
  });

  it("rejects unknown category IDs", () => {
    const result = businessSelectionsInput.safeParse([
      { categoryId: "no-existe", specialtyIds: [] },
    ]);
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error.issues[0]?.message).toMatch(/categoría de negocio válida/i);
  });

  it("rejects cross-category specialties and duplicate specialties/categories", () => {
    const crossCategory = businessSelectionsInput.safeParse([
      { categoryId: "eventos", specialtyIds: ["tecnologia-y-digital-01"] },
    ]);
    const duplicateSpecialty = businessSelectionsInput.safeParse([
      { categoryId: "eventos", specialtyIds: ["eventos-01", "eventos-01"] },
    ]);
    const duplicateCategory = businessSelectionsInput.safeParse([
      { categoryId: "eventos", specialtyIds: [] },
      { categoryId: "eventos", specialtyIds: [] },
    ]);
    expect(crossCategory.success).toBe(false);
    expect(duplicateSpecialty.success).toBe(false);
    expect(duplicateCategory.success).toBe(false);
  });

  it("reads only valid legacy details and normalizes omitted specialty arrays", () => {
    expect(readBusinessSelections({ businessCategories: [{ categoryId: "eventos" }] })).toEqual([
      { categoryId: "eventos", specialtyIds: [] },
    ]);
    expect(readBusinessSelections({ businessCategories: [{ categoryId: "no-existe", specialtyIds: [] }] })).toEqual([]);
    expect(readBusinessSelections(null)).toEqual([]);
  });

  it("does not require or perform database mutations", () => {
    expect(readBusinessSelections({ businessCategories: allFields.businessCategories })).toHaveLength(2);
  });
});
