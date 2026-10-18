import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  usePublicCatalog,
  snapshotMatches,
} from "@/contexts/PublicCatalogContext";
import { RealProductCard, RequestError } from "./PublicCatalogPages";

export function LiveFeatured() {
  const { snapshot, mounted } = usePublicCatalog();
  const collections = trpc.catalog.home.useQuery(undefined, {
    enabled: mounted,
    initialData: snapshotMatches(snapshot, "/") ? snapshot.home : undefined,
  });
  const data = collections.data;
  return (
    <section
      className="live-featured container"
      style={{ paddingTop: 32, paddingBottom: 24 }}
      aria-labelledby="live-community-title"
    >
      <div className="live-panel-heading">
        <div>
          <p className="eyebrow">TIENDAS ACTIVAS · DATOS REALES</p>
          <h2 id="live-community-title">La comunidad, en movimiento</h2>
        </div>
        <Link className="btn btn-outline" href="/mercado">
          Ver catálogo activo
        </Link>
      </div>
      {collections.error || (snapshot.failed && !mounted) ? (
        <RequestError
          message="No pudimos cargar las colecciones. Tus datos no se han modificado."
          retry={() => collections.refetch()}
        />
      ) : !data ? (
        <p role="status">Cargando novedades de la comunidad…</p>
      ) : (
        <>
          {data.newest.length === 0 && (
            <div className="live-notice">
              <strong>Prepara tu tienda y tus publicaciones.</strong>
              <p>
                Las publicaciones reales aparecerán después de verificar al
                vendedor y activar su plan. Los ejemplos de abajo permiten
                explorar el diseño, pero no generan ventas reales.
              </p>
              <Link href="/vendedor/tienda" className="btn btn-gold">
                Preparar mi tienda
              </Link>
            </div>
          )}
          {[
            {
              title: "Novedades de nuestra comunidad",
              items: data.newest,
              href: "/mercado?sort=newest",
              empty: "Todavía no hay publicaciones de tiendas activas.",
            },
            {
              title: "Más vendidos",
              items: data.bestSellers,
              href: "/mercado?sort=popular",
              empty:
                "Esta selección aparecerá cuando existan compras entregadas. No mostramos ventas inventadas.",
            },
            {
              title: "Libros que nos hacen crecer",
              items: data.books,
              href: "/mercado?kind=book",
              empty:
                "Los libros de vendedores verificados aparecerán aquí al publicar sus tiendas.",
            },
          ].map((collection, i) => (
            <section
              className="live-home-collection"
              key={collection.title}
              aria-labelledby={`live-collection-${i}`}
            >
              <div className="live-panel-heading">
                <h3 id={`live-collection-${i}`}>{collection.title}</h3>
                <Link className="text-link" href={collection.href}>
                  Explorar
                </Link>
              </div>
              {collection.items.length ? (
                <div className="live-product-grid">
                  {collection.items.map(p => (
                    <RealProductCard key={p.id} product={p} />
                  ))}
                </div>
              ) : (
                <p className="live-muted">{collection.empty}</p>
              )}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
