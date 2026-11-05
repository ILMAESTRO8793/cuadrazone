import { describe, expect, it } from "vitest";
import { sameName } from "./services/storeDeletion";

describe("confirmación para eliminar la tienda", () => {
  it("exige el nombre de la tienda, sin importar mayúsculas ni espacios extra", () => {
    expect(sameName("artesanías  chilibre ", "Artesanías Chilibre")).toBe(true);
    expect(sameName("Artesanias Chilibre", "Artesanías Chilibre")).toBe(false);
    expect(sameName("", "Artesanías Chilibre")).toBe(false);
    expect(sameName("Artesanías", "Artesanías Chilibre")).toBe(false);
  });
});
