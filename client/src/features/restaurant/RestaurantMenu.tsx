import { useMemo, useState } from "react";
import { Clock, Truck, UtensilsCrossed, X } from "lucide-react";
import {
  priceFor,
  weekDayLabels,
  weekDays,
  type MenuSelection,
  type PublicMenuItem,
} from "@shared/menu";
import { trpc } from "@/lib/trpc";
import "./restaurant.css";

const usd = (c: number) => `US$${(c / 100).toFixed(2)}`;

/** Menú público de un restaurante; no muestra nada si la tienda no es restaurante. */
export function RestaurantMenu({ slug }: { slug: string }) {
  const q = trpc.menu.forStore.useQuery({ slug }, { staleTime: 60_000 });
  const [tab, setTab] = useState<number | null>(null);
  const [open, setOpen] = useState<PublicMenuItem | null>(null);
  const m = q.data;
  if (!m || !m.sections.length) return null;
  const active = tab ?? m.sections[0]!.id;
  const items = m.items.filter(i => i.sectionId === active);
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
      {open && <DishDialog item={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** Elegir tamaño, combo, quitar y extras; el precio se actualiza en vivo. */
function DishDialog({
  item,
  onClose,
}: {
  item: PublicMenuItem;
  onClose: () => void;
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
            disabled
            title="Los pedidos en línea de restaurantes llegan muy pronto"
          >
            Agregar · {usd(price.cents * qty)}
          </button>
        </div>
        {!price.ok && (
          <p className="rm-hint" role="status">
            {price.errors[0]}
          </p>
        )}
        <p className="rm-hint">
          Los pedidos en línea de restaurantes llegan muy pronto.
        </p>
      </div>
    </div>
  );
}
