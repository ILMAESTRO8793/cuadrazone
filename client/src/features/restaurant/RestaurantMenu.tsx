import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Clock,
  ShoppingBag,
  Trash2,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  describeLine,
  priceFor,
  restaurantPaymentMethods,
  weekDayLabels,
  weekDays,
  type MenuSelection,
  type PublicMenuItem,
  type RestaurantOrderLine,
} from "@shared/menu";
import { paymentMethodLabels } from "@shared/commerce";
import { shippingDeal } from "@shared/shippingRules";
import type { Point } from "@shared/location";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useMarket } from "@/contexts/MarketContext";
import { PlacePicker } from "@/components/maps/Maps";
import "./restaurant.css";

const usd = (c: number) => `US$${(c / 100).toFixed(2)}`;
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

type CartLine = RestaurantOrderLine & { key: string };

/** El carrito de cada restaurante se guarda en este navegador. */
function useRestaurantCart(slug: string) {
  const storageKey = `cz-rest-cart:${slug}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* sin almacenamiento: carrito solo en memoria */
    }
  }, [storageKey]);
  function save(next: CartLine[]) {
    setLines(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignorar */
    }
  }
  return { lines, save };
}

/** Menú público de un restaurante; no muestra nada si la tienda no es restaurante. */
export function RestaurantMenu({ slug }: { slug: string }) {
  const q = trpc.menu.forStore.useQuery({ slug }, { staleTime: 60_000 });
  const [tab, setTab] = useState<number | null>(null);
  const [open, setOpen] = useState<PublicMenuItem | null>(null);
  const [checkout, setCheckout] = useState(false);
  const cart = useRestaurantCart(slug);
  const m = q.data;
  const byId = useMemo(
    () => new Map((m?.items ?? []).map(i => [i.id, i])),
    [m]
  );
  if (!m || !m.sections.length) return null;
  const active = tab ?? m.sections[0]!.id;
  const items = m.items.filter(i => i.sectionId === active);
  // Líneas válidas con el menú actual (si un plato cambió o se agotó, se avisa).
  const priced = cart.lines.map(l => {
    const item = byId.get(l.itemId);
    if (!item)
      return {
        line: l,
        item: null,
        unit: 0,
        ok: false,
        text: "Plato que ya no está en el menú",
      };
    const p = priceFor(item, l);
    return {
      line: l,
      item,
      unit: p.cents,
      ok: p.ok && item.available,
      text: describeLine(item, l).text,
    };
  });
  const total = priced.reduce(
    (s, p) => s + (p.ok ? p.unit * p.line.qty : 0),
    0
  );
  const count = priced.reduce((s, p) => s + (p.ok ? p.line.qty : 0), 0);

  return (
    <section className="rm-menu" aria-labelledby="rm-menu-title">
      <header className="rm-menu-head">
        <h2 id="rm-menu-title">
          <UtensilsCrossed size={20} aria-hidden="true" /> Menú
        </h2>
        <p className={`rm-status ${m.status.open ? "is-open" : "is-closed"}`}>
          {m.status.open
            ? `Abierto · cierra a las ${m.status.closesAt}`
            : `Cerrado${m.status.opensLabel ? ` · abre ${m.status.opensLabel}` : ""}`}
        </p>
        <p className="rm-hint">
          <Clock size={14} aria-hidden="true" /> Preparación: ~{m.prepMinutes}{" "}
          min · <Truck size={14} aria-hidden="true" /> Delivery solo en{" "}
          {m.province}
        </p>
      </header>
      <div className="rm-tabs" role="tablist" aria-label="Secciones del menú">
        {m.sections.map(s => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === active}
            className={s.id === active ? "is-active" : ""}
            onClick={() => setTab(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="rm-grid-items" role="tabpanel">
        {items.map(it => (
          <button
            key={it.id}
            type="button"
            className={`rm-item ${it.available ? "" : "is-off"}`}
            onClick={() => setOpen(it)}
            disabled={!it.available}
          >
            <span className="rm-item-photo">
              {it.imageUrl ? (
                <img src={it.imageUrl} alt="" loading="lazy" />
              ) : (
                <UtensilsCrossed size={28} aria-hidden="true" />
              )}
            </span>
            <span className="rm-item-body">
              <strong>{it.name}</strong>
              {it.description && <small>{it.description}</small>}
              <span className="rm-item-foot">
                <b>
                  {it.sizes.length
                    ? `Desde ${usd(it.priceCents)}`
                    : usd(it.priceCents)}
                </b>
                {!it.available ? (
                  <em>Agotado</em>
                ) : (
                  it.tags.map(t => <i key={t}>{t}</i>)
                )}
              </span>
            </span>
          </button>
        ))}
      </div>
      <details className="rm-hours-public">
        <summary>Horario</summary>
        <ul>
          {weekDays.map(d => (
            <li key={d}>
              <span>{weekDayLabels[d]}</span>
              <span>
                {m.hours[d]
                  ? `${m.hours[d]!.open} – ${m.hours[d]!.close}`
                  : "Cerrado"}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {count > 0 && !checkout && (
        <button
          type="button"
          className="rm-cart-bar"
          onClick={() => setCheckout(true)}
        >
          <ShoppingBag size={18} aria-hidden="true" /> Ver mi pedido ({count}) ·{" "}
          {usd(total)}
        </button>
      )}

      {open && (
        <DishDialog
          item={open}
          canOrder={m.status.open}
          onClose={() => setOpen(null)}
          onAdd={line => {
            cart.save([...cart.lines, { ...line, key: crypto.randomUUID() }]);
            setOpen(null);
            toast.success("Agregado a tu pedido");
          }}
        />
      )}
      {checkout && (
        <CheckoutDialog
          slug={slug}
          province={m.province}
          open={m.status.open}
          priced={priced}
          total={total}
          onRemove={key => cart.save(cart.lines.filter(l => l.key !== key))}
          onClose={() => setCheckout(false)}
          onPlaced={() => cart.save([])}
        />
      )}
    </section>
  );
}

/** Elegir tamaño, combo, quitar y extras; el precio se actualiza en vivo. */
function DishDialog({
  item,
  canOrder,
  onClose,
  onAdd,
}: {
  item: PublicMenuItem;
  canOrder: boolean;
  onClose: () => void;
  onAdd: (line: RestaurantOrderLine) => void;
}) {
  const [sel, setSel] = useState<MenuSelection>({
    size: item.sizes.length ? 0 : undefined,
    groups: item.optionGroups.map(g =>
      g.kind === "choice" && g.min >= 1 ? [0] : []
    ),
  });
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const price = useMemo(() => priceFor(item, sel), [item, sel]);

  function toggle(gi: number, oi: number) {
    const g = item.optionGroups[gi]!;
    const current = sel.groups[gi] ?? [];
    let next: number[];
    if (g.max === 1) next = current.includes(oi) && g.min === 0 ? [] : [oi];
    else
      next = current.includes(oi)
        ? current.filter(x => x !== oi)
        : current.length < g.max
          ? [...current, oi]
          : current;
    setSel({ ...sel, groups: sel.groups.map((x, i) => (i === gi ? next : x)) });
  }

  return (
    <div className="rm-dialog-backdrop" onClick={onClose}>
      <div
        className="rm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rm-dialog-title"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className="rm-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>
        {item.imageUrl && (
          <img className="rm-dialog-photo" src={item.imageUrl} alt="" />
        )}
        <h3 id="rm-dialog-title">{item.name}</h3>
        {item.description && <p className="rm-hint">{item.description}</p>}
        {item.sizes.length > 0 && (
          <fieldset className="rm-choose">
            <legend>Tamaño</legend>
            {item.sizes.map((s, i) => (
              <label key={i}>
                <input
                  type="radio"
                  name="size"
                  checked={sel.size === i}
                  onChange={() => setSel({ ...sel, size: i })}
                />
                <span>{s.name}</span>
                <b>{usd(s.priceCents)}</b>
              </label>
            ))}
          </fieldset>
        )}
        {item.optionGroups.map((g, gi) => (
          <fieldset key={gi} className="rm-choose">
            <legend>
              {g.name}{" "}
              <small>
                {g.min > 0 ? "Obligatorio" : "Opcional"}
                {g.max > 1 ? ` · hasta ${g.max}` : ""}
              </small>
            </legend>
            {g.options.map((o, oi) => (
              <label key={oi}>
                <input
                  type={g.max === 1 ? "radio" : "checkbox"}
                  name={`g${gi}`}
                  checked={(sel.groups[gi] ?? []).includes(oi)}
                  onChange={() => toggle(gi, oi)}
                />
                <span>{o.name}</span>
                {o.priceCents > 0 && <b>+{usd(o.priceCents)}</b>}
              </label>
            ))}
          </fieldset>
        ))}
        <label className="rm-field">
          <span>Instrucciones (opcional)</span>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={140}
            placeholder="Ej.: sin sal, bien cocido"
          />
        </label>
        <div className="rm-dialog-foot">
          <div className="rm-qty" aria-label="Cantidad">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              aria-label="Menos"
            >
              −
            </button>
            <span>{qty}</span>
            <button
              type="button"
              onClick={() => setQty(Math.min(20, qty + 1))}
              aria-label="Más"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="btn btn-gold"
            disabled={!price.ok || !canOrder}
            onClick={() =>
              onAdd({
                itemId: item.id,
                size: sel.size,
                groups: sel.groups,
                qty,
                note: note.trim(),
              })
            }
          >
            Agregar · {usd(price.cents * qty)}
          </button>
        </div>
        {!canOrder && (
          <p className="rm-hint" role="status">
            El restaurante está cerrado ahora.
          </p>
        )}
        {canOrder && !price.ok && (
          <p className="rm-hint" role="status">
            {price.errors[0]}
          </p>
        )}
      </div>
    </div>
  );
}

function CheckoutDialog({
  slug,
  province,
  open,
  priced,
  total,
  onRemove,
  onClose,
  onPlaced,
}: {
  slug: string;
  province: string;
  open: boolean;
  priced: Array<{ line: CartLine; unit: number; ok: boolean; text: string }>;
  total: number;
  onRemove: (key: string) => void;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const auth = useAuth();
  const market = useMarket();
  const [, navigate] = useLocation();
  const place = trpc.menu.placeOrder.useMutation();
  const [point, setPoint] = useState<Point | null>(null);
  const [f, setF] = useState({
    recipientName: "",
    phone: "",
    city: "",
    address: "",
    paymentMethod: "cod" as (typeof restaurantPaymentMethods)[number],
  });
  const sameProvince =
    shippingDeal(province, market.province || province) === "free";
  const valid = priced.filter(p => p.ok);
  const broken = priced.some(p => !p.ok);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) {
      startLogin();
      return;
    }
    if (!point) {
      toast.error("Marca en el mapa el punto exacto de entrega.");
      return;
    }
    try {
      const r = await place.mutateAsync({
        slug,
        lines: valid.map(({ line }) => ({
          itemId: line.itemId,
          size: line.size,
          groups: line.groups,
          qty: line.qty,
          note: line.note,
        })),
        ...f,
        province,
        point,
      });
      onPlaced();
      toast.success("¡Pedido enviado! El restaurante lo va a aceptar.");
      navigate(`/pedidos/${r.orderId}`);
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <div className="rm-dialog-backdrop" onClick={onClose}>
      <form
        className="rm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rm-checkout-title"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
      >
        <button
          type="button"
          className="rm-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>
        <h3 id="rm-checkout-title">Mi pedido</h3>
        <ul className="rm-cart">
          {priced.map(p => (
            <li key={p.line.key} className={p.ok ? "" : "is-off"}>
              <span>
                {p.line.qty} × {p.text}
                {!p.ok && <em> · ya no disponible</em>}
              </span>
              <b>{p.ok ? usd(p.unit * p.line.qty) : "—"}</b>
              <button
                type="button"
                className="rm-icon"
                aria-label="Quitar"
                onClick={() => onRemove(p.line.key)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        {broken && (
          <p className="rm-hint">
            Lo que ya no está disponible no se va a pedir.
          </p>
        )}
        <p className="rm-total">
          Total <b>{usd(total)}</b>{" "}
          <small>· Delivery gratis en {province}</small>
        </p>
        {!sameProvince && (
          <p className="member-notice">
            Este restaurante entrega solo en {province}. Cambia «Explorar en» a{" "}
            {province} si tu dirección es ahí.
          </p>
        )}
        <div className="rm-grid">
          <label className="rm-field">
            <span>Nombre de quien recibe</span>
            <input
              value={f.recipientName}
              onChange={e => setF({ ...f, recipientName: e.target.value })}
              required
              maxLength={160}
              autoComplete="name"
            />
          </label>
          <label className="rm-field">
            <span>Celular</span>
            <input
              value={f.phone}
              onChange={e => setF({ ...f, phone: e.target.value })}
              required
              maxLength={30}
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="rm-field">
            <span>Ciudad o corregimiento</span>
            <input
              value={f.city}
              onChange={e => setF({ ...f, city: e.target.value })}
              required
              maxLength={120}
            />
          </label>
        </div>
        <label className="rm-field">
          <span>Dirección y referencias</span>
          <input
            value={f.address}
            onChange={e => setF({ ...f, address: e.target.value })}
            required
            maxLength={500}
            autoComplete="street-address"
          />
        </label>
        <div className="rm-field">
          <span>Punto exacto de entrega</span>
          <PlacePicker
            value={point}
            onChange={setPoint}
            label="Punto exacto de entrega"
          />
        </div>
        <label className="rm-field">
          <span>Pago directo al restaurante</span>
          <select
            value={f.paymentMethod}
            onChange={e =>
              setF({
                ...f,
                paymentMethod: e.target.value as typeof f.paymentMethod,
              })
            }
          >
            {restaurantPaymentMethods.map(pm => (
              <option key={pm} value={pm}>
                {paymentMethodLabels[pm]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-gold"
          type="submit"
          disabled={
            place.isPending ||
            !valid.length ||
            !open ||
            !sameProvince ||
            (auth.user ? !point : false)
          }
        >
          {!auth.user
            ? "Entrar para pedir"
            : place.isPending
              ? "Enviando…"
              : `Pedir · ${usd(total)}`}
        </button>
        {!open && (
          <p className="rm-hint" role="status">
            El restaurante está cerrado ahora.
          </p>
        )}
      </form>
    </div>
  );
}
