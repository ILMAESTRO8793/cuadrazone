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
  const requirements = ["Residencia en Panamá", "Cédula o carné vigente", "Correo y teléfono verificados", "Denominación de la lista autorizada", "Iglesia local, ciudad y pastor", "Carta pastoral firmada PDF o imagen", "Declaración de fe, conducta y privacidad"];
  return <div className="market-page"><div className="container"><Crumbs current="Vende en CuadraZone" /><Intro eyebrow="Para vendedores" title="Convierte tu propósito en una tienda" copy="Guarda tu solicitud y adjunta tus evidencias de forma privada. La verificación de correo y SMS sigue pendiente." badge="Registro de vendedores · etapa 2" /><section className="sell-content"><div><p className="eyebrow">Tu recorrido</p><h2>Una comunidad con confianza</h2><ul className="check-list">{requirements.map(item => <li key={item}><Check size={17} />{item}</li>)}</ul></div><aside className="sell-callout"><FileText size={24} /><h3>Documentos privados</h3><p>Solo tú y los administradores autenticados pueden consultarlos. Durante esta vista previa utiliza archivos de prueba sin datos sensibles; los textos legales siguen en revisión.</p><Link href="/solicitud-vendedor" className="btn btn-gold btn-wide">Comenzar mi solicitud <ArrowRight size={16} /></Link><p>Normal {sellerPlanLabel("normal")}/mes o Mayor Visibilidad {sellerPlanLabel("mayor_visibilidad")}/mes al activar tu tienda · Sin comisión CuadraZone. No se realizan cobros en esta etapa.</p><Link href="/suscripciones" className="text-link">Comparar los dos planes</Link></aside></section></div></div>;
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

const legalContent: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  fe: {
    title: "Declaración de fe",
    intro: "Bosquejo de la declaración para revisión pastoral y jurídica.",
    sections: [
      [
        "Propósito",
        "Borrador para revisión pastoral: confesamos a Jesucristo como Señor y Salvador y reconocemos la Biblia como referencia de nuestra fe cristiana. El texto definitivo deberá acordarse con el operador antes del lanzamiento público.",
      ],
      [
        "Aceptación",
        "La aceptación de este borrador y su versión se registran en la solicitud de vendedor. No sustituye la carta pastoral ni una revisión doctrinal.",
      ],
      [
        "Estado",
        "Este texto no es una declaración doctrinal final. Está pendiente de revisión pastoral y jurídica.",
      ],
    ],
  },
  terminos: {
    title: "Términos de uso",
    intro: "Estructura de borrador para explicar el uso de la plataforma.",
    sections: [
      [
        "Alcance",
        "Este texto definirá las reglas de uso del marketplace, perfiles de tiendas, publicaciones y futuras transacciones.",
      ],
      [
        "Responsabilidades",
        "Las responsabilidades de compradores, vendedores y plataforma quedarán detalladas después de la revisión jurídica.",
      ],
      [
        "Estado del documento",
        "Borrador pendiente de revisión jurídica; no afirma cumplimiento legal ni sustituye asesoría profesional.",
      ],
    ],
  },
  privacidad: {
    title: "Privacidad",
    intro: "Estructura de borrador para informar qué datos se usarán.",
    sections: [
      [
        "Datos y finalidad",
        "Se describirán los datos mínimos necesarios para cuentas, pagos, soporte y verificación cuando esas funciones estén habilitadas.",
      ],
      [
        "Control y conservación",
        "Se definirán los controles de la persona usuaria, plazos de conservación y proveedores aplicables.",
      ],
      [
        "Estado del documento",
        "Borrador pendiente de revisión jurídica. Esta Etapa 1 no solicita documentos ni datos sensibles.",
      ],
    ],
  },
  conducta: {
    title: "Fe y conducta",
    intro: "Marco de convivencia para una comunidad respetuosa.",
    sections: [
      [
        "Comunidad",
        "Las tiendas y personas participantes deberán actuar con respeto, honestidad comercial y cuidado de la comunidad de fe.",
      ],
      [
        "Denuncias",
        "El flujo de reclamos y moderación se presentará en el panel correspondiente en una etapa posterior.",
      ],
      [
        "Estado del documento",
        "Bosquejo no final, pendiente de revisión jurídica y pastoral.",
      ],
    ],
  },
  reclamos: {
    title: "Reclamos y resolución",
    intro:
      "Estructura de borrador para explicar cómo se atenderán incidencias.",
    sections: [
      [
        "Canales",
        "Se publicarán canales de soporte y los datos que conviene incluir para dar seguimiento a un caso.",
      ],
      [
        "Tiempos y alcance",
        "Los tiempos de respuesta, mediación y posibles resultados serán definidos antes del lanzamiento transaccional.",
      ],
      [
        "Estado del documento",
        "Borrador no operativo; no se reciben reclamos reales desde esta vista.",
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
              Borrador · pendiente de revisión jurídica
            </span>
            <h1>{content.title}</h1>
            <p className="legal-intro">{content.intro}</p>
            {content.sections.map(([title, text]) => (
              <section key={title}>
                <h2>{title}</h2>
                <p>{text}</p>
              </section>
            ))}
            <div className="notice-panel">
              <Info size={18} />
              <span>
                Este bosquejo no afirma cumplimiento legal, no es asesoría
                jurídica y no sustituye la versión final publicada.
              </span>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
