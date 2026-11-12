import { describe, expect, it } from "vitest";
import { normalizeStoreLink, storeLinkLabel } from "@shared/storeLink";

describe("enlace del negocio", () => {
  it("acepta web, dominio sin https e Instagram con @", () => {
    expect(normalizeStoreLink("https://polytalk.com")).toBe(
      "https://polytalk.com/"
    );
    expect(normalizeStoreLink("polytalk.com")).toBe("https://polytalk.com/");
    expect(normalizeStoreLink("http://polytalk.com/clases")).toBe(
      "https://polytalk.com/clases"
    );
    expect(normalizeStoreLink("@poly.talk")).toBe(
      "https://instagram.com/poly.talk"
    );
    expect(normalizeStoreLink("instagram.com/polytalk")).toBe(
      "https://instagram.com/polytalk"
    );
  });

  it("rechaza enlaces peligrosos o inválidos", () => {
    expect(normalizeStoreLink("javascript:alert(1)")).toBeNull();
    expect(normalizeStoreLink("data:text/html,hola")).toBeNull();
    expect(normalizeStoreLink("https://user:pass@evil.com")).toBeNull();
    expect(normalizeStoreLink("hola")).toBeNull();
    expect(normalizeStoreLink("")).toBeNull();
  });

  it("muestra un nombre corto", () => {
    expect(storeLinkLabel("https://www.instagram.com/polytalk/")).toBe(
      "instagram.com/polytalk"
    );
  });
});
