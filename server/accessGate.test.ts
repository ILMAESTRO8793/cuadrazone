import { describe, expect, it } from "vitest";
import { isPublicPath, loginRedirectFor } from "../shared/accessGate";
import { footerLegalLinks } from "../client/src/data/legal";

describe("acceso con cuenta", () => {
  it("solo deja ver sin sesión la entrada, la ayuda y los documentos legales", () => {
    expect(isPublicPath("/entrar")).toBe(true);
    expect(isPublicPath("/ayuda")).toBe(true);
    for (const link of footerLegalLinks)
      expect(isPublicPath(link.href)).toBe(true);
    for (const path of [
      "/",
      "/mercado",
      "/servicios",
      "/autos",
      "/bienes-raices",
      "/empleos",
      "/vender",
      "/tiendas/algo",
      "/legal",
      "/entrar/otra",
    ]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });

  it("manda a /entrar recordando la página pedida", () => {
    expect(loginRedirectFor("/")).toBe("/entrar");
    expect(loginRedirectFor("/mercado?kind=book")).toBe(
      `/entrar?returnTo=${encodeURIComponent("/mercado?kind=book")}`
    );
  });

  it("conserva el error de inicio de sesión de Google y no acepta destinos externos", () => {
    expect(loginRedirectFor("/?login_error=cancelado")).toBe(
      "/entrar?login_error=cancelado"
    );
    expect(loginRedirectFor("//evil.example/x")).not.toContain("evil.example");
  });
});
