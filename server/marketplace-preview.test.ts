import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { renderPage } from "../client/src/entry-server";
import { getPageMeta } from "../client/src/lib/pageMeta";
import { SELLER_MONTHLY_FEE_CENTS, SELLER_MONTHLY_FEE_LABEL } from "../shared/pricing";
import { listings, listingSearchText } from "../client/src/data/catalog";
import {
  parseCatalogFilters,
  serializeCatalogFilters,
  filterCatalog,
} from "../client/src/lib/catalogQuery";

describe("CuadraZone preview", () => {
  it("renders meaningful home content and the gold logo without a browser", () => {
    const result = renderPage("/");
    expect(result.meta.status).toBe(200);
    expect(result.html).toContain("tu comunidad.");
    expect(result.html).toContain("/assets/logo-carrito-blanco.png");
    expect(result.html).toContain("No se procesan pagos");
  });
  it("places the verified verse below the unchanged logo, separate from business copy", () => {
    const html = renderPage("/").html;
    const logo = html.indexOf("/assets/logo-carrito-blanco.png");
    const scripture = html.indexOf('class="brand-scripture"');
    expect(scripture).toBeGreaterThan(logo);
    expect(scripture).toBeLessThan(html.indexOf('class="header-location"'));
    expect(html).toContain("¡Mirad cuán bueno y cuán delicioso es");
    expect(html).toContain("Habitar los hermanos juntos en armonía!");
    expect(html).toContain("Salmo 133:1");
    expect(html).not.toContain("Reina-Valera 1960");
    expect(html).toContain("en un espacio con valores cristianos");
  });
  it("renders protected pages with no invented identity and one main region", () => {
    for (const path of ["/vendedor/plan", "/mi-cuenta", "/solicitud-vendedor", "/vendedor", "/admin", "/admin/verificaciones", "/admin/denominaciones"]) {
      const page = renderPage(path);
      expect(page.meta.status).toBe(200);
      expect(page.meta.private).toBe(true);
      expect(page.html).toContain("Preparando tu cuenta");
      expect(page.html.match(/<main\b/g)?.length).toBe(1);
    }
  });
  it("filters the book route in its initial HTML", () => {
    const result = renderPage("/libros");
    expect(result.html).toContain("Biblia de estudio");
    expect(result.html).not.toContain(
      "Auriculares inalámbricos · edición crema"
    );
  });
  it("preserves free buyer accounts and the seller monthly fee", () => {
    const result = renderPage("/suscripciones");
    expect(result.html).toContain("Gratis");
    expect(result.html).not.toContain("2.99");
    expect(result.html).toContain("US$19.99");
    expect(result.html).toContain("US$39.99");
    expect(result.html).toContain("Mayor Visibilidad");
    expect(result.html).toContain("Normal");
    expect(result.html).not.toContain("USD 10.00");
    expect(result.html).toContain("Productos físicos: 5% de comisión por venta entregada");
    expect(result.html).toContain("Los servicios no pagan comisión.");
    expect(result.html).toContain("Los primeros 3 meses son gratis");
    expect(result.html).not.toContain("0% de comisión");
  });
  it("uses the shared USD 19.99 seller fee without restoring a buyer subscription", () => {
    expect(SELLER_MONTHLY_FEE_CENTS).toBe(1999);
    expect(SELLER_MONTHLY_FEE_LABEL).toBe("USD 19.99");
    for (const route of ["/", "/vender", "/suscripciones"]) {
      const html = renderPage(route).html;
      expect(html).toContain("19.99");
      expect(html).not.toMatch(/USD 10\.00|\$10\b|Reina-Valera 1960/);
    }
    for (const file of [
      "client/src/pages/Home.tsx",
      "client/src/pages/marketplace/SubscriptionPlans.tsx",
      "client/src/pages/marketplace/SupportingPages.tsx",
      "client/src/features/membership/AccountPage.tsx",
      "client/src/features/membership/SellerApplicationPage.tsx",
      "client/src/features/membership/SellerStatusPage.tsx",
      "client/src/features/membership/AdminVerificationPage.tsx",
    ]) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).toContain("@shared/pricing");
      expect(source).not.toMatch(/USD 10\.00|\$10\b/);
    }
  });
  it("returns missing routes and missing details as 404", () => {
    expect(getPageMeta("/no-existe").status).toBe(404);
    expect(getPageMeta("/legal/no-existe").status).toBe(404);
    expect(getPageMeta("/producto/no-existe").status).toBe(404);
    expect(getPageMeta(`/producto/${listings[0].slug}`).status).toBe(200);
  });
  it("preserves filters and sort while the query changes", () => {
    const original = parseCatalogFilters(
      "tipo=libro&categoria=Libros+cristianos&provincia=Panam%C3%A1+Oeste&max=50&rating=4.5&sort=precio-menor&q=lino"
    );
    const restored = parseCatalogFilters(
      serializeCatalogFilters({ ...original, q: "Biblia" })
    );
    expect(restored).toEqual({ ...original, q: "Biblia" });
    expect(filterCatalog(restored).map(item => item.id)).toEqual(["biblia"]);
    expect(listingSearchText(listings[1])).toContain("marcador");
  });
  it("declares the full source page route set", () => {
    const app = fs.readFileSync("client/src/App.tsx", "utf8");
    const sourceRoutes = [...app.matchAll(/<Route path="([^"]+)"/g)]
      .map(match => match[1])
      .sort();
    const manifest = JSON.parse(
      fs.readFileSync("client/public/route-manifest.json", "utf8")
    );
    expect(
      manifest.routes.map((route: { path: string }) => route.path).sort()
    ).toEqual(sourceRoutes);
  });
});
