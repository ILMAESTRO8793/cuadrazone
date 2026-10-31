import { sellerPlanLabel } from "@shared/pricing";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Heart,
  HelpCircle,
  Info,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Scale,
  Send,
  Shield,
  ShoppingBag,
  Store,
  Ticket,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  getSeller,
  kindLabel,
  listingPath,
  listings,
  money,
  provinces,
  sellers,
  type Listing,
} from "@/data/catalog";
import { useMarket } from "@/contexts/MarketContext";
import ProductCard from "@/components/marketplace/ProductCard";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function Crumbs({
  current,
  parent = "Inicio",
}: {
  current: string;
  parent?: string;
}) {
  return (
    <div className="breadcrumb">
      <Link href="/">{parent}</Link>
      <span>/</span>
      <strong>{current}</strong>
    </div>
  );
}
function Intro({
  eyebrow,
  title,
  copy,
  badge,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  badge?: string;
}) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="intro-copy">{copy}</p>
      </div>
      {badge && <span className="demo-badge">{badge}</span>}
    </div>
  );
}
function DemoModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="cz-demo-dialog">
        <p className="eyebrow">Vista de demostración</p>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="cz-dialog-copy">{children}</div>
        </DialogDescription>
        <button className="btn btn-gold" onClick={onClose} type="button">
          Entendido
        </button>
      </DialogContent>
    </Dialog>
  );
}

function Qty({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="quantity-control">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Disminuir"
      >
        <Minus size={14} />
      </button>
      <span>{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(20, value + 1))}
        aria-label="Aumentar"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export function StorePage({ slug }: { slug: string }) {
  const seller = sellers.find(value => value.id === slug);
  if (!seller)
    return (
      <div className="market-page">
        <div className="container">
          <div className="not-found-card">
            <h1>Tienda no encontrada</h1>
            <p>Este perfil de demostración no está disponible.</p>
            <Link className="btn btn-gold" href="/catalogo">
              Explorar catálogo
            </Link>
          </div>
        </div>
      </div>
    );
  const items = listings.filter(item => item.sellerId === seller.id);
  return (
    <div className="market-page store-page">
      <div className="container">
        <Crumbs current={seller.name} parent="Tiendas" />
        <section className="store-banner" style={{ background: seller.color }}>
          <div className="store-avatar">{seller.initials}</div>
          <div>
            <span className="demo-badge">Perfil de demostración</span>
            <h1>{seller.name}</h1>
            <p>{seller.tagline}</p>
            <div className="store-meta">
              <span>
                <MapPin size={15} /> {seller.city}, {seller.province}
              </span>
              <span>
                <Store size={15} /> {seller.church}
              </span>
            </div>
          </div>
        </section>
        <div className="store-grid">
          <section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Publicaciones</p>
                <h2>Catálogo de la tienda</h2>
              </div>
              <span className="muted">
                {items.length} ejemplo{items.length === 1 ? "" : "s"}
              </span>
            </div>
            {items.length ? (
              <div className="product-grid">
                {items.map(item => (
                  <ProductCard item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <Store />
                <h3>Próximamente</h3>
                <p>Esta tienda todavía no tiene publicaciones de ejemplo.</p>
              </div>
            )}
          </section>
          <aside className="store-about">
            <BadgeCheck size={22} />
            <h2>Sobre la tienda</h2>
            <p>{seller.about}</p>
            <div className="example-seal">
              <strong>Insignia de ejemplo</strong>
              <span>
                La insignia real solo se mostrará después de un proceso de
                revisión. No es una verificación real.
              </span>
            </div>
            <button
              className="btn btn-outline btn-wide"
              type="button"
              onClick={() =>
                toast.info("Contacto en diseño", {
                  description:
                    "Los mensajes entre compradores y tiendas llegarán en una etapa posterior.",
                })
              }
            >
              <MessageCircle size={16} /> Ver contacto futuro
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

export { SubscriptionsPage } from "./SubscriptionPlans";

export function SellPage() {
  const requirements = ["Aceptar los valores cristianos de CuadraZone (no se negocian)", "Elegir tu país (por ahora, Panamá)", "Cédula o carné vigente", "Una cuenta de Yappy o de banco a tu nombre", "Correo y celular verificados con un código", "Datos de tu negocio y su categoría", "Verificación inmediata: si todo coincide, tu tienda se abre al instante"];
  return <div className="market-page"><div className="container"><Crumbs current="Vende en CuadraZone" /><Intro eyebrow="Para vendedores" title="Convierte tu propósito en una tienda" copy="Guarda tu solicitud y adjunta tus evidencias de forma privada. Verificas tu correo y tu celular con un código, y nuestro equipo revisa cada solicitud." badge="3 meses gratis al ser aprobado" /><section className="sell-content"><div><p className="eyebrow">Tu recorrido</p><h2>Una comunidad con confianza</h2><ul className="check-list">{requirements.map(item => <li key={item}><Check size={17} />{item}</li>)}</ul></div><aside className="sell-callout"><FileText size={24} /><h3>Documentos privados</h3><p>Solo tú y los administradores autenticados pueden consultarlos. Durante esta vista previa utiliza archivos de prueba sin datos sensibles; los textos legales siguen en revisión.</p><Link href="/solicitud-vendedor" className="btn btn-gold btn-wide">Comenzar mi solicitud <ArrowRight size={16} /></Link><p>Normal {sellerPlanLabel("normal")}/mes o Mayor Visibilidad {sellerPlanLabel("mayor_visibilidad")}/mes después de 3 meses gratis · Productos físicos: comisión de 8% por venta en la prueba y 5% después, sin contar el envío. Servicios: sin comisión.</p><Link href="/suscripciones" className="text-link">Comparar los dos planes</Link></aside></section></div></div>;
}

export function CartPage() {
  const { cart, setQuantity, removeFromCart } = useMarket();
  const groups = useMemo(() => {
    const map = new Map<string, Listing[]>();
    cart.forEach(entry => {
      const item = listings.find(value => value.id === entry.id);
      if (item)
        map.set(item.sellerId, [...(map.get(item.sellerId) ?? []), item]);
    });
    return [...map.entries()];
  }, [cart]);
  const subtotal = cart.reduce((sum, entry) => {
    const item = listings.find(value => value.id === entry.id);
    return sum + (item?.price ?? 0) * entry.quantity;
  }, 0);
  return (
    <div className="market-page">
      <div className="container">
        <Crumbs current="Carrito" />
        <Intro
          eyebrow="Tu selección"
          title="Carrito de demostración"
          copy="Ajusta cantidades y revisa tu selección. No hay compras ni pedidos reales en esta etapa."
          badge="Local · sin cobro"
        />
        {!cart.length ? (
          <div className="empty-state cart-empty">
            <ShoppingBag size={30} />
            <h2>Tu carrito está listo para descubrir</h2>
            <p>Añade productos o libros del catálogo para verlos aquí.</p>
            <Link href="/catalogo" className="btn btn-gold">
              Explorar catálogo
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <section>
              {groups.map(([sellerId, items]) => {
                const seller = getSeller(sellerId);
                return (
                  <div className="cart-seller" key={sellerId}>
                    <div className="cart-seller-head">
                      <div
                        className="seller-avatar"
                        style={{ background: seller.color }}
                      >
                        {seller.initials}
                      </div>
                      <div>
                        <strong>{seller.name}</strong>
                        <span>tienda de ejemplo · {seller.province}</span>
                      </div>
                    </div>
                    {items.map(item => {
                      const entry = cart.find(value => value.id === item.id)!;
                      return (
                        <article className="cart-row" key={item.id}>
                          <img src={item.image} alt="" />
                          <div className="cart-row-main">
                            <Link href={listingPath(item)}>{item.title}</Link>
                            <span>{kindLabel[item.kind]}</span>
                            <strong>{money(item.price)}</strong>
                          </div>
                          <Qty
                            value={entry.quantity}
                            onChange={value => setQuantity(item.id, value)}
                          />
                          <button
                            className="icon-action remove"
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            aria-label={`Quitar ${item.title}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </section>
            <aside className="summary-card">
              <h2>Resumen</h2>
              <div>
                <span>Subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <div>
                <span>Envío</span>
                <span>Por definir</span>
              </div>
              <hr />
              <div className="summary-total">
                <span>Total ilustrativo</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <Link className="btn btn-gold btn-wide" href="/checkout">
                Revisar checkout
              </Link>
              <p className="small-note">
                El botón solo navega a la vista previa; no se genera pedido.
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export function WishlistPage() {
  const { favorites } = useMarket();
  const items = listings.filter(item => favorites.includes(item.id));
  return (
    <div className="market-page">
      <div className="container">
        <Crumbs current="Favoritos" />
        <Intro
          eyebrow="Guardados"
          title="Tus favoritos"
          copy="Publicaciones que quieres volver a encontrar. Se guardan localmente en este navegador de demostración."
        />
        {items.length ? (
          <div className="product-grid">
            {items.map(item => (
              <ProductCard item={item} key={item.id} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Heart size={30} />
            <h2>Tu lista está esperando</h2>
            <p>Presiona el corazón de cualquier publicación para guardarla.</p>
            <Link href="/catalogo" className="btn btn-outline">
              Ver catálogo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function CheckoutPage() {
  const { cart } = useMarket();
  const subtotal = cart.reduce(
    (sum, entry) =>
      sum +
      (listings.find(item => item.id === entry.id)?.price ?? 0) *
        entry.quantity,
    0
  );
  return (
    <div className="market-page">
      <div className="container">
        <Crumbs current="Checkout" parent="Carrito" />
        <Intro
          eyebrow="Última revisión"
          title="Checkout de demostración"
          copy="Aquí podrás confirmar el resumen cuando pagos y pedidos estén habilitados."
          badge="Etapa 1 · no disponible"
        />
        <div className="checkout-layout">
          <section className="checkout-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Resumen claro</p>
                <h2>
                  {cart.length
                    ? `${cart.length} publicación${cart.length > 1 ? "es" : ""}`
                    : "Sin publicaciones"}
                </h2>
              </div>
              <Link href="/carrito" className="text-link">
                Editar carrito
              </Link>
            </div>
            {cart.length ? (
              cart.map(entry => {
                const item = listings.find(value => value.id === entry.id)!;
                return (
                  <div className="checkout-line" key={item.id}>
                    <img src={item.image} alt="" />
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {entry.quantity} × {money(item.price)}
                      </span>
                    </div>
                    <strong>{money(entry.quantity * item.price)}</strong>
                  </div>
                );
              })
            ) : (
              <p className="muted">
                Vuelve al catálogo para seleccionar una publicación.
              </p>
            )}
            <div className="notice-panel compact">
              <LockKeyhole size={18} />
              <span>
                No pedimos número de tarjeta, contraseña ni datos sensibles en
                esta etapa.
              </span>
            </div>
          </section>
          <aside className="summary-card">
            <h2>Total</h2>
            <div>
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div>
              <span>Envío</span>
              <span>Por definir</span>
            </div>
            <hr />
            <div className="summary-total">
              <span>Total ilustrativo</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <button disabled className="btn btn-gold btn-wide" type="button">
              Pago habilitado en Etapa 5
            </button>
            <p className="small-note">
              No se creó un pedido. Los medios de pago llegarán en otra etapa.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function AccountPage() {
  return (
    <div className="market-page">
      <div className="container">
        <Crumbs current="Mi cuenta" />
        <div className="account-hero">
          <div className="account-mark">
            <UserRound size={25} />
          </div>
          <p className="eyebrow">Acceso pendiente</p>
          <h1>Tu cuenta se habilitará en la Etapa 2</h1>
          <p>
            Esta vista presenta la estructura de comprador sin simular una
            identidad, sesión o usuario real.
          </p>
          <button className="btn btn-gold" disabled type="button">
            Acceso disponible en Etapa 2
          </button>
        </div>
        <div className="account-links">
          <Link href="/deseos">
            <Heart size={18} />
            <span>
              <strong>Favoritos</strong>
              <small>Publicaciones guardadas localmente</small>
            </span>
            <ArrowRight size={16} />
          </Link>
          <Link href="/carrito">
            <ShoppingBag size={18} />
            <span>
              <strong>Carrito</strong>
              <small>Selección de demostración</small>
            </span>
            <ArrowRight size={16} />
          </Link>
          <Link href="/suscripciones">
            <Store size={18} />
            <span>
              <strong>Suscripciones</strong>
              <small>Planes sin cobro</small>
            </span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

const sellerMenu = [
  "Publicaciones",
  "Pedidos",
  "Eventos",
  "Citas",
  "Mensajes",
  "Suscripción",
  "Reportes",
];
const adminMenu = [
  "Solicitudes",
  "Moderación",
  "Denominaciones",
  "Reclamos",
  "Reportes",
];
export function DashboardPage({ role }: { role: "vendedor" | "admin" }) {
  const [active, setActive] = useState(
    role === "vendedor" ? sellerMenu[0] : adminMenu[0]
  );
  const isSeller = role === "vendedor";
  const menu = isSeller ? sellerMenu : adminMenu;
  return (
    <div className="market-page dashboard-page">
      <div className="container">
        <Crumbs
          current={isSeller ? "Panel de vendedor" : "Panel de administración"}
        />
        <div className="dashboard-shell">
          <aside className="dashboard-nav">
            <div className="dashboard-brand">
              <LayoutDashboard size={19} />
              <strong>{isSeller ? "Mi tienda" : "CuadraZone Admin"}</strong>
            </div>
            <span className="dashboard-role">Vista previa · {role}</span>
            <nav>
              {menu.map(item => (
                <button
                  className={active === item ? "active" : ""}
                  key={item}
                  type="button"
                  onClick={() => setActive(item)}
                >
                  <span>{item}</span>
                  <ChevronDown size={14} />
                </button>
              ))}
            </nav>
            <Link href="/ayuda" className="dashboard-help">
              <HelpCircle size={16} /> Centro de ayuda
            </Link>
          </aside>
          <section className="dashboard-content">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">
                  Panel {isSeller ? "de tienda" : "interno"}
                </p>
                <h1>{active}</h1>
              </div>
              <span className="demo-badge">Sin operaciones reales</span>
            </div>
            <div className="dashboard-preview">
              <div className="preview-icon">
                {isSeller ? <Store /> : <Shield />}
              </div>
              <h2>{active} llegará en una próxima etapa</h2>
              <p>
                Esta es una vista previa de la navegación y los estados que
                tendrá el panel. No hay métricas, solicitudes, aprobaciones,
                suspensiones ni datos reales conectados.
              </p>
              <div className="requirement-grid">
                <div>
                  <strong>Se implementará</strong>
                  <span>
                    {isSeller
                      ? "Gestión de publicaciones, pedidos, eventos, citas y mensajes."
                      : "Revisión de solicitudes, moderación, denominaciones, reclamos y reportes."}
                  </span>
                </div>
                <div>
                  <strong>Ahora mismo</strong>
                  <span>
                    Solo contenido visual de demostración, sin acciones sobre
                    usuarios o tiendas.
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const faqs = [
  {
    q: "¿CuadraZone ya está procesando compras?",
    a: "No. El catálogo, carrito y checkout son demostraciones locales. No se cobran pagos ni se crean pedidos.",
  },
  {
    q: "¿Cómo se verificará una tienda?",
    a: "La revisión solicitará los requisitos indicados en Vende en CuadraZone. Etapa 1 no recibe documentos reales y la insignia mostrada es ilustrativa.",
  },
  {
    q: "¿Puedo reservar un servicio o evento?",
    a: "Puedes explorar las pantallas de selección, pero no se confirma una reserva, boleto o cita real en esta etapa.",
  },
  {
    q: "¿Dónde puedo pedir soporte?",
    a: "El centro de soporte se habilitará con canales verificados en una etapa posterior. Por ahora puedes revisar estas preguntas frecuentes.",
  },
];
export function HelpPage() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="market-page">
      <div className="container">
        <Crumbs current="Ayuda" />
        <Intro
          eyebrow="Estamos para orientarte"
          title="Centro de ayuda"
          copy="Respuestas cortas sobre esta primera etapa de CuadraZone."
          badge="Contenido de demostración"
        />
        <div className="help-layout">
          <section>
            <div className="faq-list">
              {faqs.map((faq, index) => (
                <div
                  className={`faq-item ${open === index ? "open" : ""}`}
                  key={faq.q}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(open === index ? null : index)}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={18} />
                  </button>
                  {open === index && <p>{faq.a}</p>}
                </div>
              ))}
            </div>
          </section>
          <aside className="support-card">
            <CircleHelp size={23} />
            <h2>¿Necesitas otra guía?</h2>
            <p>
              Las categorías de ayuda y un canal de soporte se conectarán más
              adelante, sin enviar nada desde esta vista.
            </p>
            <button
              className="btn btn-outline btn-wide"
              type="button"
              onClick={() =>
                toast.info("Soporte en preparación", {
                  description:
                    "El contacto se habilitará en una etapa posterior.",
                })
              }
            >
              <Mail size={16} /> Ver contacto futuro
            </button>
            <div className="help-categories">
              <span>Compras</span>
              <span>Vendedores</span>
              <span>Eventos</span>
              <span>Servicios</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Fecha desde la que rigen los documentos definitivos. */
const LEGAL_EFFECTIVE_DATE = "23 de octubre de 2026";

const legalContent: Record<
  string,
  { title: string; intro: string; final: boolean; sections: [string, string][] }
> = {
  fe: {
    title: "Nuestra fe y valores",
    intro: "CuadraZone nace de la comunidad cristiana de Panamá y está abierto a todos los que respeten sus valores.",
    final: true,
    sections: [
      [
        "Nuestra fe",
        "Confesamos que Cristo es Rey y que Jesús es Dios, nuestro Señor y Salvador, y reconocemos la Biblia como la Palabra de Dios y fundamento de nuestra fe.",
      ],
      [
        "Abierto a todos",
        "Pueden comprar y vender en CuadraZone personas cristianas y no cristianas. No pedimos pertenecer a una iglesia: pedimos respetar los valores de la plataforma.",
      ],
      [
        "Valores que no se negocian",
        "Honestidad en lo que se ofrece y se cobra; respeto y trato justo con todos; cumplir lo prometido; y no publicar productos, servicios ni contenido contrarios a la fe cristiana, como ocultismo, contenido sexual, vicios o mensajes que ataquen la fe.",
      ],
      [
        "Aceptación",
        "Todo vendedor acepta estos valores al enviar su solicitud, y su aceptación queda registrada con la versión vigente. Incumplirlos puede llevar a ocultar publicaciones o cerrar la tienda.",
      ],
    ],
  },
  conducta: {
    title: "Código de conducta",
    intro: "Las reglas de convivencia y de comercio honesto que aceptan todas las personas que compran y venden en CuadraZone.",
    final: true,
    sections: [
      [
        "A quién aplica",
        "A todos los vendedores y compradores de CuadraZone. Los vendedores lo aceptan al enviar su solicitud y es una condición para mantener su tienda activa.",
      ],
      [
        "Respeto",
        "Trata a todos con respeto y cortesía, como hermanos. No se permiten insultos, amenazas, acoso, lenguaje ofensivo ni discriminación. La mensajería de CuadraZone es solo para asuntos del pedido o de la publicación.",
      ],
      [
        "Comercio honesto",
        "Describe tus productos y servicios tal como son, con fotos reales de lo que vendes y precios claros. Mantén tu inventario al día, cumple lo que ofreces en entrega y tiempos, y no cobres recargos que no estén indicados en la publicación o en la tienda.",
      ],
      [
        "Pagos seguros",
        "Cobra solo por los métodos registrados en tu tienda: Yappy, link de pago de una plataforma permitida, tarjeta con datáfono al entregar, transferencia o efectivo. Nunca pidas ni envíes datos de tarjeta, contraseñas ni códigos de verificación por mensaje. CuadraZone no procesa ni guarda datos de tarjetas.",
      ],
      [
        "Lo que no se puede publicar",
        "Productos o servicios ilegales, robados o falsificados; armas, drogas o medicamentos que requieran receta; contenido sexual o violento; ocultismo; publicidad engañosa; y cualquier contenido contrario a los valores cristianos de CuadraZone, que aplican a todos los vendedores, sean o no cristianos.",
      ],
      [
        "Obligaciones del vendedor",
        "Mantener su información y sus datos de cobro correctos, pagar la mensualidad de su plan al terminar los 3 meses gratis y, si vende productos físicos, pagar la comisión por venta entregada (8% durante la prueba y 5% después, calculada solo sobre los productos, sin el envío).",
      ],
      [
        "Incumplimientos",
        "Si alguien no cumple este código, CuadraZone puede pedir correcciones, ocultar publicaciones, suspender o desactivar la tienda o la cuenta. Desactivar una tienda no cancela las comisiones pendientes.",
      ],
      [
        "Reportes",
        "Si ves una publicación o un trato que no cumple este código, comunícalo al equipo de CuadraZone con el nombre de la tienda y, si aplica, el número de pedido.",
      ],
    ],
  },
  privacidad: {
    title: "Política de privacidad",
    intro: "Qué datos personales recopila CuadraZone, para qué los usa, con quién los comparte y cómo puedes ejercer tus derechos según la Ley 81 de 2019 de Protección de Datos Personales de Panamá.",
    final: true,
    sections: [
      [
        "Responsable",
        "CuadraZone, marketplace operado en Panamá, es responsable del tratamiento de los datos que se describen aquí. Puedes contactarnos por los canales publicados en la sección de Ayuda.",
      ],
      [
        "Datos de tu cuenta",
        "Puedes entrar con Google, con tu correo o con tu celular. Con Google recibimos tu nombre, tu correo verificado y un identificador de tu cuenta, nunca tu contraseña. Con correo o celular guardamos ese dato, verificado con un código de un solo uso; del código solo guardamos una huella cifrada. En tu perfil guardas además tu nombre visible y tu teléfono.",
      ],
      [
        "Datos de los vendedores",
        "Para revisar una solicitud de vendedor guardamos el tipo y nombre del negocio, sus categorías, el tipo y número de identificación, tus nombres y apellidos como aparecen en ella y su vencimiento, el país, provincia y ciudad, la iglesia, el pastor y la denominación si los indicas, la aceptación de los valores cristianos de CuadraZone, el código de conducta y esta política, y los documentos que subes: foto de tu cédula, captura de tu Yappy o banco con tu nombre y, si la agregas, carta pastoral. Para la verificación inmediata, un programa de lectura de texto que corre en nuestros propios servidores compara los nombres de esas imágenes; no se envían a terceros. De tu tienda guardamos su descripción, fotos, tarifas de entrega, tu Yappy y tu link de pago con tarjeta.",
      ],
      [
        "Datos de compras",
        "Al comprar guardamos el nombre de quien recibe, teléfono, dirección y provincia de entrega, los productos, el método de pago elegido, el estado del pedido, los mensajes con el vendedor y las reseñas que publiques. De los pagos a CuadraZone guardamos monto, método, fecha y número de comprobante. Nunca guardamos datos de tarjetas: los pagos con tarjeta se hacen en la plataforma del vendedor o en su datáfono.",
      ],
      [
        "Para qué los usamos",
        "Para crear tu cuenta e iniciar sesión; revisar y aprobar vendedores, incluida la verificación del correo y del teléfono; mostrar tiendas y publicaciones; gestionar pedidos, entregas y mensajes; cobrar mensualidades y comisiones; prevenir fraudes y mantener la seguridad del sitio. No vendemos tus datos ni los usamos para publicidad de terceros.",
      ],
      [
        "Qué es público",
        "El nombre de la tienda, su descripción, provincia y ciudad, sus publicaciones con fotos y precios, y las reseñas. El Yappy o el link de pago del vendedor solo lo ven los compradores con un pedido pagado por ese método. En los anuncios de bienes raíces son públicos el precio, la ubicación aproximada (provincia, distrito y barrio, nunca la dirección exacta), las fotos y el celular que el anunciante pone para que lo contacten. Los documentos de identidad, la captura de Yappy o banco y la carta pastoral nunca son públicos: solo los ve el equipo de CuadraZone cuando una solicitud necesita revisión.",
      ],
      [
        "Con quién compartimos datos",
        "Con el vendedor o el comprador de tu pedido, solo lo necesario para pagar y entregar (nombre, teléfono y dirección de entrega). Con Google, para el inicio de sesión. Con Railway, que aloja el sitio, la base de datos y las fotos en servidores ubicados fuera de Panamá. Con Brevo, que envía en nuestro nombre los correos automáticos (tu correo, tu nombre y el contenido del aviso). Con el servicio de SMS que envía los códigos a tu celular (tu número y el código). Con las autoridades, únicamente cuando la ley lo exija.",
      ],
      [
        "Cookies",
        "Usamos una cookie para mantener tu sesión iniciada y otra temporal para proteger el inicio de sesión con Google. No usamos cookies de publicidad ni de seguimiento.",
      ],
      [
        "Conservación",
        "Guardamos tus datos mientras tu cuenta esté activa. Los datos de pedidos, pagos y verificación de vendedores pueden conservarse después durante el tiempo que exijan las obligaciones legales, contables o la atención de reclamos.",
      ],
      [
        "Tus derechos",
        "Puedes solicitar el acceso a tus datos, su rectificación, su cancelación, oponerte a su tratamiento y pedir su portabilidad, como establece la Ley 81 de 2019. Para hacerlo, escríbenos indicando el correo de tu cuenta; podremos pedirte que confirmes tu identidad antes de atender la solicitud. Tu nombre y teléfono puedes corregirlos en Mi cuenta, salvo mientras una solicitud de vendedor esté en revisión o aprobada.",
      ],
      [
        "Seguridad",
        "El sitio funciona con conexión cifrada (HTTPS), las sesiones están firmadas y los documentos de verificación se guardan de forma privada con acceso restringido al equipo de CuadraZone.",
      ],
      [
        "Cambios",
        "Si modificamos esta política publicaremos la nueva versión en esta página con su fecha de vigencia. Si el cambio afecta lo que aceptaste como vendedor, te pediremos aceptarlo de nuevo.",
      ],
    ],
  },
  terminos: {
    title: "Términos de uso",
    intro: "Estructura de borrador para explicar el uso de la plataforma.",
    final: false,
    sections: [
      [
        "Alcance",
        "Este texto definirá las reglas de uso del marketplace, perfiles de tiendas, publicaciones y transacciones.",
      ],
      [
        "Responsabilidades",
        "Las responsabilidades de compradores, vendedores y plataforma quedarán detalladas después de la revisión jurídica.",
      ],
    ],
  },
  reclamos: {
    title: "Reclamos y resolución",
    intro:
      "Estructura de borrador para explicar cómo se atenderán incidencias.",
    final: false,
    sections: [
      [
        "Canales",
        "Se publicarán canales de soporte y los datos que conviene incluir para dar seguimiento a un caso.",
      ],
      [
        "Tiempos y alcance",
        "Los tiempos de respuesta, mediación y posibles resultados serán definidos más adelante.",
      ],
    ],
  },
};
export function LegalPage({ topic }: { topic: string }) {
  const content = legalContent[topic];
  if (!content)
    return (
      <div className="market-page">
        <div className="container not-found">
          <p className="eyebrow">404 · Documento no encontrado</p>
          <h1>Este documento no existe.</h1>
          <Link className="btn btn-gold" href="/ayuda">
            Ir a ayuda
          </Link>
        </div>
      </div>
    );
  return (
    <div className="market-page">
      <div className="container">
        <Crumbs current={content.title} parent="Legal" />
        <div className="legal-layout">
          <aside className="legal-nav">
            <p className="eyebrow">Documentos</p>
            {Object.entries(legalContent).map(([key, value]) => (
              <Link
                className={key === topic ? "active" : ""}
                href={`/legal/${key}`}
                key={key}
              >
                <Scale size={15} /> {value.title}
              </Link>
            ))}
          </aside>
          <article className="legal-card">
            <span className="demo-badge">
              {content.final ? `Vigente desde el ${LEGAL_EFFECTIVE_DATE}` : "Borrador · pendiente de revisión"}
            </span>
            <h1>{content.title}</h1>
            <p className="legal-intro">{content.intro}</p>
            {content.sections.map(([title, text]) => (
              <section key={title}>
                <h2>{title}</h2>
                <p>{text}</p>
              </section>
            ))}
            {!content.final && (
              <div className="notice-panel">
                <Info size={18} />
                <span>
                  Este documento todavía es un borrador y no sustituye la
                  versión final que se publique.
                </span>
              </div>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
