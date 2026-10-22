import { describe, expect, it } from "vitest";
import { applicationInput, CONSENT_VERSION, saveApplicationInput, splitApplicationSave } from "../shared/membership";
import {
  canEditApplication,
  accountEmailMatches,
  contactRequirementError,
  sellerCapabilities,
  validateDocumentBytes,
  MembershipError,
  PROVIDERS,
  isValidCalendarDate,
  validateDocumentExpiry,
  toTRPCError,
} from "./services/membership";
import {
  documentIdFromInsertResult,
  nextApplicationRevision,
  updateChanged,
} from "./services/privateDocuments";

describe("CuadraZone membership guards", () => {
  it("mantiene comprador gratis y no activa tienda solo por aprobación", () => {
    expect(sellerCapabilities("approved", "not_started", false)).toEqual({
      buyer: true,
      sellerVerified: true,
      sellerActive: false,
      admin: false,
    });
    expect(sellerCapabilities("approved", "active", false).sellerActive).toBe(
      true
    );
    expect(sellerCapabilities("draft", "active", false).sellerActive).toBe(
      false
    );
  });

  it("solo permite edición en draft o rejected", () => {
    expect(canEditApplication("draft")).toBe(true);
    expect(canEditApplication("rejected")).toBe(true);
    expect(canEditApplication("pending")).toBe(false);
    expect(canEditApplication("approved")).toBe(false);
  });

  it("valida firmas de PDF, PNG, JPEG y WEBP y rechaza MIME falso", () => {
    expect(() =>
      validateDocumentBytes(Buffer.from("%PDF-1.7"), "application/pdf")
    ).not.toThrow();
    expect(() =>
      validateDocumentBytes(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png"
      )
    ).not.toThrow();
    expect(() =>
      validateDocumentBytes(Buffer.from([255, 216, 255, 0]), "image/jpeg")
    ).not.toThrow();
    expect(() =>
      validateDocumentBytes(Buffer.from("RIFFxxxxWEBP"), "image/webp")
    ).not.toThrow();
    expect(() =>
      validateDocumentBytes(Buffer.from("%PDF-1.7"), "image/png")
    ).toThrow(MembershipError);
  });

  it("aplica el límite estricto de 5 MiB", () => {
    expect(() =>
      validateDocumentBytes(Buffer.from("%PDF-"), "application/pdf", 4)
    ).toThrow(/5 MiB|límite/);
  });

  it("guarda una solicitud del formulario real sin rechazar los campos de control", () => {
    const fromClient = saveApplicationInput.parse({
      businessType: "individual", businessName: "", businessCategories: [{ categoryId: "viajes-y-turismo", specialtyIds: [] }],
      identificationType: "cedula", identificationNumber: "8-888-8888", documentExpiry: "", province: "Panamá", city: "Chilibre",
      denominationId: 1, churchName: "Iglesia Central", pastorName: "Pastor Prueba",
      residenceConfirmed: true, faithAccepted: true, conductAccepted: true, privacyAccepted: true,
      revision: 3, consentVersion: CONSENT_VERSION,
    });
    expect(applicationInput.safeParse(fromClient).success).toBe(false);
    const { revision, consentVersion, application } = splitApplicationSave(fromClient);
    expect({ revision, consentVersion }).toEqual({ revision: 3, consentVersion: CONSENT_VERSION });
    expect(applicationInput.safeParse(application).success).toBe(true);
  });

  it("acepta solicitudes de vendedores sin iglesia, pastor, denominación ni declaración de fe", () => {
    const open = applicationInput.safeParse({
      businessType: "individual", businessName: "", businessCategories: [{ categoryId: "viajes-y-turismo", specialtyIds: [] }],
      identificationType: "cedula", identificationNumber: "8-888-8888", documentExpiry: "", province: "Panamá", city: "Chilibre",
      residenceConfirmed: true, conductAccepted: true, privacyAccepted: true,
    });
    expect(open.success).toBe(true);
    if (open.success) expect(open.data).toMatchObject({ denominationId: null, churchName: "", pastorName: "", faithAccepted: false });
    const withChurch = applicationInput.safeParse({ ...(open.success ? open.data : {}), denominationId: 1, churchName: "Iglesia Central", pastorName: "Pastor Prueba" });
    expect(withChurch.success).toBe(true);
    expect(applicationInput.safeParse({ ...(open.success ? open.data : {}), churchName: "X" }).success).toBe(false);
  });

  it("declara correo verificable con Google y teléfono sin proveedor SMS", () => {
    expect(PROVIDERS).toEqual({ emailReady: true, phoneReady: false });
  });

  it("solo verifica el correo cuando coincide con la cuenta de Google", () => {
    const google = { loginMethod: "google", email: "Salem@Ejemplo.com" };
    expect(accountEmailMatches(google, "salem@ejemplo.com ")).toBe(true);
    expect(accountEmailMatches(google, "otro@ejemplo.com")).toBe(false);
    expect(accountEmailMatches({ loginMethod: "manus", email: "salem@ejemplo.com" }, "salem@ejemplo.com")).toBe(false);
    expect(accountEmailMatches({ loginMethod: "google", email: null }, "salem@ejemplo.com")).toBe(false);
    expect(accountEmailMatches({ loginMethod: "google", email: "" }, "")).toBe(false);
  });

  it("permite enviar con teléfono pendiente pero exige ambos verificados para aprobar", () => {
    const base = { phone: "+50761234567", emailVerifiedAt: new Date(), phoneVerifiedAt: null };
    expect(contactRequirementError("submit", base)).toBeNull();
    expect(contactRequirementError("approve", base)).toMatch(/teléfono/);
    expect(contactRequirementError("approve", { ...base, phoneVerifiedAt: new Date() })).toBeNull();
    expect(contactRequirementError("submit", { ...base, emailVerifiedAt: null })).toMatch(/correo/);
    expect(contactRequirementError("submit", { ...base, phone: "" })).toMatch(/teléfono de Panamá/);
    expect(contactRequirementError("submit", { ...base, phone: "+50612345678" })).toMatch(/teléfono de Panamá/);
  });

  it("rechaza fechas de calendario imposibles y acepta vencimientos reales", () => {
    expect(isValidCalendarDate("2026-99-99")).toBe(false);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("2028-02-29")).toBe(true);
    expect(() => validateDocumentExpiry("2026-99-99")).toThrow(MembershipError);
    expect(() => validateDocumentExpiry("2028-02-29")).not.toThrow();
  });

  it("redacta errores de base de datos desconocidos", () => {
    const error = toTRPCError(new Error("SQL password and private row"));
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toBe("No se pudo completar la operación");
  });

  it("acepta IDs del returningId y del resultado driver solo si son safe integers", () => {
    expect(documentIdFromInsertResult([{ id: 41 }])).toBe(41);
    expect(documentIdFromInsertResult([{ insertId: 42 }])).toBe(42);
    expect(() => documentIdFromInsertResult([{ insertId: NaN }])).toThrow(
      MembershipError
    );
  });

  it("mantiene revisión optimista y falla cerrado con resultados sin affectedRows", () => {
    expect(nextApplicationRevision(7)).toBe(8);
    expect(updateChanged({ affectedRows: 1 })).toBe(true);
    expect(updateChanged({ affectedRows: 0 })).toBe(false);
    expect(updateChanged({})).toBe(false);
    expect(() => nextApplicationRevision(Number.MAX_SAFE_INTEGER)).toThrow(
      MembershipError
    );
  });
});
