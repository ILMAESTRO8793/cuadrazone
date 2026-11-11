import { describe, expect, it } from "vitest";
import { ownedLogoKey, storeLogoFolder } from "./services/storeLogo";
import { initialsOf } from "../client/src/components/marketplace/StoreLogo";

/* Logo de la tienda: dónde se guarda y qué se muestra sin logo. */

describe("logo de la tienda", () => {
  it("se guarda dentro de la carpeta pública del catálogo", () => {
    expect(storeLogoFolder(12)).toBe("catalog/stores/12");
  });
  it("solo borra un logo anterior de la misma tienda", () => {
    expect(ownedLogoKey(12, "/media/catalog/stores/12/a.png")).toBe(
      "catalog/stores/12/a.png"
    );
    expect(ownedLogoKey(12, "/media/catalog/stores/13/a.png")).toBeNull();
    expect(ownedLogoKey(12, "/media/catalog/stores/12/../13/a.png")).toBeNull();
    expect(ownedLogoKey(12, "https://otro.com/a.png")).toBeNull();
    expect(ownedLogoKey(12, null)).toBeNull();
  });
  it("sin logo muestra las iniciales de la tienda", () => {
    expect(initialsOf("Dulces de Ana")).toBe("DA");
    expect(initialsOf("Librería Nueva Vida")).toBe("LV");
    expect(initialsOf("ñandú")).toBe("Ñ");
    expect(initialsOf("  ")).toBe("?");
  });
});
