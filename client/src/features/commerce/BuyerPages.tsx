import type { CartItemDTO, DeliveryMode } from "@shared/commerce";
import { paymentMethodLabels } from "@shared/commerce";
import { coveredProvinces, shippingFeeFor } from "@shared/marketplace";
import { useMarket } from "@/contexts/MarketContext";
import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Heart, Package, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AuthGate } from "@/features/membership/AuthGate";
import { provinceOptions } from "@shared/membership";
import { usd } from "@/lib/liveCatalog";
import { RealProductCard, RequestError } from "./PublicCatalogPages";
export function CommerceNav() {
  return (
    <nav className="live-account-nav" aria-label="Mi actividad">
      <Link href="/mi-carrito">Mi carrito</Link>
      <Link href="/mi-lista">Mis deseos</Link>
      <Link href="/pedidos">Mis pedidos</Link>
      <Link href="/mensajes">Mensajes</Link>
      <Link href="/notificaciones">Notificaciones</Link>
      <Link href="/vendedor/productos">Mi tienda</Link>
    </nav>
  );
}
function CartContent() {
  const cart = trpc.commerce.cart.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.commerce.setCartQuantity.useMutation({
    onSuccess: () => utils.commerce.cart.invalidate(),
    onError: e => toast.error(e.message),
  });
  const remove = trpc.commerce.removeCart.useMutation({
    onSuccess: () => utils.commerce.cart.invalidate(),
    onError: e => toast.error(e.message),
  });
  return (
    <div className="live-page container">
      <CommerceNav />
      <p className="eyebrow">GUARDADO EN TU CUENTA</p>
      <h1>Tu carrito, de tienda en tienda</h1>
      <p>
        Los precios y las existencias se vuelven a validar en el servidor al
        crear el pedido.
      </p>
      {cart.error ? (
        <RequestError
          message={cart.error.message}
          retry={() => cart.refetch()}
        />
      ) : !cart.data ? (
        <p role="status">Cargando carrito…</p>
      ) : !cart.data.items.length ? (
        <div className="live-empty">
          <ShoppingBag size={40} />
          <h2>Tu carrito todavía está vacío</h2>
          <p>
            Solo los artículos reales de tiendas activas pueden generar pedidos.
            Los ejemplos de diseño permanecen separados.
          </p>
          <Link className="btn btn-gold" href="/mercado">
            Explorar catálogo real
          </Link>
          <Link className="btn btn-outline" href="/carrito">
            Ver carrito de ejemplo
          </Link>
        </div>
      ) : (
        <div className="live-cart-layout">
          <section>
            {cart.data.items.map(item => (
              <article className="live-cart-line" key={item.id}>
                {item.image && <img src={item.image} alt={item.title} />}
                <div>
                  <small>{item.storeName}</small>
                  <Link href={`/articulo/${item.slug}`}>
                    <h2>{item.title}</h2>
                  </Link>
                  <p>{[item.size, item.color].filter(Boolean).join(" · ")}</p>
                  <strong>{usd(item.priceCents)}</strong>
                  {!item.available && (
                    <p className="live-error-text">
                      Este artículo o su tienda ya no están disponibles.
                    </p>
                  )}
                  {item.quantity > item.stock && (
                    <p className="live-error-text">
                      El inventario cambió: quedan {item.stock} unidades.
                    </p>
                  )}
                </div>
                <label>
                  Cantidad
                  <select
                    value={item.quantity}
                    disabled={update.isPending}
                    onChange={e =>
                      update.mutate({
                        id: item.id,
                        quantity: Number(e.target.value),
                      })
                    }
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="live-icon-button"
                  aria-label={`Quitar ${item.title}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: item.id })}
                >
                  <Trash2 size={19} />
                </button>
              </article>
            ))}
          </section>
          <aside className="live-summary">
            <h2>Resumen</h2>
            <p>
              Artículos <strong>{usd(cart.data.subtotalCents)}</strong>
            </p>
            <p>CuadraZone no te cobra recargos: pagas los artículos y el envío que define cada vendedor.</p>
            {cart.data.items.every(
              item => item.available && item.quantity <= item.stock
            ) ? (
              <Link className="btn btn-gold btn-wide" href="/comprar">
                Continuar al pedido
              </Link>
            ) : (
              <p className="live-error-text">
                Actualiza los artículos no disponibles antes de continuar.
              </p>
            )}
            <small>
              Las tarifas de entrega configuradas se muestran en el siguiente
              paso. No se realiza un cobro electrónico.
            </small>
          </aside>
        </div>
      )}
    </div>
  );
}
export function RealCartPage() {
  return (
    <AuthGate>
      <CartContent />
    </AuthGate>
  );
}
function WishlistContent() {
  const favorites = trpc.commerce.favorites.useQuery();
  return (
    <div className="live-page container">
      <CommerceNav />
      <p className="eyebrow">GUARDADO EN TU CUENTA</p>
      <h1>Lo que quieres encontrar después</h1>
      {favorites.error ? (
        <RequestError
          message={favorites.error.message}
          retry={() => favorites.refetch()}
        />
      ) : !favorites.data ? (
        <p role="status">Cargando deseos…</p>
      ) : !favorites.data.items.length ? (
        <div className="live-empty">
          <Heart size={38} />
          <h2>Aún no tienes artículos guardados</h2>
          <Link className="btn btn-gold" href="/mercado">
            Descubrir catálogo real
          </Link>
        </div>
      ) : (
        <div className="live-product-grid">
          {favorites.data.items.map(p => (
            <RealProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
export function RealWishlistPage() {
  return (
    <AuthGate>
      <WishlistContent />
    </AuthGate>
  );
}
function CheckoutContent() {
  const cart = trpc.commerce.cart.useQuery();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const create = trpc.commerce.checkout.useMutation();
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  // La provincia del comprador viene de la que eligió arriba («Explorar en»).
  const market = useMarket();
  const [province, setProvince] = useState(market.province || "Panamá");
  const [modes, setModes] = useState<
    Record<number, "shipping" | "pickup" | "home">
  >({});
  const groups = [
    ...new Map((cart.data?.items ?? []).map(i => [i.storeId, i])).values(),
  ];
  function offered(g: CartItemDTO): DeliveryMode[] {
    return (["pickup", "shipping", "home"] as const).filter(
      mode =>
        (cart.data?.items
          .filter(i => i.storeId === g.storeId)
          .every(i => (i.productDeliveryModes ?? []).includes(mode)) ??
          false) &&
        (mode === "pickup" ||
          (coveredProvinces({ deliveryProvinces: g.storeDeliveryProvinces, shippingFeesByProvince: g.storeShippingFees }).includes(province) &&
            (mode === "shipping"
              ? shippingFeeOf(g)
              : g.storeHomeFeeCents) != null))
    );
  }
  function shippingFeeOf(g: CartItemDTO) {
    return shippingFeeFor(
      { shippingFeeCents: g.storeShippingFeeCents, deliveryProvinces: g.storeDeliveryProvinces, shippingFeesByProvince: g.storeShippingFees },
      province
    );
  }
  function chosen(g: CartItemDTO) {
    const options = offered(g);
    return options.includes(modes[g.storeId]) ? modes[g.storeId] : options[0];
  }
  function fee(g: CartItemDTO) {
    const mode = chosen(g);
    return mode === "shipping"
      ? (shippingFeeOf(g) ?? 0)
      : mode === "home"
        ? (g.storeHomeFeeCents ?? 0)
        : 0;
  }
  const deliveryFees = groups.reduce((sum, g) => sum + fee(g), 0);
  const estimate = (cart.data?.subtotalCents ?? 0) + deliveryFees;
  const missingMode = groups.some(g => !chosen(g));
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    if (missingMode) {
      toast.error(
        "Alguna tienda no ofrece una modalidad común para estos artículos y esta provincia."
      );
      return;
    }
    const payload = {
      expectedTotalCents: estimate,
      recipientName: String(values.get("recipientName") ?? "").trim(),
      phone: String(values.get("phone") ?? "").trim(),
      province,
      city: String(values.get("city") ?? "").trim(),
      address: String(values.get("address") ?? "").trim(),
      deliveries: groups
        .map(g => ({ storeId: g.storeId, mode: chosen(g)! }))
        .sort((a, b) => a.storeId - b.storeId),
      paymentMethod: String(values.get("paymentMethod")) as
        | "yappy"
        | "transfer"
        | "cod"
        | "card_link"
        | "card_on_delivery",
    };
    const fingerprint = JSON.stringify({
      ...payload,
      items: cart.data?.items.map(i => [i.variantId, i.quantity]),
    });
    if (!attempt.current || attempt.current.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await create.mutateAsync({
        ...payload,
        checkoutKey: attempt.current.key,
      });
      await Promise.all([
        utils.commerce.cart.invalidate(),
        utils.commerce.orders.invalidate(),
        utils.commerce.notifications.invalidate(),
      ]);
      toast.success("Pedido registrado", {
        description:
          payload.paymentMethod === "yappy"
            ? "Ahora paga por Yappy al vendedor con los datos del pedido."
            : "Pago pendiente. Coordina el pago con el vendedor.",
      });
      // Con un solo pedido vamos directo a su detalle, donde están los datos de pago.
      navigate(result.orders.length === 1 ? `/pedidos/${result.orders[0]!.id}` : "/pedidos");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el pedido"
      );
      cart.refetch();
    }
  }
  return (
    <div className="live-page container">
      <CommerceNav />
      <p className="eyebrow">CHECKOUT MULTIVENDEDOR</p>
      <h1>Entrega y registro de tu pedido</h1>
      <div className="live-notice">
        <strong>Sin cobros electrónicos activos.</strong> Se registra un pedido
        pendiente con pago directo al vendedor. No se guardan tarjetas ni se
        presume que un pago fue realizado.
      </div>
      {cart.error ? (
        <RequestError
          message={cart.error.message}
          retry={() => cart.refetch()}
        />
      ) : !cart.data ? (
        <p role="status">Cargando artículos…</p>
      ) : !cart.data.items.length ? (
        <div className="live-empty">
          <p>Tu carrito real está vacío.</p>
          <Link className="btn btn-gold" href="/mercado">
            Ver productos
          </Link>
        </div>
      ) : (
        <form className="live-checkout" onSubmit={submit}>
          <section className="live-panel">
            <h2>Datos de entrega</h2>
            <div className="live-field-row">
              <label>
                Nombre de quien recibe
                <input
                  name="recipientName"
                  minLength={2}
                  maxLength={120}
                  required
                  autoComplete="name"
                />
              </label>
              <label>
                Teléfono
                <input
                  name="phone"
                  type="tel"
                  maxLength={20}
                  required
                  placeholder="+507 6000 0000"
                  autoComplete="tel"
                />
              </label>
            </div>
            <div className="live-field-row">
              <label>
                Provincia
                <select
                  value={province}
                  onChange={e => setProvince(e.target.value)}
                >
                  {provinceOptions.map(p => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Ciudad
                <input
                  name="city"
                  minLength={2}
                  maxLength={100}
                  required
                  autoComplete="address-level2"
                />
              </label>
            </div>
            <label>
              Dirección o instrucciones de retiro
              <textarea
                name="address"
                maxLength={1000}
                required
                autoComplete="street-address"
              />
            </label>
            <h2>Entrega por tienda</h2>
            {groups.map(g => (
              <label key={g.storeId}>
                {g.storeName}
                <select
                  value={chosen(g) ?? ""}
                  onChange={e =>
                    setModes({
                      ...modes,
                      [g.storeId]: e.target.value as DeliveryMode,
                    })
                  }
                >
                  {!offered(g).length && (
                    <option value="">Sin modalidad disponible</option>
                  )}
                  {offered(g).map(mode => (
                    <option key={mode} value={mode}>
                      {mode === "pickup"
                        ? "Retiro personal"
                        : mode === "shipping"
                          ? "Envío"
                          : "A domicilio"}{" "}
                      ·{" "}
                      {usd(
                        mode === "pickup"
                          ? 0
                          : mode === "shipping"
                            ? (g.storeShippingFeeCents ?? 0)
                            : (g.storeHomeFeeCents ?? 0)
                      )}
                    </option>
                  ))}
                </select>
                <small>
                  {offered(g).length
                    ? `Cobertura confirmada por la tienda para ${province}.`
                    : "Estos artículos no comparten una modalidad configurada para esta provincia. Cambia la provincia, separa el pedido o consulta al vendedor."}
                </small>
              </label>
            ))}
            <h2>Pago directo al vendedor</h2>
            <label>
              Método
              <select name="paymentMethod" defaultValue="cod">
                <option value="cod">Efectivo contra entrega</option>
                <option value="yappy">Yappy directo al vendedor</option>
                <option value="card_link">Tarjeta de crédito o débito (link de pago del vendedor)</option>
                <option value="card_on_delivery">Tarjeta de crédito o débito al retirar o recibir</option>
                <option value="transfer">Transferencia bancaria</option>
              </select>
            </label>
            <p className="live-muted">
              Le pagas directo a cada vendedor. Con Yappy o con link de pago,
              al registrar el pedido verás dónde pagar y el número de pedido.
              Con tarjeta al recibir, el vendedor cobra con su datáfono (solo en
              retiro o entrega a domicilio). Si una tienda no acepta el método
              elegido, te avisaremos. Nunca escribas datos de tu tarjeta en
              CuadraZone ni en mensajes.
            </p>
          </section>
          <aside className="live-summary">
            <h2>Artículos</h2>
            {cart.data.items.map(i => (
              <p key={i.id}>
                <span>
                  {i.quantity} × {i.title}
                </span>
                <strong>{usd(i.priceCents * i.quantity)}</strong>
              </p>
            ))}
            <p>
              Subtotal <strong>{usd(cart.data.subtotalCents)}</strong>
            </p>
            <p>
              Entrega <strong>{usd(deliveryFees)}</strong>
            </p>
            <p>
              <strong>Total estimado</strong>
              <strong>{usd(estimate)}</strong>
            </p>
            <p>
              Recargo de CuadraZone al comprador: <strong>US$0.00</strong>
            </p>
            <p className="live-muted">
              El total definitivo se calcula en servidor con la tarifa
              configurada de cada tienda. No se acepta un total proporcionado
              por el navegador.
            </p>
            {create.error && <RequestError message={create.error.message} />}
            <button
              className="btn btn-gold btn-wide"
              type="submit"
              disabled={
                create.isPending ||
                missingMode ||
                cart.data.items.some(i => !i.available || i.quantity > i.stock)
              }
            >
              {create.isPending ? "Registrando…" : "Registrar pedido pendiente"}
            </button>
          </aside>
        </form>
      )}
    </div>
  );
}
export function RealCheckoutPage() {
  return (
    <AuthGate>
      <CheckoutContent />
    </AuthGate>
  );
}
const statusText: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
function OrdersContent({ seller = false }: { seller?: boolean }) {
  const buyer = trpc.commerce.orders.useQuery({}, { enabled: !seller });
  const sales = trpc.commerce.sellerOrders.useQuery({}, { enabled: seller });
  const query = seller ? sales : buyer;
  return (
    <div className="live-page container">
      <CommerceNav />
      <p className="eyebrow">
        {seller ? "PEDIDOS DE MI TIENDA" : "HISTORIAL PRIVADO"}
      </p>
      <h1>{seller ? "Acompaña cada venta" : "Tus pedidos"}</h1>
      {query.error ? (
        <RequestError
          message={query.error.message}
          retry={() => query.refetch()}
        />
      ) : !query.data ? (
        <p role="status">Cargando pedidos…</p>
      ) : !query.data.length ? (
        <div className="live-empty">
          <Package size={40} />
          <h2>Todavía no hay pedidos</h2>
          <p>
            No se crean ventas ficticias ni pedidos de productos de
            demostración.
          </p>
          <Link
            href={seller ? "/vendedor/productos" : "/mercado"}
            className="btn btn-gold"
          >
            {seller ? "Gestionar mis productos" : "Explorar catálogo"}
          </Link>
        </div>
      ) : (
        <div className="live-orders">
          {query.data.map(o => (
            <article className="live-order-card" key={o.id}>
              <div>
                <small>{o.storeName}</small>
                <h2>Pedido {o.number}</h2>
                <p>
                  {statusText[o.status] ?? o.status} · {usd(o.totalCents)}
                </p>
                <p>
                  Pago:{" "}
                  {o.paymentStatus === "pending" ||
                  o.paymentStatus === "awaiting_payment"
                    ? "pendiente de coordinación"
                    : o.paymentStatus}
                </p>
              </div>
              <Link className="btn btn-outline" href={`/pedidos/${o.id}`}>
                Ver pedido
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
export function OrdersPage({ seller = false }: { seller?: boolean }) {
  return (
    <AuthGate>
      <OrdersContent seller={seller} />
    </AuthGate>
  );
}
function OrderContent({ id }: { id: number }) {
  const order = trpc.commerce.order.useQuery({ id });
  const utils = trpc.useUtils();
  const transition = trpc.commerce.transitionOrder.useMutation({
    onSuccess: () => {
      order.refetch();
      utils.commerce.orders.invalidate();
      utils.commerce.sellerOrders.invalidate();
      utils.commerce.notifications.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const o = order.data;
  if (order.error)
    return (
      <div className="live-page container">
        <CommerceNav />
        <RequestError
          message={order.error.message}
          retry={() => order.refetch()}
        />
      </div>
    );
  if (!o)
    return (
      <div className="live-page container">
        <p role="status">Cargando pedido…</p>
      </div>
    );
  const seller = o.viewerRole === "seller";
  const buyer = o.viewerRole === "buyer";
  function change(status: "confirmed" | "shipped" | "delivered" | "cancelled") {
    if (
      !window.confirm(
        status === "cancelled"
          ? "¿Cancelar este pedido? El stock reservado se restituirá una sola vez."
          : `¿Cambiar este pedido a ${statusText[status]}?`
      )
    )
      return;
    transition.mutate({ id, status });
  }
  return (
    <div className="live-page container">
      <CommerceNav />
      <Link href="/pedidos">← Pedidos</Link>
      <h1>Pedido {o.number}</h1>
      <p>
        {o.storeName} · <strong>{statusText[o.status]}</strong>
      </p>
      <section className="live-panel">
        <h2>Artículos</h2>
        {o.items.map((i, index) => (
          <p className="live-order-item" key={index}>
            {i.quantity} × {i.title} {i.size && `· ${i.size}`}{" "}
            {i.color && `· ${i.color}`}
            <strong>{usd(i.unitPriceCents * i.quantity)}</strong>
          </p>
        ))}
        <p>Tarifa de entrega: {usd(o.deliveryFeeCents)}</p>
        <h3>Total {usd(o.totalCents)}</h3>
        <p>
          Pago directo al vendedor:{" "}
          <strong>{paymentMethodLabels[o.paymentMethod]}</strong>
          {o.status === "pending" && " · el vendedor confirmará el pedido al recibir tu pago"}
        </p>
        {o.sellerYappy && o.viewerRole === "buyer" && o.status !== "cancelled" && (
          <div className="member-notice">
            <p><strong>Paga {usd(o.totalCents)} por Yappy a {o.storeName}</strong></p>
            {o.sellerYappy.phone && <p>Celular: <strong>{o.sellerYappy.phone.replace(/^\+507(\d{4})(\d{4})$/, "+507 $1-$2")}</strong></p>}
            {o.sellerYappy.directory && <p>Directorio Yappy: <strong>{o.sellerYappy.directory}</strong></p>}
            <p>En el mensaje del Yappy escribe tu número de pedido: <strong>{o.number}</strong></p>
            <p className="live-muted">Revisa que el nombre que te muestra Yappy sea el de la tienda antes de enviar.</p>
          </div>
        )}
        {o.paymentMethod === "card_link" && o.viewerRole === "buyer" && o.status !== "cancelled" && (
          <div className="member-notice">
            <p><strong>Paga {usd(o.totalCents)} con tarjeta a {o.storeName}</strong></p>
            {o.sellerCardLink ? (
              <>
                <p>
                  <a className="btn btn-gold" href={o.sellerCardLink} target="_blank" rel="noopener noreferrer nofollow">
                    Abrir el link de pago ({new URL(o.sellerCardLink).hostname.replace(/^www\./, "")})
                  </a>
                </p>
                <p>Si el link te pide una descripción, escribe tu número de pedido: <strong>{o.number}</strong></p>
                <p className="live-muted">El pago se hace en la plataforma del vendedor; CuadraZone no ve ni guarda los datos de tu tarjeta.</p>
              </>
            ) : (
              <p>La tienda ya no tiene link de pago activo. Escríbele por la mensajería del pedido.</p>
            )}
          </div>
        )}
        {o.paymentMethod === "card_on_delivery" && o.viewerRole === "buyer" && o.status !== "cancelled" && (
          <p className="member-notice">Pagarás {usd(o.totalCents)} con tarjeta de crédito o débito en el datáfono de {o.storeName} al retirar o recibir tu pedido.</p>
        )}
        <h2>Entrega privada</h2>
        <p>
          {o.recipientName} · {o.phone}
        </p>
        <p>
          {o.province}, {o.city} · {o.address}
        </p>
        <p>
          Modalidad:{" "}
          {o.deliveryMode === "pickup"
            ? "Retiro personal"
            : o.deliveryMode === "shipping"
              ? "Envío"
              : "A domicilio"}
        </p>
        <div className="live-actions">
          {seller && o.status === "pending" && (
            <button
              className="btn btn-gold"
              disabled={transition.isPending}
              onClick={() => change("confirmed")}
            >
              Confirmar pedido
            </button>
          )}
          {seller && o.status === "confirmed" && (
            <button
              className="btn btn-gold"
              disabled={transition.isPending}
              onClick={() => change("shipped")}
            >
              Marcar enviado
            </button>
          )}
          {(seller || buyer) && o.status === "shipped" && (
            <button
              className="btn btn-gold"
              disabled={transition.isPending}
              onClick={() => change("delivered")}
            >
              Confirmar entrega
            </button>
          )}
          {(seller || buyer) && ["pending", "confirmed"].includes(o.status) && (
            <button
              className="btn btn-outline"
              disabled={transition.isPending}
              onClick={() => change("cancelled")}
            >
              Cancelar pedido
            </button>
          )}
          <Link className="btn btn-outline" href={`/mensajes?pedido=${o.id}`}>
            Escribir a la otra parte
          </Link>
        </div>
      </section>
    </div>
  );
}
export function OrderDetailPage({ id }: { id: number }) {
  return (
    <AuthGate>
      <OrderContent id={id} />
    </AuthGate>
  );
}
