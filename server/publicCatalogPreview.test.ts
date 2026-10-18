import fs from "node:fs";
import { applyPageMetadata } from "./_core/vite";
import { describe, expect, it } from "vitest";
import { renderPage } from "../client/src/entry-server";
import { serializePublicSnapshot } from "./services/publicSnapshot";
import { snapshotMatches } from "../client/src/contexts/PublicCatalogContext";
import { publicCatalogInput } from "../client/src/lib/liveCatalog";
import { listPublicInput } from "@shared/marketplace";
describe("vista previa del catálogo persistente", () => {
  it("entrega el estado vacío real en HTML, sin inventar tiendas activas", () => {
    const result = renderPage("/mercado", {
      url: "/mercado",
      catalog: { items: [], nextCursor: null },
    });
    expect(result.html).toContain("Aquí aparecerán las tiendas activas");
    expect(result.html).toContain("Ver catálogo de ejemplo");
    expect(result.meta.status).toBe(200);
  });
  it("devuelve 404 al faltar un artículo o tienda públicos", () => {
    expect(renderPage("/articulo/ausente", { product: null }).meta.status).toBe(
      404
    );
    expect(renderPage("/tiendas/ausente", { store: null }).meta.status).toBe(
      404
    );
  });
  it("no convierte una caída de datos en ausencia inventada", () => {
    expect(renderPage("/mercado", { failed: true }).meta.status).toBe(503);
  });
  it("marca las rutas privadas sin agregar datos personales al snapshot", () => {
    for (const path of [
      "/mi-carrito",
      "/comprar",
      "/pedidos",
      "/pedidos/123",
      "/mensajes",
      "/notificaciones",
      "/vendedor/productos",
    ]) {
      const result = renderPage(path);
      expect(result.meta.private).toBe(true);
      expect(result.html).not.toContain("Pago directo: transfer");
    }
  });
  it("evita cerrar el bloque JSON con texto de un buscador", () => {
    const value = {
      url: "/mercado?q=</script><script>alert(1)</script>\u2028",
    };
    const safe = serializePublicSnapshot(value);
    expect(safe).not.toContain("<");
    expect(safe).not.toContain("\u2028");
    expect(JSON.parse(safe)).toEqual(value);
  });
  it("no reutiliza datos de otra ruta o filtros", () => {
    expect(
      snapshotMatches(
        { url: "/mercado?kind=book&q=vida" },
        "/mercado?q=vida&kind=book"
      )
    ).toBe(true);
    expect(
      snapshotMatches({ url: "/mercado?kind=book" }, "/mercado?kind=product")
    ).toBe(false);
    expect(snapshotMatches({ url: "/" }, "/mercado")).toBe(false);
  });
  it("comparte filtros en centavos y rechaza el rango invertido", () => {
    const input = publicCatalogInput(
      "?kind=book&min=19.99&max=40&q=vida&sort=price_asc"
    );
    expect(input.minPriceCents).toBe(1999);
    expect(input.maxPriceCents).toBe(4000);
    expect(input.kind).toBe("book");
    expect(
      listPublicInput.safeParse(publicCatalogInput("?min=40&max=19.99")).success
    ).toBe(false);
  });
});

describe("metadatos SSR y privacidad", () => {
  const template = fs.readFileSync("client/index.html", "utf-8");
  const meta = {
    title: 'Artículo "especial"',
    description: "Datos <seguros> & públicos",
    private: false,
    status: 200,
  };
  it("sustituye título, descripción y metadatos sociales de la plantilla", () => {
    const html = applyPageMetadata(template, meta, false);
    expect(html).not.toContain("{{CZ_");
    expect(html).toContain(
      'property="og:title" content="Artículo &quot;especial&quot;"'
    );
    expect(html).toContain(
      'name="twitter:description" content="Datos &lt;seguros&gt; &amp; públicos"'
    );
    expect(html).not.toContain('content="noindex,nofollow"');
  });
  it("mantiene noindex en cuenta, 404 y vista previa, no en una página pública de producción", () => {
    expect(
      applyPageMetadata(template, { ...meta, private: true }, false)
    ).toContain('content="noindex,nofollow"');
    expect(
      applyPageMetadata(template, { ...meta, status: 404 }, false)
    ).toContain('content="noindex,nofollow"');
    expect(applyPageMetadata(template, meta, true)).toContain(
      'content="noindex,nofollow"'
    );
  });
});

describe("colecciones reales de inicio", () => {
  it("entrega novedades, libros y estado de más vendidos sin inventar compras", () => {
    const html = renderPage("/", {
      url: "/",
      home: { newest: [], bestSellers: [], books: [] },
      catalog: { items: [], nextCursor: null },
    }).html;
    expect(html).toContain("Novedades de nuestra comunidad");
    expect(html).toContain("Libros que nos hacen crecer");
    expect(html).toContain(
      "Esta selección aparecerá cuando existan compras entregadas"
    );
    expect(html).toContain("No mostramos ventas inventadas");
    expect(html).not.toContain("Cargando novedades de la comunidad");
  });
  it("no presenta una colección sin datos cargados como catálogo vacío", () => {
    const html = renderPage("/").html;
    expect(html).toContain("Cargando novedades de la comunidad");
    expect(html).not.toContain(
      "Todavía no hay publicaciones de tiendas activas"
    );
  });
  it("marca indisponibilidad de los datos sin convertirla en ventas inexistentes", () => {
    const result = renderPage("/", { url: "/", failed: true });
    expect(result.meta.status).toBe(503);
    expect(result.html).toContain("No pudimos cargar las colecciones");
    expect(result.html).not.toContain("Cargando novedades de la comunidad");
  });
  it("el contrato separa ventas entregadas de un simple orden por popularidad", () => {
    expect(listPublicInput.parse({ sort: "popular", minSold: 1 }).minSold).toBe(
      1
    );
    expect(listPublicInput.safeParse({ minSold: 0 }).success).toBe(false);
  });
});
