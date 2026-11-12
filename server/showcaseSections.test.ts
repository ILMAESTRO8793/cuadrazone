import { describe, expect, it } from "vitest";
import { showcaseItemKind } from "./services/showcase";

describe("vitrina: comercios y servicios no se mezclan", () => {
  it("un servicio es de Servicios", () => {
    expect(showcaseItemKind("/servicio/clase-de-ingles", "servicios")).toBe(
      "servicios"
    );
    expect(showcaseItemKind("/tiendas/polytalk", "servicios")).toBe(
      "servicios"
    );
  });
  it("un producto o una tienda de comercio es de Comercios", () => {
    expect(showcaseItemKind("/articulo/biblia", "comercio")).toBe("comercios");
    expect(showcaseItemKind("/tiendas/dulces-de-ana", "comercio")).toBe(
      "comercios"
    );
  });
  it("un banner sin tienda sale en cualquier sección", () => {
    expect(showcaseItemKind("https://cuadrazone.com/evento", null)).toBeNull();
  });
});
