import { BusinessCategoryBrowse } from "@/features/commerce/StoreDirectoryPage";
import { LiveFeatured } from "@/features/commerce/LiveFeatured";
import { sellerPlanLabel } from "@shared/pricing";
import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  HeartHandshake,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Wrench,
} from "lucide-react";
import { assets, listings, type ListingKind } from "@/data/catalog";
import ProductCard from "@/components/marketplace/ProductCard";

const categoryLinks = [
  {
    title: "Productos para tu día",
    subtitle: "Hogar, moda y tecnología",
    href: "/mercado?kind=product",
    Icon: Package,
    color: "red",
  },
  {
    title: "Libros que inspiran",
    subtitle: "Lecturas para crecer",
    href: "/mercado?kind=book",
    Icon: BookOpen,
    color: "gold",
  },
  {
    title: "Momentos en comunidad",
    subtitle: "Eventos y conciertos",
    href: "/eventos",
    Icon: CalendarDays,
    color: "purple",
  },
  {
    title: "Personas que resuelven",
    subtitle: "Servicios y profesionales",
    href: "/tiendas",
    Icon: Wrench,
    color: "blue",
  },
];
export default function Home() {
  const [kind, setKind] = useState<ListingKind | "todo">("todo");
  const [collection, setCollection] = useState("destacados");
  const ordered =
    collection === "novedades"
      ? [...listings].reverse()
      : collection === "vendidos"
        ? [listings[0], listings[2], listings[1], listings[3], listings[4]]
        : listings;
  const featured =
    kind === "todo"
      ? ordered.slice(0, 4)
      : ordered.filter(item => item.kind === kind);
  return (
    <>
      <div className="hero-band">
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-gold-dot" /> EL MARKETPLACE DE NUESTRA
              COMUNIDAD
            </div>
            <h1>
              Lo que buscas,
              <br />
              más cerca de
              <br /> <span>tu comunidad.</span>
            </h1>
            <p>
              Descubre productos, libros, eventos y servicios de emprendedores
              evangélicos en Panamá. Un espacio para apoyarnos como hermanos en
              Cristo y hacer crecer juntos nuestros emprendimientos.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-gold" href="/mercado">
                Explorar el marketplace <ArrowRight size={17} />
              </Link>
              <Link className="text-link" href="/vender">
                Quiero vender <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="hero-small">
              <span>
                <ShieldCheck size={16} /> Verificación de vendedores
              </span>
              <span>
                <Check size={15} /> 3 meses gratis para vendedores
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <img
              src={assets.hero}
              alt="Mercado al aire libre lleno de puestos y compradores"
              fetchPriority="high"
            />
            <div className="hero-label">
              <span className="hero-label-icon">
                <HeartHandshake size={23} />
              </span>
              <div>
                <strong>Talento que nos une</strong>
                <small>Descubre. Conecta. Apoya.</small>
              </div>
            </div>
            <div className="hero-edition">
              PANAMÁ <span>01 / COMUNIDAD</span>
            </div>
          </div>
        </section>
      </div>
      <div className="category-band">
        <section
          className="category-section container"
          aria-label="Explora por tipo"
        >
          <div className="category-links">
            {categoryLinks.map(({ title, subtitle, href, Icon, color }) => (
              <Link href={href} key={href} className="category-tile">
                <span className={`category-icon ${color}`}>
                  <Icon size={24} strokeWidth={1.5} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{subtitle}</small>
                </div>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="business-browse-band">
        <div className="container">
          <BusinessCategoryBrowse compact />
        </div>
      </div>
      <div className="featured-band">
        <LiveFeatured />
        <section className="featured-section container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">UNA SELECCIÓN PARA TI</span>
              <h2 className="section-title">
                {collection === "novedades"
                  ? "Novedades para explorar"
                  : collection === "vendidos"
                    ? "Más vendidos · ejemplo"
                    : "Descubrimientos con propósito"}
              </h2>
            </div>
            <div className="feature-tools">
              <select
                aria-label="Colección de demostración"
                value={collection}
                onChange={event => setCollection(event.target.value)}
              >
                <option value="destacados">Destacados</option>
                <option value="novedades">Novedades · ejemplo</option>
                <option value="vendidos">Más vendidos · ejemplo</option>
              </select>
              <Link className="text-link" href="/catalogo">
                Ver todo <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div
            className="filter-tabs"
            role="tablist"
            aria-label="Tipo de publicaciones destacadas"
          >
            {(
              [
                ["todo", "Todo"],
                ["producto", "Productos"],
                ["libro", "Libros"],
                ["evento", "Eventos"],
                ["servicio", "Servicios"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={kind === value}
                onClick={() => setKind(value)}
                className={kind === value ? "selected" : ""}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="product-grid">
            {featured.map(item => (
              <ProductCard item={item} key={item.id} />
            ))}
          </div>
          <p className="demo-caption">
            Selección ilustrativa para revisar el diseño. Precios, tiendas y
            opiniones de ejemplo.
          </p>
        </section>
      </div>
      <section className="community-values">
        <div className="container values-inner">
          <div>
            <ShieldCheck size={28} strokeWidth={1.4} />
            <span>
              <strong>Confianza desde el inicio</strong>
              <small>Un proceso de verificación para quienes venden.</small>
            </span>
          </div>
          <div>
            <Store size={28} strokeWidth={1.4} />
            <span>
              <strong>Más para tu emprendimiento</strong>
              <small>Empieza con 3 meses sin mensualidad.</small>
            </span>
          </div>
          <div>
            <Truck size={28} strokeWidth={1.4} />
            <span>
              <strong>Conectados en Panamá</strong>
              <small>Envío, retiro o servicio a domicilio.</small>
            </span>
          </div>
        </div>
      </section>
      <section className="service-discovery container">
        <div className="service-photo">
          <img
            src={assets.service}
            alt="Herramientas de trabajo para servicios del hogar"
            loading="lazy"
          />
          <span>OFICIOS CON PROPÓSITO</span>
        </div>
        <div className="service-copy">
          <span className="eyebrow">TALENTO CERCA DE TI</span>
          <h2>
            Hay alguien en nuestra
            <br />
            comunidad que puede ayudar.
          </h2>
          <p>
            Encuentra profesionales y oficios para lo que necesitas. Consulta,
            solicita una cotización o elige una cita a tu medida.
          </p>
          <div className="service-topics">
            <span>Hogar y mantenimiento</span>
            <span>Educación</span>
            <span>Tecnología</span>
            <span>Bienestar</span>
          </div>
          <Link href="/tiendas" className="btn btn-outline">
            Encontrar un servicio <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
      <section className="seller-invite container">
        <div className="seller-invite-icon">
          <Store size={38} strokeWidth={1.3} />
          <Sparkles size={18} />
        </div>
        <div>
          <span className="eyebrow">TU TRABAJO MERECE SER VISTO</span>
          <h2>Abre nuevas puertas para tu negocio.</h2>
          <p>
            Tu tienda por{" "}
            <strong>Normal {sellerPlanLabel("normal")}/mes</strong> o <strong>Mayor Visibilidad {sellerPlanLabel("mayor_visibilidad")}/mes</strong>. Los
            primeros 3 meses son gratis con 8% de comisión por venta; después, 5%.
          </p>
        </div>
        <Link className="btn btn-gold" href="/vender">
          Quiero ser vendedor <ArrowRight size={17} />
        </Link>
      </section>
      <section className="buyer-invite container">
        <div>
          <span className="eyebrow">SIN CUOTA DE COMPRADOR</span>
          <h2>
            Cuando encuentres lo tuyo,
            <br />
            da el siguiente paso.
          </h2>
          <p>
            Tu cuenta de comprador será gratuita. Compra productos, reserva
            servicios y adquiere boletos sin pagar una cuota mensual.
          </p>
          <Link className="text-link" href="/suscripciones">
            Conoce cómo funciona <ArrowRight size={15} />
          </Link>
        </div>
        <div className="membership-card">
          <span>COMPRADOR CUADRAZONE</span>
          <div>
            <strong>Gratis</strong>
            <small>sin mensualidad</small>
          </div>
          <p>
            Una cuenta gratuita.
            <br />
            Muchas formas de conectar.
          </p>
          <div>
            <Check size={16} /> Productos, servicios y eventos
          </div>
          <span className="membership-small">
            Cobros no activos en esta vista previa
          </span>
        </div>
      </section>
    </>
  );
}
