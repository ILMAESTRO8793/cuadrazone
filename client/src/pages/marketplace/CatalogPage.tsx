import { useEffect, useMemo, useState } from "react";
import { Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import ProductCard from "@/components/marketplace/ProductCard";
import {
  categories,
  kindLabel,
  provinces,
  type ListingKind,
} from "@/data/catalog";
import { useMarket } from "@/contexts/MarketContext";
import {
  filterCatalog,
  parseCatalogFilters,
  serializeCatalogFilters,
  type CatalogFilters,
} from "@/lib/catalogQuery";
// Cada mundo muestra solo lo suyo: el Marketplace no muestra servicios y Servicios no muestra productos.
const MARKET_KINDS: ListingKind[] = ["producto", "libro"];
const SERVICE_KINDS: ListingKind[] = ["servicio", "evento"];
export default function CatalogPage({
  initialKind,
}: {
  initialKind?: ListingKind;
}) {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const { province: preferredProvince } = useMarket();
  const filters = useMemo(
    () => parseCatalogFilters(search, initialKind),
    [search, initialKind]
  );
  const [draftQ, setDraftQ] = useState(filters.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    setDraftQ(filters.q);
  }, [filters.q, location]);
  const isServices = initialKind === "servicio" || initialKind === "evento";
  const kinds = isServices ? SERVICE_KINDS : MARKET_KINDS;
  const results = useMemo(
    () => filterCatalog(filters).filter(item => kinds.includes(item.kind)),
    [filters, kinds]
  );
  function updateFilters(patch: Partial<CatalogFilters>) {
    navigate(
      `${location}?${serializeCatalogFilters({ ...filters, q: draftQ, ...patch })}`
    );
  }
  function reset() {
    navigate(isServices ? "/servicios" : "/catalogo");
    setDraftQ("");
  }
  return (
    <div className="market-page catalog-page">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <strong>{isServices ? "Servicios" : "Comercios"}</strong>
        </div>
        <div className="page-intro catalog-intro">
          <div>
            <p className="eyebrow">Compra con propósito</p>
            <h1>
              {initialKind === "libro"
                ? "Lecturas que inspiran"
                : initialKind === "evento"
                  ? "Momentos en comunidad"
                  : initialKind === "servicio"
                    ? "Talento cerca de ti"
                    : "Explora los comercios"}
            </h1>
            <p className="intro-copy">
              {isServices
                ? "Clases, tutorías, trabajos a domicilio, consultas y eventos de ejemplo en Panamá."
                : "Productos y libros de tiendas de ejemplo en Panamá."}
            </p>
          </div>
          <span className="demo-badge">Catálogo de demostración</span>
        </div>
        <form
          className="catalog-search"
          onSubmit={event => {
            event.preventDefault();
            updateFilters({ q: draftQ });
          }}
        >
          <Search size={18} />
          <input
            value={draftQ}
            onChange={event => setDraftQ(event.target.value)}
            placeholder="¿Qué estás buscando?"
            aria-label="Buscar en catálogo"
          />
          <button className="btn btn-gold" type="submit">
            Buscar
          </button>
        </form>
        <div className="catalog-layout">
          <aside
            className={`filter-panel ${filtersOpen ? "is-open" : ""}`}
            aria-label="Filtros del catálogo"
            id="catalog-filters"
          >
            <div className="filter-heading">
              <span>
                <Filter size={16} />
                Filtrar
              </span>
              <button className="text-button" onClick={reset} type="button">
                Limpiar
              </button>
            </div>
            <label>
              Tipo
              <select
                value={filters.kind}
                onChange={event =>
                  updateFilters({
                    kind: event.target.value as CatalogFilters["kind"],
                  })
                }
              >
                <option value="todos">Todos</option>
                {kinds.map(value => (
                  <option key={value} value={value}>
                    {kindLabel[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoría
              <select
                value={filters.category}
                onChange={event =>
                  updateFilters({ category: event.target.value })
                }
              >
                <option value="todas">Todas</option>
                {categories.map(value => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Precio máximo
              <select
                value={filters.maxPrice}
                onChange={event =>
                  updateFilters({ maxPrice: Number(event.target.value) })
                }
              >
                <option value={100}>USD 100</option>
                <option value={50}>USD 50</option>
                <option value={30}>USD 30</option>
                <option value={20}>USD 20</option>
              </select>
            </label>
            <label>
              Provincia
              <select
                value={filters.province}
                onChange={event =>
                  updateFilters({ province: event.target.value })
                }
              >
                <option value="todas">Todas</option>
                {provinces.map(value => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Calificación mínima
              <select
                value={filters.minRating}
                onChange={event =>
                  updateFilters({ minRating: Number(event.target.value) })
                }
              >
                <option value={0}>Cualquiera</option>
                <option value={4}>4 estrellas o más</option>
                <option value={4.5}>4.5 estrellas o más</option>
              </select>
            </label>
            <p className="filter-note">
              Preferencia del encabezado: <strong>{preferredProvince}</strong>.
              Este filtro no modifica tu preferencia.
            </p>
          </aside>
          <section className="catalog-results" aria-live="polite">
            <div className="results-toolbar">
              <button
                className="filter-toggle"
                onClick={() => setFiltersOpen(value => !value)}
                type="button"
                aria-expanded={filtersOpen}
                aria-controls="catalog-filters"
              >
                <SlidersHorizontal size={16} />
                {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
              </button>
              <p>
                <strong>{results.length}</strong> resultados de demostración
              </p>
              <label className="sort-control">
                Ordenar
                <select
                  value={filters.sort}
                  onChange={event =>
                    updateFilters({
                      sort: event.target.value as CatalogFilters["sort"],
                    })
                  }
                >
                  <option value="relevancia">Relevancia</option>
                  <option value="precio-menor">Precio: menor primero</option>
                  <option value="precio-mayor">Precio: mayor primero</option>
                </select>
              </label>
            </div>
            {results.length ? (
              <div className="product-grid">
                {results.map(item => (
                  <ProductCard item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <Search />
                </div>
                <h2>No encontramos coincidencias</h2>
                <p>Prueba otra búsqueda o relaja alguno de los filtros.</p>
                <button
                  className="btn btn-outline"
                  onClick={reset}
                  type="button"
                >
                  <RotateCcw size={16} />
                  Restablecer filtros
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
