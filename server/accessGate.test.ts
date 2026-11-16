import { describe, expect, it } from "vitest";
import { isPublicPath, loginRedirectFor } from "../shared/accessGate";
import { footerLegalLinks } from "../client/src/data/legal";

describe("acceso con cuenta", () => {
  it("la web es libre: se ve sin cuenta", () => {
    for (const path of [
      "/",
      "/entrar",
      "/ayuda",
      "/mercado",
      "/servicios",
      "/servicio/clase-de-ingles",
      "/articulo/esmoquin",
      "/tiendas",
      "/tiendas/algo",
      "/autos",
      "/autos/toyota-2020",
      "/bienes-raices",
      "/empleos",
      "/empleos/cajero",
      "/eventos",
      "/vender",
      "/suscripciones",
    ])
      expect(isPublicPath(path), path).toBe(true);
    for (const link of footerLegalLinks)
      expect(isPublicPath(link.href)).toBe(true);
  });

  it("las páginas personales siguen pidiendo iniciar sesión", () => {
    for (const path of [
      "/mi-cuenta",
      "/mi-carrito",
      "/comprar",
      "/checkout",
      "/pedidos",
      "/pedidos/12",
      "/mensajes",
      "/notificaciones",
      "/mis-boletos",
      "/despachador",
      "/solicitud-vendedor",
      "/vendedor",
      "/vendedor/productos",
      "/admin",
      "/admin/despachadores",
      "/autos/mis-anuncios",
      "/bienes-raices/mis-anuncios",
      "/empleos/mi-cv",
      "/empleos/mis-vacantes",
    ])
      expect(isPublicPath(path), path).toBe(false);
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
