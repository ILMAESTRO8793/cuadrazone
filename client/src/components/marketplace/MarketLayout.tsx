import { businessCategories } from "@shared/businessCategories";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowRight,
  ChevronDown,
  Heart,
  Info,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
  ShieldCheck,
  Instagram,
  Mail,
} from "lucide-react";
import {
  assets,
  listings,
  listingPath,
  provinces,
  listingSearchText,
  normalizeSearch,
} from "@/data/catalog";
import { useMarket } from "@/contexts/MarketContext";

const nav = [
  { title: "Todas las categorías", href: "/mercado" },
  { title: "Productos", href: "/mercado?kind=product" },
  { title: "Libros cristianos", href: "/mercado?kind=book" },
  { title: "Eventos y conciertos", href: "/eventos" },
  { title: "Tiendas y negocios", href: "/tiendas" },
  { title: "Servicios", href: "/servicios" },
];
export default function MarketLayout({ children }: { children: ReactNode }) {
  const { province, setProvince } = useMarket();
  const auth = useAuth();
  const savedCart = trpc.commerce.cart.useQuery(undefined, {
    enabled: !auth.loading && Boolean(auth.user),
  });
  const savedFavorites = trpc.commerce.favorites.useQuery(undefined, {
    enabled: !auth.loading && Boolean(auth.user),
  });
  const cartCount =
    savedCart.data?.items.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const favorites = savedFavorites.data?.items ?? [];
  const [location, navigate] = useLocation();
  const currentSearch = useSearch();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "stores" | "products">(
    location === "/tiendas" ? "stores" : "all"
  );
  const [showSearch, setShowSearch] = useState(false);
  const [selected, setSelected] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () => setDebounced(query.trim().slice(0, 120)),
      200
    );
    return () => clearTimeout(timer);
  }, [query]);
  const suggestions = trpc.catalog.suggest.useQuery(
    { q: debounced || "a" },
    { enabled: Boolean(debounced) && scope !== "stores" }
  );
  const storeSuggestions = trpc.catalog.storeSuggest.useQuery(
    { q: debounced || "a" },
    { enabled: Boolean(debounced) && scope !== "products" }
  );
  const matches =
    debounced === query.trim()
      ? [
          ...new Set([
            ...(scope !== "products" ? (storeSuggestions.data ?? []) : []),
            ...(scope !== "stores" ? (suggestions.data ?? []) : []),
          ]),
        ].slice(0, 10)
      : [];
  function resultLink(term: string) {
    const params = new URLSearchParams();
    if (term.trim()) params.set("q", term.trim());
    if (province !== "Todo Panamá") params.set("province", province);
    return `${scope === "stores" ? "/tiendas" : "/mercado"}${params.size ? `?${params.toString()}` : ""}`;
  }
  useEffect(() => {
    setMenuOpen(false);
    setShowSearch(false);
  }, [location, currentSearch]);
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node))
        setShowSearch(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);
  function search() {
    setShowSearch(false);
    navigate(resultLink(query));
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Ir al contenido
      </a>
      <div className="utility-strip">
        <div className="container utility-inner">
          <span>Unidos por la fe. Conectados por lo que hacemos.</span>
          <span className="utility-right">
            Panamá <span className="utility-dot" /> USD{" "}
            <span className="utility-dot" />{" "}
            <strong>3 meses gratis para vendedores</strong>
          </span>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-main">
          <div className="header-brand">
            <Link
              href="/"
              className="site-logo"
              aria-label="CuadraZone, inicio"
            >
              <img src={assets.logo} alt="CuadraZone" width={240} height={68} />
            </Link>
            <figure className="brand-scripture">
              <blockquote cite="https://www.biblegateway.com/passage/?search=Salmos%20133%3A1&version=RVR1960">
                ¡Mirad cuán bueno y cuán delicioso es Habitar los hermanos
                juntos en armonía!
              </blockquote>
              <figcaption>
                <a
                  href="https://www.biblegateway.com/passage/?search=Salmos%20133%3A1&version=RVR1960"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Salmo 133:1
                </a>
              </figcaption>
            </figure>
          </div>
          <label className="header-location">
            <MapPin size={19} />
            <span>
              <small>Explorar en</small>
              <select
                value={province}
                onChange={event => {
                  const value = event.target.value;
                  setProvince(value);
                  if (location === "/mercado" || location === "/tiendas") {
                    const params = new URLSearchParams(currentSearch);
                    if (value === "Todo Panamá") params.delete("province");
                    else params.set("province", value);
                    navigate(`${location}${params.size ? `?${params}` : ""}`);
                  }
                }}
                aria-label="Provincia de entrega"
              >
                {provinces.map(value => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </span>
          </label>
          <div className="header-search" ref={searchRef}>
            <form
              onSubmit={event => {
                event.preventDefault();
                if (selected >= 0 && matches[selected])
                  navigate(resultLink(matches[selected]));
                else search();
              }}
              role="search"
            >
              <select
                className="header-search-scope"
                aria-label="Tipo de búsqueda"
                value={scope}
                onChange={event => {
                  setScope(event.target.value as typeof scope);
                  setSelected(-1);
                }}
              >
                <option value="all">Todo</option>
                <option value="stores">Tiendas</option>
                <option value="products">Productos</option>
              </select>
              <Search size={19} aria-hidden="true" />
              <input
                aria-label="Buscar productos, tiendas, categorías o especialidades"
                maxLength={120}
                aria-expanded={showSearch && matches.length > 0}
                aria-controls="search-suggestions"
                role="combobox"
                autoComplete="off"
                placeholder="¿Qué estás buscando?"
                value={query}
                onFocus={() => setShowSearch(true)}
                onChange={event => {
                  setQuery(event.target.value);
                  setShowSearch(true);
                  setSelected(-1);
                }}
                onKeyDown={event => {
                  if (event.key === "Escape") setShowSearch(false);
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelected(value =>
                      Math.min(matches.length - 1, value + 1)
                    );
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelected(value => Math.max(-1, value - 1));
                  }
                }}
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Limpiar búsqueda"
                  onClick={() => {
                    setQuery("");
                    setSelected(-1);
                  }}
                >
                  <X size={15} />
                </button>
              )}
              <button
                type="submit"
                className="search-submit"
                aria-label="Buscar"
              >
                <ArrowRight size={19} />
              </button>
            </form>
            {showSearch && query.trim() && (
              <div
                className="search-results"
                id="search-suggestions"
                role="listbox"
                aria-label="Sugerencias de búsqueda"
              >
                {matches.map((item, index) => (
                  <button
                    role="option"
                    aria-selected={index === selected}
                    className={index === selected ? "selected" : ""}
                    key={item}
                    onClick={() => navigate(resultLink(item))}
                  >
                    <span>
                      {item}
                      <small>
                        {scope === "stores"
                          ? "Tiendas por actividad"
                          : "Buscar en la comunidad"}
                      </small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
                {!matches.length && (
                  <p>
                    No hay sugerencias con este texto. Busca una tienda,
                    producto o categoría.
                  </p>
                )}
                <button className="all-results" onClick={search}>
                  Ver resultados de búsqueda <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="header-actions">
            <Link
              href="/mi-cuenta"
              className="account-link"
              aria-label="Mi cuenta"
            >
              <UserRound size={23} />
              <span>
                <small>Hola, explora</small>
                <strong>Mi cuenta</strong>
              </span>
            </Link>
            <Link
              href="/mi-lista"
              className="header-icon"
              aria-label={`Mis favoritos, ${favorites.length} artículos`}
            >
              <Heart size={23} />
              {favorites.length > 0 && (
                <span className="count-badge">{favorites.length}</span>
              )}
            </Link>
            <Link
              href="/mi-carrito"
              className="header-icon"
              aria-label={`Carrito, ${cartCount} artículos`}
            >
              <ShoppingBag size={23} />
              <span className="count-badge">{cartCount}</span>
            </Link>
          </div>
        </div>
        <div className="nav-border">
          <div className="container main-nav">
            <button
              className="category-menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(value => !value)}
            >
              <Menu size={17} />
              <span>Categorías</span>
              <ChevronDown size={13} />
            </button>
            <nav aria-label="Navegación principal">
              {nav.slice(1).map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    location === item.href.split("?")[0] &&
                    (!item.href.includes("kind=") ||
                      new URLSearchParams(currentSearch).get("kind") ===
                        new URL(
                          item.href,
                          "https://route-parser.invalid"
                        ).searchParams.get("kind"))
                      ? "active"
                      : ""
                  }
                >
                  {item.title}
                </Link>
              ))}
            </nav>
            <Link className="sell-nav" href="/vender">
              Vende en CuadraZone <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        {menuOpen && (
          <div className="category-popover container">
            <div>
              {nav.map(item => (
                <Link key={item.href} href={item.href}>
                  {item.title}
                  <ArrowRight size={14} />
                </Link>
              ))}
              <strong className="category-menu-heading">
                Categorías de negocios
              </strong>
              {businessCategories.map(category => (
                <Link
                  key={category.id}
                  href={`/tiendas?category=${encodeURIComponent(category.id)}`}
                >
                  {category.label}
                  <ArrowRight size={14} />
                </Link>
              ))}
              <Link href="/suscripciones">
                Cuentas y plan vendedor
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </header>
      <div className="prototype-note">
        <div className="container">
          <Info size={14} />
          <span>
            Etapa 3 · Catálogo, carrito y pedidos persistentes. Los ejemplos
            están separados. No se procesan pagos electrónicos.
          </span>
          <Link href="/ayuda">Saber más</Link>
        </div>
      </div>
      <main id="main-content" className="site-main">
        {children}
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <div className="footer-brand">
            <Link href="/" aria-label="Inicio CuadraZone">
              <img src={assets.logo} alt="CuadraZone" width={230} height={65} />
            </Link>
            <p>
              Un espacio para descubrir, comprar y apoyar el talento de nuestra
              comunidad en Panamá.
            </p>
            <div className="footer-social">
              <Link href="/ayuda" aria-label="Información de redes sociales">
                <Instagram size={17} />
              </Link>
              <Link href="/ayuda" aria-label="Ayuda y contacto">
                <Mail size={17} />
              </Link>
              <span>Hecho para conectar.</span>
            </div>
          </div>
          <div>
            <h3>Descubre</h3>
            <Link href="/tiendas">Tiendas por categoría</Link>
            <Link href="/mercado">Productos de tiendas activas</Link>
            <Link href="/catalogo">Catálogo de ejemplo</Link>
            <Link href="/mercado?kind=book">Libros cristianos</Link>
            <Link href="/eventos">Eventos y conciertos</Link>
            <Link href="/servicios">Servicios profesionales</Link>
          </div>
          <div>
            <h3>Forma parte</h3>
            <Link href="/vender">Quiero vender</Link>
            <Link href="/suscripciones">Cuentas y plan vendedor</Link>
            <Link href="/mi-cuenta">Mi cuenta</Link>
            <Link href="/ayuda">Preguntas frecuentes</Link>
          </div>
          <div>
            <h3>Confianza y ayuda</h3>
            <Link href="/legal/terminos">Términos y condiciones</Link>
            <Link href="/legal/privacidad">Privacidad</Link>
            <Link href="/legal/conducta">Código de conducta</Link>
            <Link href="/legal/reclamos">Reclamos y devoluciones</Link>
            <Link href="/legal/fe">Declaración de fe</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 CuadraZone · Panamá · USD</span>
          <span>
            <ShieldCheck size={14} /> Vista previa · etapa 3 de 7
          </span>
        </div>
      </footer>
    </>
  );
}
