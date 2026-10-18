import { useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Ticket,
  UserRound,
} from "lucide-react";
import { Link } from "wouter";
import {
  getSeller,
  kindLabel,
  listingPath,
  listings,
  money,
  type Listing,
} from "@/data/catalog";
import { useMarket } from "@/contexts/MarketContext";
import ProductCard, { Stars } from "@/components/marketplace/ProductCard";
import { toast } from "sonner";

function DemoTabs({ item }: { item: Listing }) {
  const [tab, setTab] = useState("Descripción");
  const content: Record<string, React.ReactNode> = {
    Descripción: (
      <div className="rich-copy">
        <p>{item.description}</p>
        <p>
          Esta ficha es una <strong>publicación de demostración</strong>:
          muestra el recorrido visual del marketplace, sin inventario, pagos o
          entrega real.
        </p>
      </div>
    ),
    Reseñas: (
      <div className="review-list">
        <div>
          <Stars value={item.rating} count={item.reviews} />
          <p>“Diseño de ejemplo para una futura opinión verificada.”</p>
          <small>Opinión ilustrativa · sin compra real</small>
        </div>
        <div>
          <Stars value={4.7} />
          <p>
            “La información se presentaría aquí después de una experiencia
            real.”
          </p>
          <small>Reseña de demostración</small>
        </div>
      </div>
    ),
    Preguntas: (
      <div className="question-list">
        <p>
          <strong>¿La compra ya está habilitada?</strong>
          <br />
          No. El flujo de pagos y preguntas reales se habilita en etapas
          posteriores.
        </p>
        <p>
          <strong>¿Puedo contactar a la tienda?</strong>
          <br />
          El botón solo muestra el diseño de contacto, no envía mensajes
          todavía.
        </p>
      </div>
    ),
  };
  return (
    <section className="detail-tabs">
      <div className="tab-list" role="tablist">
        {Object.keys(content).map(value => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
            role="tab"
            aria-selected={tab === value}
            type="button"
          >
            {value}
          </button>
        ))}
      </div>
      <div className="tab-content">{content[tab]}</div>
    </section>
  );
}

function Quantity({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="quantity-control">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Disminuir cantidad"
      >
        <Minus size={15} />
      </button>
      <span>{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(20, value + 1))}
        aria-label="Aumentar cantidad"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function EventOptions({
  item,
  quantity,
  setQuantity,
}: {
  item: Listing;
  quantity: number;
  setQuantity: (value: number) => void;
}) {
  const [ticket, setTicket] = useState("General");
  const ticketPrice = ticket === "VIP" ? 30 : 15;
  return (
    <div className="detail-option-card">
      <div className="option-title">
        <Ticket size={18} />
        <strong>Elige tus boletos</strong>
      </div>
      <div className="option-grid">
        {["General", "VIP"].map(value => (
          <button
            type="button"
            key={value}
            className={`option-button ${ticket === value ? "selected" : ""}`}
            onClick={() => setTicket(value)}
          >
            <span>{value}</span>
            <strong>{money(value === "VIP" ? 30 : 15)}</strong>
          </button>
        ))}
      </div>
      <div className="event-meta">
        <span>
          <CalendarDays size={16} /> 15 nov 2026 · ficticio
        </span>
        <span>
          <MapPin size={16} /> Auditorio de demostración, Panamá
        </span>
      </div>
      <div className="qty-line">
        <span>Cantidad</span>
        <Quantity value={quantity} onChange={setQuantity} />
      </div>
      <button
        className="btn btn-gold btn-wide"
        type="button"
        onClick={() =>
          toast.info("Boletos de demostración seleccionados", {
            description: `Total ilustrativo: ${money(ticketPrice * quantity)}. No se emite un QR real.`,
          })
        }
      >
        Continuar con selección
      </button>
      <p className="small-note">
        La entrada con QR real será parte de la Etapa 4. Esta selección no
        reserva cupos.
      </p>
    </div>
  );
}

function ServiceOptions({ item }: { item: Listing }) {
  const [date, setDate] = useState("2026-11-21");
  const [time, setTime] = useState("09:00");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="detail-option-card">
      <div className="option-title">
        <CalendarDays size={18} />
        <strong>Agenda ilustrativa</strong>
      </div>
      <div className="field-grid">
        <label>
          Fecha
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </label>
        <label>
          Hora
          <select value={time} onChange={e => setTime(e.target.value)}>
            <option>09:00</option>
            <option>11:00</option>
            <option>14:00</option>
            <option>16:00</option>
          </select>
        </label>
      </div>
      <label className="field-full">
        Cuéntanos brevemente qué necesitas
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Descripción de ejemplo (no se envía)"
          rows={3}
        />
      </label>
      <button
        className="btn btn-gold btn-wide"
        type="button"
        onClick={() => setOpen(true)}
      >
        Solicitar cotización de demostración
      </button>
      <p className="small-note">
        No se confirma una cita ni se envía información al proveedor en Etapa 1.
      </p>
      {open && (
        <div className="inline-modal">
          <div>
            <button
              className="modal-close"
              onClick={() => setOpen(false)}
              type="button"
            >
              Cerrar
            </button>
            <p className="eyebrow">Siguiente paso</p>
            <h3>Así funcionará la solicitud</h3>
            <p>
              En una etapa futura el proveedor recibiría tu fecha, hora y
              descripción para responder con una cotización. Por ahora solo
              estamos mostrando la experiencia.
            </p>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => {
                setOpen(false);
                toast.success("Selección de demostración revisada", {
                  description: "No se creó una cita real.",
                });
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DetailPage({ slug }: { slug: string }) {
  const { favorites, toggleFavorite, addToCart } = useMarket();
  const item = listings.find(listing => listing.slug === slug);
  const related = item
    ? listings
        .filter(
          other =>
            other.id !== item.id &&
            (other.category === item.category || other.kind === item.kind)
        )
        .slice(0, 3)
    : [];
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState("Estándar");
  if (!item)
    return (
      <div className="market-page">
        <div className="container">
          <div className="not-found-card">
            <p className="eyebrow">Catálogo</p>
            <h1>Esta publicación no existe</h1>
            <p>
              El enlace puede ser de ejemplo o ya no está disponible en el
              catálogo actual.
            </p>
            <Link className="btn btn-gold" href="/catalogo">
              Volver al catálogo
            </Link>
          </div>
        </div>
      </div>
    );
  const seller = getSeller(item.sellerId);
  const saved = favorites.includes(item.id);
  const isTicket = item.kind === "evento";
  const isService = item.kind === "servicio";
  const canCart = !isTicket && !isService;
  return (
    <div className="market-page detail-page">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <Link href="/catalogo">Catálogo</Link>
          <span>/</span>
          <strong>{kindLabel[item.kind]}</strong>
        </div>
        <div className="detail-layout">
          <section className="detail-gallery">
            <div className={`detail-image ${item.kind}`}>
              <img src={item.image} alt={item.title} />
            </div>
            <span className="demo-caption">
              Imagen única de demostración · sin galería adicional
            </span>
          </section>
          <section className="detail-info">
            <div className="detail-topline">
              <span className="pill">{kindLabel[item.kind]}</span>
              <button
                className={`icon-action ${saved ? "saved" : ""}`}
                onClick={() => toggleFavorite(item.id)}
                type="button"
                aria-pressed={saved}
              >
                <Heart size={18} fill={saved ? "currentColor" : "none"} />{" "}
                {saved ? "Guardado" : "Guardar"}
              </button>
            </div>
            <h1>{item.title}</h1>
            <div className="detail-rating">
              <Stars value={item.rating} count={item.reviews} />
              <span>Calificación de ejemplo</span>
            </div>
            <div className="detail-price">
              <strong>
                {isTicket || isService ? "Desde " : ""}
                {money(item.price)}
              </strong>
              {item.oldPrice && <del>{money(item.oldPrice)}</del>}
            </div>
            <p className="detail-description">{item.description}</p>
            {item.kind === "producto" && (
              <div className="variant-row">
                <label>Acabado</label>
                <select
                  value={variant}
                  onChange={e => setVariant(e.target.value)}
                >
                  <option>Estándar</option>
                  <option>Edición crema</option>
                  <option>Selección de ejemplo</option>
                </select>
              </div>
            )}
            {item.kind === "libro" && (
              <div className="variant-row">
                <label>Formato</label>
                <select
                  value={variant}
                  onChange={e => setVariant(e.target.value)}
                >
                  <option>Tapa dura</option>
                  <option>Edición de demostración</option>
                </select>
              </div>
            )}
            {canCart && (
              <div className="purchase-box">
                <div className="qty-line">
                  <span>Cantidad</span>
                  <Quantity value={quantity} onChange={setQuantity} />
                </div>
                <button
                  className="btn btn-gold btn-wide"
                  onClick={() => addToCart(item.id, quantity)}
                  type="button"
                >
                  <ShoppingBag size={17} /> Añadir al carrito de demostración
                </button>
                <p className="small-note">
                  <ShieldCheck size={14} /> Sin cobro, pedido ni inventario
                  real.
                </p>
              </div>
            )}
            {isTicket && (
              <EventOptions
                item={item}
                quantity={quantity}
                setQuantity={setQuantity}
              />
            )}
            {isService && <ServiceOptions item={item} />}
            <div className="shipping-preview">
              <div>
                <Clock3 size={18} />
                <span>
                  <strong>Entrega / disponibilidad</strong>
                  <small>
                    {isService
                      ? "Calendario ilustrativo en Panamá"
                      : isTicket
                        ? "Acceso futuro · fecha ficticia"
                        : "Envío o retiro · por definir"}
                  </small>
                </span>
              </div>
              <Check size={17} />
            </div>
            <div className="seller-mini">
              <div
                className="seller-avatar"
                style={{ background: seller.color }}
              >
                {seller.initials}
              </div>
              <div>
                <span className="muted">Vendido por</span>
                <strong>{seller.name}</strong>
                <small>{seller.city} · tienda de ejemplo</small>
              </div>
              <Link
                className="btn btn-outline btn-small"
                href={`/tienda/${seller.id}`}
              >
                Ver tienda
              </Link>
            </div>
          </section>
        </div>
        <section className="detail-specs">
          <div>
            <p className="eyebrow">Ficha</p>
            <h2>Detalles de la publicación</h2>
            {item.details.map(([label, value]) => (
              <div className="spec-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="detail-trust">
            <UserRound size={22} />
            <h3>Una compra con propósito</h3>
            <p>
              Las tiendas se diseñan para conectar comunidades de fe en Panamá.
              Esta ficha es demostrativa y aún no implica verificación, pago o
              entrega.
            </p>
            <Link href="/ayuda" className="text-link">
              Conoce cómo funcionará <span>→</span>
            </Link>
          </div>
        </section>
        <DemoTabs item={item} />
        {related.length > 0 && (
          <section className="related-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">También puedes explorar</p>
                <h2>Otras publicaciones de ejemplo</h2>
              </div>
              <Link className="text-link" href="/catalogo">
                Ver catálogo <span>→</span>
              </Link>
            </div>
            <div className="product-grid">
              {related.map(other => (
                <ProductCard item={other} key={other.id} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
