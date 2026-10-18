import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { BadgeCheck, MapPin, Store, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  snapshotMatches,
  usePublicCatalog,
} from "@/contexts/PublicCatalogContext";
import {
  businessCategories,
  businessSelectionLabels,
  getBusinessCategory,
  type BusinessSelection,
} from "@shared/businessCategories";
import { provinceOptions } from "@shared/membership";
import {
  storeDirectoryInput,
  storeDirectoryQuery,
  storeDirectoryHref,
  type DirectoryStore,
} from "@shared/storeDirectory";
import { RequestError } from "./PublicCatalogPages";

export function BusinessClassification({
  selections,
}: {
  selections: readonly BusinessSelection[];
}) {
  if (!selections.length)
    return (
      <p className="live-muted">
        Clasificación del negocio pendiente de completar.
      </p>
    );
  return (
    <div className="business-classification">
      {businessSelectionLabels(selections).map(group => (
        <div key={group.categoryId}>
          <Link
            className="business-category-tag"
            href={storeDirectoryHref("", { category: group.categoryId })}
          >
            {group.category}
          </Link>
          {group.specialties.length > 0 && (
            <p>{group.specialties.join(" · ")}</p>
          )}
        </div>
      ))}
    </div>
  );
}
export function DirectoryStoreCard({ store }: { store: DirectoryStore }) {
  return (
    <article className="directory-store-card">
      <div className="directory-store-top">
        <span className="directory-store-icon">
          <Store size={25} />
        </span>
        <span className="directory-verified">
          <BadgeCheck size={16} /> Vendedor verificado
        </span>
      </div>
      <Link href={`/tiendas/${store.slug}`}>
        <h3>{store.name}</h3>
      </Link>
      <p className="directory-store-description">
        {store.description ||
          "Conoce los productos y servicios de este negocio."}
      </p>
      <p className="directory-location">
        <MapPin size={15} /> {store.city}, {store.province}
      </p>
      <BusinessClassification selections={store.businessCategories} />
      <p className="live-muted">{store.churchName}</p>
      <Link className="text-link" href={`/tiendas/${store.slug}`}>
        Visitar tienda <ArrowRight size={16} />
      </Link>
    </article>
  );
}
export function BusinessCategoryBrowse({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <section
      className={`business-browse ${compact ? "business-browse--compact" : ""}`}
      aria-labelledby="business-browse-title"
    >
      <div className="live-panel-heading">
        <div>
          <p className="eyebrow">NEGOCIOS DE LA COMUNIDAD</p>
          <h2 id="business-browse-title">
            Encuentra una tienda por su categoría
          </h2>
        </div>
        <Link className="text-link" href="/tiendas">
          Ver directorio <ArrowRight size={16} />
        </Link>
      </div>
      <p>
        Desde un oficio hasta una empresa: conoce a quienes pueden ayudarte.
      </p>
      <div className="business-category-links">
        {businessCategories.map(category => (
          <Link
            key={category.id}
            href={storeDirectoryHref("", { category: category.id })}
          >
            <span>{category.label}</span>
            <ArrowRight size={15} />
          </Link>
        ))}
      </div>
    </section>
  );
}
export function StoreDirectoryPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { snapshot, mounted } = usePublicCatalog();
  const input = storeDirectoryQuery(search);
  const parsed = storeDirectoryInput.safeParse(input);
  const matches = snapshotMatches(
    snapshot,
    `/tiendas${search ? `?${search.replace(/^\?/, "")}` : ""}`
  );
  const result = trpc.catalog.stores.useQuery(input, {
    enabled: mounted && parsed.success,
    initialData: matches ? snapshot.directory : undefined,
  });
  const [category, setCategory] = useState(input.category ?? "");
  const [more, setMore] = useState<DirectoryStore[]>([]);
  const [cursor, setCursor] = useState<number>();
  const next = trpc.catalog.stores.useQuery(
    { ...input, cursor },
    { enabled: mounted && parsed.success && cursor !== undefined }
  );
  const selectedCategory = getBusinessCategory(category);
  const pageItems = [
    ...new Map(
      [...(result.data?.items ?? []), ...more].map(store => [store.id, store])
    ).values(),
  ];
  const nextCursor =
    cursor !== undefined ? next.data?.nextCursor : result.data?.nextCursor;
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => {
      if (String(value).trim()) params.set(key, String(value).trim());
    });
    navigate(`/tiendas${params.size ? `?${params}` : ""}`);
  }
  // Conserva la página anterior mientras carga la siguiente, sin repetir tiendas.
  useEffect(() => {
    if (next.data && cursor !== undefined)
      setMore(previous => [
        ...previous,
        ...next.data.items.filter(
          item => !previous.some(saved => saved.id === item.id)
        ),
      ]);
  }, [next.data, cursor]);
  const error = !parsed.success
    ? parsed.error.issues[0]?.message
    : matches && snapshot.badRequest
      ? snapshot.badRequest
      : undefined;
  const failedInitial = matches && snapshot.failed && !mounted;
  return (
    <div className="live-page container directory-page">
      <p className="eyebrow">DIRECTORIO DE NEGOCIOS · PANAMÁ</p>
      <h1>Encuentra el talento de tu comunidad</h1>
      <p className="live-lead">
        Elige una categoría o especialidad para descubrir las tiendas
        registradas bajo ella. Aquí buscas negocios, no categorías de productos.
      </p>
      <div className="live-actions">
        <Link href="/mercado" className="btn btn-outline">
          Buscar productos
        </Link>
        <Link href="/solicitud-vendedor" className="btn btn-gold">
          Registrar mi negocio
        </Link>
      </div>
      <div className="live-catalog-layout">
        <aside>
          <form className="live-filters" onSubmit={submit} action="/tiendas">
            <h2>Busca tu negocio</h2>
            <label>
              Nombre o actividad
              <input
                name="q"
                maxLength={120}
                defaultValue={input.q ?? ""}
                placeholder="Ej. plomería, contabilidad o tienda"
              />
            </label>
            <label>
              Categoría del negocio
              <select
                name="category"
                value={category}
                onChange={event => setCategory(event.target.value)}
              >
                <option value="">Todas las categorías</option>
                {businessCategories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Especialidad
              <select
                name="specialty"
                key={category}
                defaultValue={
                  category === input.category ? (input.specialty ?? "") : ""
                }
              >
                <option value="">Todas las especialidades</option>
                {(selectedCategory
                  ? [selectedCategory]
                  : businessCategories
                ).map(c => (
                  <optgroup label={c.label} key={c.id}>
                    {c.specialties.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              Provincia
              <select name="province" defaultValue={input.province ?? ""}>
                <option value="">Todo Panamá</option>
                {provinceOptions.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <button className="btn btn-gold" type="submit">
              Encontrar tiendas
            </button>
            <Link className="btn btn-outline" href="/tiendas">
              Limpiar filtros
            </Link>
          </form>
          <nav
            className="directory-category-nav"
            aria-label="Categorías de negocios"
          >
            <h2>Explorar categorías</h2>
            {businessCategories.map(c => (
              <Link
                key={c.id}
                className={input.category === c.id ? "is-active" : ""}
                href={storeDirectoryHref(search, {
                  category: c.id,
                  specialty: undefined,
                })}
              >
                {c.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section aria-label="Tiendas encontradas" aria-live="polite">
          {error ? (
            <RequestError message={error} />
          ) : result.error || failedInitial ? (
            <RequestError
              message="No pudimos cargar las tiendas. Inténtalo nuevamente."
              retry={() => result.refetch()}
            />
          ) : !result.data ? (
            <p role="status">Cargando tiendas de la comunidad…</p>
          ) : !pageItems.length ? (
            <div className="live-empty">
              <Store size={40} />
              <h2>No hay tiendas activas con estos filtros</h2>
              <p>
                Los negocios aparecerán bajo sus categorías cuando el vendedor
                esté aprobado, sus contactos verificados y su plan activo. No
                añadimos tiendas de ejemplo como si fueran reales.
              </p>
              <Link className="btn btn-outline" href="/tiendas">
                Ver todas las categorías
              </Link>
            </div>
          ) : (
            <>
              <p className="live-count">
                {pageItems.length} tiendas cargadas ·{" "}
                {getBusinessCategory(input.category ?? "")?.label ??
                  "Todas las categorías"}
              </p>
              <div className="directory-store-grid">
                {pageItems.map(store => (
                  <DirectoryStoreCard key={store.id} store={store} />
                ))}
              </div>
            </>
          )}
          {nextCursor != null && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={next.isFetching}
              onClick={() => setCursor(nextCursor)}
            >
              Cargar más tiendas
            </button>
          )}
          {next.error && (
            <RequestError
              message="No pudimos cargar más tiendas."
              retry={() => next.refetch()}
            />
          )}
        </section>
      </div>
    </div>
  );
}
export function StoreSearchMatches({
  q,
  province,
}: {
  q: string;
  province?: string;
}) {
  const search = useSearch();
  const { snapshot, mounted } = usePublicCatalog();
  const matches = snapshotMatches(
    snapshot,
    `/mercado${search ? `?${search.replace(/^\?/, "")}` : ""}`
  );
  const stores = trpc.catalog.stores.useQuery(
    { q, province, limit: 6 },
    { enabled: mounted, initialData: matches ? snapshot.directory : undefined }
  );
  return (
    <section
      className="directory-search-matches"
      aria-labelledby="matching-stores-title"
    >
      <div className="live-panel-heading">
        <h2 id="matching-stores-title">
          Tiendas que coinciden con tu búsqueda
        </h2>
        <Link
          className="text-link"
          href={storeDirectoryHref("", { q, province })}
        >
          Ver todas las tiendas
        </Link>
      </div>
      {stores.error || (matches && snapshot.failed && !mounted) ? (
        <RequestError
          message="No pudimos consultar las tiendas."
          retry={() => stores.refetch()}
        />
      ) : !stores.data ? (
        <p role="status">Buscando tiendas…</p>
      ) : !stores.data.items.length ? (
        <p className="live-muted">
          No hay tiendas activas que coincidan. Prueba otra categoría o
          especialidad.
        </p>
      ) : (
        <div className="directory-store-grid">
          {stores.data.items.map(store => (
            <DirectoryStoreCard key={store.id} store={store} />
          ))}
        </div>
      )}
    </section>
  );
}
