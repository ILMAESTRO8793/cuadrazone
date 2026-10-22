import {
  BusinessClassification,
  StoreSearchMatches,
} from "./StoreDirectoryPage";
import { catalogCategories } from "@shared/marketplace";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { BadgeCheck, Heart, Package, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  usePublicCatalog,
  snapshotMatches,
  type RealProduct,
} from "@/contexts/PublicCatalogContext";
import { publicCatalogInput, usd } from "@/lib/liveCatalog";
import { provinceOptions } from "@shared/membership";
export function RequestError({
  message,
  retry,
}: {
  message: string;
  retry?: () => unknown;
}) {
  return (
    <div className="live-notice live-error" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="btn btn-outline" onClick={() => retry()}>
          Reintentar
        </button>
      )}
    </div>
  );
}
export function RealProductCard({ product }: { product: RealProduct }) {
  const auth = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const favorites = trpc.commerce.favorites.useQuery(undefined, {
    enabled: !auth.loading && Boolean(auth.user),
  });
  const saved =
    favorites.data?.items.some(item => item.id === product.id) === true;
  const toggle = trpc.commerce.toggleFavorite.useMutation({
    onSuccess: () => {
      utils.commerce.favorites.invalidate();
      toast.success("Lista de deseos actualizada");
    },
    onError: e => toast.error(e.message),
  });
  return (
    <article className="live-product-card">
      <Link className="live-product-image" href={`/articulo/${product.slug}`}>
        {product.images[0] ? (
          <img src={product.images[0]} alt={product.title} loading="lazy" />
        ) : (
          <Package size={44} aria-label="Sin fotografía" />
        )}
      </Link>
      <button
        className={`live-heart ${saved ? "is-saved" : ""}`}
        aria-pressed={saved}
        disabled={toggle.isPending}
        aria-label={`Guardar o quitar ${product.title} de deseos`}
        onClick={() =>
          auth.user
            ? toggle.mutate({ productId: product.id })
            : navigate("/mi-cuenta")
        }
      >
        <Heart size={19} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="live-product-body">
        <small>
          {product.kind === "book" ? "Libro cristiano" : product.category}
        </small>
        <Link href={`/articulo/${product.slug}`}>
          <h3>{product.title}</h3>
        </Link>
        <Link
          className="live-store-name"
          href={`/tiendas/${product.store.slug}`}
        >
          <BadgeCheck size={14} /> {product.store.name}
        </Link>
        <strong>{usd(product.priceCents)}</strong>
        <p>
          {product.store.province} · {product.reviewCount} reseñas
          {product.soldCount > 0 &&
            ` · ${product.soldCount} unidades entregadas`}
        </p>
      </div>
    </article>
  );
}
export function LiveCatalogPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { snapshot, mounted } = usePublicCatalog();
  const input = publicCatalogInput(search);
  const result = trpc.catalog.list.useQuery(input, {
    enabled: mounted,
    initialData: snapshotMatches(
      snapshot,
      `/mercado${search ? `?${search.replace(/^\?/, "")}` : ""}`
    )
      ? snapshot.catalog
      : undefined,
  });
  const [more, setMore] = useState<RealProduct[]>([]);
  const [cursor, setCursor] = useState<number>();
  const next = trpc.catalog.list.useQuery(
    { ...input, cursor },
    { enabled: mounted && cursor !== undefined }
  );
  useEffect(() => {
    setMore([]);
    setCursor(undefined);
  }, [search]);
  useEffect(() => {
    if (next.data && cursor !== undefined)
      setMore(previous => [
        ...previous.filter(
          item => !next.data.items.some(n => n.id === item.id)
        ),
        ...next.data.items,
      ]);
  }, [next.data, cursor]);
  const products = [...(result.data?.items ?? []), ...more];
  const nextCursor =
    cursor !== undefined ? next.data?.nextCursor : result.data?.nextCursor;
  function filter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = new URLSearchParams();
    new FormData(e.currentTarget).forEach((value, key) => {
      if (String(value).trim()) p.set(key, String(value).trim());
    });
    navigate(`/mercado?${p.toString()}`);
  }
  const current = new URLSearchParams(search);
  return (
    <div className="live-page container">
      <p className="eyebrow">CATÁLOGO PERSISTENTE · PANAMÁ</p>
      <h1>Descubre tiendas de nuestra comunidad</h1>
      <p className="live-lead">
        Productos y libros publicados por vendedores aprobados con una tienda
        activa. Tu cuenta de comprador es gratuita.
      </p>
      {input.q && (
        <StoreSearchMatches
          key={`${input.q}-${input.province ?? ""}`}
          q={input.q}
          province={input.province}
        />
      )}
      <div className="live-catalog-layout">
        <form
          className="live-filters"
          key={search}
          onSubmit={filter}
          action="/mercado"
        >
          <h2>
            <Search size={19} /> Encuentra lo que necesitas
          </h2>
          <label>
            Buscar
            <input
              name="q"
              maxLength={120}
              defaultValue={current.get("q") ?? ""}
              placeholder="Producto, tienda, autor o ISBN"
            />
          </label>
          <label>
            Tipo
            <select name="kind" defaultValue={current.get("kind") ?? ""}>
              <option value="">Productos y libros</option>
              <option value="product">Productos físicos</option>
              <option value="book">Libros cristianos</option>
            </select>
          </label>
          <label>
            Categoría
            <input
              name="category"
              maxLength={120}
              defaultValue={current.get("category") ?? ""}
              placeholder="Ej. Hogar o Tecnología"
              list="live-categories"
            />
            <datalist id="live-categories">
              {catalogCategories.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Provincia
            <select
              name="province"
              defaultValue={current.get("province") ?? ""}
            >
              <option value="">Todo Panamá</option>
              {provinceOptions.map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <div className="live-field-row">
            <label>
              Mínimo US$
              <input
                name="min"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                defaultValue={current.get("min") ?? ""}
              />
            </label>
            <label>
              Máximo US$
              <input
                name="max"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                defaultValue={current.get("max") ?? ""}
              />
            </label>
          </div>
          <label>
            Calificación
            <select name="rating" defaultValue={current.get("rating") ?? ""}>
              <option value="">Todas las calificaciones</option>
              <option value="4">4 estrellas o más</option>
              <option value="3">3 estrellas o más</option>
            </select>
          </label>
          <label>
            Ordenar
            <select name="sort" defaultValue={current.get("sort") ?? "newest"}>
              <option value="newest">Novedades</option>
              <option value="price_asc">Menor precio</option>
              <option value="price_desc">Mayor precio</option>
              <option value="popular">Más vendidos</option>
            </select>
          </label>
          <button className="btn btn-gold" type="submit">
            Aplicar filtros
          </button>
          <Link className="btn btn-outline" href="/mercado">
            Limpiar filtros
          </Link>
        </form>
        <section aria-label="Resultados del catálogo">
          {result.error ? (
            <RequestError
              message={result.error.message}
              retry={() => result.refetch()}
            />
          ) : !result.data ? (
            <p role="status">Cargando catálogo…</p>
          ) : products.length === 0 ? (
            <div className="live-empty">
              <Store size={40} />
              <h2>
                {input.q || input.category || input.province
                  ? "No hay resultados con estos filtros"
                  : "Aquí aparecerán las tiendas activas"}
              </h2>
              <p>
                No se publican tiendas sin aprobación y suscripción activa. La
                verificación de correo/SMS y los pagos siguen pendientes.
              </p>
              <Link className="btn btn-outline" href="/catalogo">
                Ver catálogo de ejemplo
              </Link>
              <Link className="btn btn-gold" href="/vendedor/productos">
                Preparar mis productos
              </Link>
            </div>
          ) : (
            <>
              <p className="live-count">
                {products.length} publicaciones cargadas · sin recargos para el
                comprador
              </p>
              <div className="live-product-grid">
                {products.map(p => (
                  <RealProductCard key={p.id} product={p} />
                ))}
              </div>
              {nextCursor != null && (
                <button
                  className="btn btn-outline"
                  disabled={next.isFetching}
                  onClick={() => setCursor(nextCursor)}
                >
                  Cargar más
                </button>
              )}
              {next.error && (
                <RequestError
                  message={next.error.message}
                  retry={() => next.refetch()}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
export function LiveStorePage({ slug }: { slug: string }) {
  const { snapshot, mounted } = usePublicCatalog();
  const data = trpc.catalog.store.useQuery(
    { slug },
    {
      enabled: mounted,
      initialData:
        snapshot.store?.store.slug === slug ? snapshot.store : undefined,
    }
  );
  if (data.error)
    return (
      <div className="live-page container">
        <RequestError
          message={data.error.message}
          retry={() => data.refetch()}
        />
      </div>
    );
  if (!data.data)
    return (
      <div className="live-page container">
        <h1>Tienda no disponible</h1>
        <p>Solo se muestran tiendas de vendedores aprobados y activos.</p>
        <Link href="/mercado" className="btn btn-gold">
          Explorar catálogo
        </Link>
      </div>
    );
  const { store, products } = data.data;
  return (
    <div className="live-page container">
      <Link href="/mercado">← Volver al catálogo</Link>
      <section className="live-store-banner">
        <Store size={40} />
        <div>
          <p className="eyebrow">VENDEDOR VERIFICADO</p>
          <h1>{store.name}</h1>
          <p>{store.description}</p>
          <p>
            {store.province} · {store.city} · {store.churchName}
          </p>
        </div>
        <BadgeCheck size={32} />
      </section>
      <section className="live-panel">
        <h2>Categorías de este negocio</h2>
        <BusinessClassification selections={data.data.businessCategories} />
      </section>
      <h2>Productos de esta tienda</h2>
      <div className="live-product-grid">
        {products.map(p => (
          <RealProductCard key={p.id} product={p} />
        ))}
      </div>
      {!products.length && (
        <p>La tienda todavía no tiene publicaciones disponibles.</p>
      )}
    </div>
  );
}
