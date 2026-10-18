import { describe, expect, it } from "vitest";
import { validateCatalogImageBytes } from "./services/catalogImages";
import { CatalogError } from "./services/catalog";

describe("fotos del catálogo", () => {
  it("verifica firmas PNG, JPEG y WEBP", () => {
    expect(() => validateCatalogImageBytes(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png")).not.toThrow();
    expect(() => validateCatalogImageBytes(Buffer.from([255, 216, 255, 0]), "image/jpeg")).not.toThrow();
    expect(() => validateCatalogImageBytes(Buffer.from("RIFFxxxxWEBP"), "image/webp")).not.toThrow();
    expect(() => validateCatalogImageBytes(Buffer.from("%PDF-"), "image/png")).toThrow(CatalogError);
  });

  it("rechaza MIME falso, vacío y más de 5 MiB", () => {
    expect(() => validateCatalogImageBytes(Buffer.from([1]), "application/pdf")).toThrow(/MIME|firma/);
    expect(() => validateCatalogImageBytes(Buffer.alloc(0), "image/png")).toThrow(CatalogError);
    expect(() => validateCatalogImageBytes(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png")).toThrow(/5 MiB/);
  });
});
