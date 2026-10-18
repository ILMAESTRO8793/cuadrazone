import { describe, expect, it } from "vitest";
import {
  canEditApplication,
  failClosedVerification,
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

  it("expone readiness fail-closed sin proveedores", async () => {
    expect(PROVIDERS).toEqual({ emailReady: false, phoneReady: false });
    await expect(failClosedVerification()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await expect(failClosedVerification()).rejects.toThrow(
      /no hay proveedor autorizado\/configurado/
    );
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
