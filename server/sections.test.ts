import { describe, expect, it } from "vitest";
import { renderPage } from "../client/src/entry-server";
import { sectionFor } from "../client/src/components/marketplace/MarketLayout";

/** Solo el contenido principal y el menú, sin el pie de página común a todo el sitio. */
function mainAndNav(html: string) {
  const nav = html.slice(html.indexOf('aria-label="Navegación principal"'), html.indexOf("sell-nav"));
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  return { nav, main };
}

describe("Marketplace y Servicios separados", () => {
  it("clasifica cada página en su mundo", () => {
    for (const p of ["/mercado", "/catalogo", "/libros", "/tiendas", "/articulo/x"]) expect(sectionFor(p)).toBe("market");
    for (const p of ["/servicios", "/servicio/x", "/eventos", "/evento/x"]) expect(sectionFor(p)).toBe("services");
    for (const p of ["/", "/mi-cuenta", "/vender"]) expect(sectionFor(p)).toBe("home");
  });
  it("el Marketplace no muestra servicios ni eventos", () => {
    const { nav, main } = mainAndNav(renderPage("/catalogo").html);
    expect(main).toContain("Bolso artesanal");
    expect(main).not.toContain("plomería");
    expect(main).not.toContain("Noche de alabanza");
    expect(nav).not.toContain("Eventos y conciertos");
    expect(renderPage("/catalogo").html).toContain("Ir a Servicios");
  });
  it("Servicios no muestra productos ni libros", () => {
    const { nav, main } = mainAndNav(renderPage("/servicios").html);
    expect(main).toContain("plomería");
    expect(main).not.toContain("Bolso artesanal");
    expect(main).not.toContain("Biblia de estudio");
    expect(nav).not.toContain("Libros cristianos");
    expect(renderPage("/servicios").html).toContain("Ir a Comercios");
  });
});
