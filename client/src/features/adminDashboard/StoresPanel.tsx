import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { subscriptionPlanName } from "@shared/pricing";
import { trpc } from "@/lib/trpc";
import { StoreLogo } from "@/components/marketplace/StoreLogo";
import { StoreStars, VerificationStars } from "@/components/marketplace/VerificationStars";
import { verificationStarInfo, verificationStars, type VerificationStar } from "@shared/stars";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tile } from "./AdminDashboard";
import {
  SERIES,
  dateLabel,
  deliveryLabels,
  int,
  money,
  moneyShort,
  paymentLabels,
  shortMonth,
  storeStatusLabels,
  waLink,
} from "./format";

type SortKey = "soldCents" | "name" | "deliveredOrders";

export function StoresPanel({ enabled }: { enabled: boolean }) {
  const stores = trpc.adminDashboard.stores.useQuery(undefined, { enabled });
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState<SortKey>("soldCents");
  const [selected, setSelected] = useState<number | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (stores.data ?? [])
      .filter(s => plan === "all" || (s.planId ?? "none") === plan)
      .filter(
        s =>
          !q ||
          [s.name, s.sellerName, s.email, s.phone, s.province].some(v =>
            v.toLowerCase().includes(q)
          )
      )
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort]
      );
  }, [stores.data, search, plan, sort]);
  const totalSold = rows.reduce((a, s) => a + s.soldCents, 0);

  return (
    <section className="czd-panel" aria-labelledby="czd-stores">
      <div className="czd-panel-head">
        <div>
          <h2 id="czd-stores">Todas las tiendas</h2>
          <p>
            {int(rows.length)} tiendas · han vendido {money(totalSold)} en
            pedidos entregados. Toca una tienda para ver su detalle.
          </p>
        </div>
      </div>
      <div className="czd-filters">
        <input
          type="search"
          placeholder="Buscar tienda, vendedor, correo o celular"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Buscar tienda"
        />
        <select
          value={plan}
          onChange={e => setPlan(e.target.value)}
          aria-label="Filtrar por plan"
        >
          <option value="all">Todos los planes</option>
          <option value="normal">Normal</option>
          <option value="mayor_visibilidad">Mayor Visibilidad</option>
          <option value="prueba">Prueba gratis</option>
          <option value="none">Sin plan</option>
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          aria-label="Ordenar"
        >
          <option value="soldCents">Más ventas primero</option>
          <option value="deliveredOrders">Más pedidos primero</option>
          <option value="name">Por nombre</option>
        </select>
      </div>
      {stores.isLoading && <p role="status">Cargando tiendas…</p>}
      {stores.data && rows.length === 0 && (
        <p className="czd-empty">Ninguna tienda coincide con la búsqueda.</p>
      )}
      <div className="czd-table-wrap">
        <table className="czd-table czd-table--click">
          <thead>
            <tr>
              <th>Tienda</th>
              <th>Vendedor y contacto</th>
              <th>Plan</th>
              <th>Estado</th>
              <th className="num">Pedidos</th>
              <th className="num">Vendido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} onClick={() => setSelected(s.id)}>
                <td>
                  <button
                    type="button"
                    className="czd-store-cell"
                    onClick={e => {
                      e.stopPropagation();
                      setSelected(s.id);
                    }}
                  >
                    <StoreLogo name={s.name} logoUrl={s.logoUrl} size={36} />
                    <span>
                      <strong>{s.name}</strong>
                      <StoreStars slug={s.slug} size={13} />
                      <small>
                        {s.kind === "servicios" ? "Servicios" : "Comercio"} ·{" "}
                        {s.province}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <span className="czd-contact">
                    <strong>{s.sellerName || "—"}</strong>
                    {s.phone && (
                      <a
                        href={`tel:${s.phone}`}
                        onClick={e => e.stopPropagation()}
                      >
                        {s.phone}
                      </a>
                    )}
                    {s.email && (
                      <a
                        href={`mailto:${s.email}`}
                        onClick={e => e.stopPropagation()}
                      >
                        {s.email}
                      </a>
                    )}
                  </span>
                </td>
                <td>
                  <span className={`czd-plan czd-plan--${s.planId ?? "none"}`}>
                    {subscriptionPlanName(s.planId)}
                  </span>
                </td>
                <td>{storeStatusLabels[s.status] ?? s.status}</td>
                <td className="num">
                  {int(s.deliveredOrders)}
                  {s.openOrders ? (
                    <small> +{s.openOrders} en curso</small>
                  ) : null}
                </td>
                <td className="num">
                  <b>{money(s.soldCents)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet
        open={selected !== null}
        onOpenChange={open => !open && setSelected(null)}
      >
        <SheetContent side="right" className="czd-sheet">
          {selected !== null && <StoreDetail id={selected} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function StoreDetail({ id }: { id: number }) {
  const q = trpc.adminDashboard.store.useQuery({ id });
  if (q.isLoading)
    return (
      <SheetHeader>
        <SheetTitle>Cargando tienda…</SheetTitle>
        <SheetDescription>Buscando ventas, envíos y pagos.</SheetDescription>
      </SheetHeader>
    );
  if (q.error || !q.data)
    return (
      <SheetHeader>
        <SheetTitle>No se pudo abrir la tienda</SheetTitle>
        <SheetDescription>
          {q.error?.message ?? "Intenta de nuevo."}
        </SheetDescription>
      </SheetHeader>
    );
  const d = q.data;
  const wa = waLink(d.phone);
  const offered = [
    d.shipping.shippingFeeCents !== null ||
    Object.keys(d.shipping.feesByProvince).length > 0
      ? `Envío a provincias${d.shipping.shippingFeeCents !== null ? ` desde ${money(d.shipping.shippingFeeCents)}` : ""}`
      : null,
    d.shipping.homeFeeCents !== null
      ? `Entrega a domicilio · ${money(d.shipping.homeFeeCents)}`
      : null,
    "Retiro en tienda",
  ].filter(Boolean) as string[];
  const receives = [
    d.payments.yappyPhone ? `Yappy ${d.payments.yappyPhone}` : null,
    d.payments.yappyDirectory
      ? `Yappy Comercial «${d.payments.yappyDirectory}»`
      : null,
    d.payments.cardPaymentUrl ? "Link de pago con tarjeta" : null,
    d.payments.cardOnDelivery ? "Tarjeta (datáfono) al entregar" : null,
  ].filter(Boolean) as string[];
  const usedTotal = d.shipping.used.reduce((a, u) => a + u.orders, 0);
  const monthly = d.monthly.map(m => ({ ...m, label: shortMonth(m.month) }));

  return (
    <div className="czd-detail">
      <SheetHeader className="czd-detail-head">
        <StoreLogo name={d.name} logoUrl={d.logoUrl} size={64} />
        <div>
          <SheetTitle>{d.name}</SheetTitle>
          <SheetDescription>
            {d.sellerName || "Vendedor sin nombre"} · {d.city}, {d.province}
          </SheetDescription>
          <div className="czd-detail-links">
            <Link href={`/tiendas/${d.slug}`}>Ver tienda</Link>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            )}
            {d.email && <a href={`mailto:${d.email}`}>{d.email}</a>}
          </div>
        </div>
      </SheetHeader>

      <StarsEditor storeId={d.id} slug={d.slug} />

      <div className="czd-tiles czd-tiles--3">
        <Tile label="Vendido (12 meses)" value={money(d.last12.soldCents)} />
        <Tile
          label="Pedidos entregados"
          value={int(d.last12.deliveredOrders)}
        />
        <Tile
          label="Comisión generada"
          value={money(d.last12.commissionCents)}
        />
      </div>

      <section>
        <h3>Ventas por mes</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={monthly}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#e6e9dc" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "#cfd4c0" }}
              tick={{ fill: "#5e6650", fontSize: 11 }}
            />
            <YAxis
              width={54}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => moneyShort(Number(v))}
              tick={{ fill: "#5e6650", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(91,122,30,.07)" }}
              formatter={(v: number, _n, item) => [
                `${money(v)} · ${item.payload.orders} pedidos`,
                "Vendido",
              ]}
              labelStyle={{ fontWeight: 700 }}
            />
            <Bar
              dataKey="soldCents"
              fill={SERIES.suscripciones}
              maxBarSize={20}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3>Cómo envía</h3>
        <ul className="czd-chips">
          {offered.map(o => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        {d.shipping.provinces.length > 0 && (
          <p className="czd-muted">
            Llega a: {d.shipping.provinces.join(", ")}
          </p>
        )}
        {usedTotal > 0 ? (
          <ul className="czd-rank">
            {d.shipping.used.map(u => (
              <li key={u.mode}>
                <div>
                  <strong>{deliveryLabels[u.mode] ?? u.mode}</strong>
                  <span>{int(u.orders)} pedidos</span>
                </div>
                <div className="czd-rank-bar">
                  <span
                    style={{
                      width: `${(u.orders / usedTotal) * 100}%`,
                      background: SERIES.suscripciones,
                    }}
                  />
                </div>
                <b>{Math.round((u.orders / usedTotal) * 100)} %</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="czd-muted">
            Todavía no tiene pedidos para saber qué usan sus clientes.
          </p>
        )}
      </section>

      <section>
        <h3>Cómo cobra</h3>
        {receives.length ? (
          <ul className="czd-chips">
            {receives.map(r => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="czd-muted">No ha configurado cómo recibir pagos.</p>
        )}
        {d.payments.used.length > 0 && (
          <p className="czd-muted">
            Sus compradores pagaron con:{" "}
            {d.payments.used
              .map(p => `${paymentLabels[p.method] ?? p.method} (${p.orders})`)
              .join(", ")}
          </p>
        )}
      </section>

      {d.topProducts.length > 0 && (
        <section>
          <h3>Lo que más vende</h3>
          <ol className="czd-top">
            {d.topProducts.map(t => (
              <li key={t.title}>
                <span>{t.title}</span>
                <small>{int(t.quantity)} uds.</small>
                <b>{money(t.revenueCents)}</b>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <h3>Su plan con CuadraZone</h3>
        <p className="czd-muted">
          {subscriptionPlanName(d.planId)} ·{" "}
          {storeStatusLabels[d.status] ?? d.status}
          {d.subscriptionEndsAt
            ? ` · pagado hasta el ${dateLabel(d.subscriptionEndsAt)}`
            : d.trialEndsAt
              ? ` · prueba hasta el ${dateLabel(d.trialEndsAt)}`
              : ""}{" "}
          · {int(d.products)} publicaciones
        </p>
        {(d.subscriptionPayments.length > 0 ||
          d.commissionPayments.length > 0) && (
          <ul className="czd-feed czd-feed--compact">
            {d.subscriptionPayments.map((p, i) => (
              <li key={`s${i}`}>
                <div>
                  <strong>Mensualidad {subscriptionPlanName(p.planId)}</strong>
                  <span>
                    {p.months} {p.months === 1 ? "mes" : "meses"} · {p.paidOn}
                  </span>
                </div>
                <b>{money(p.amountCents)}</b>
              </li>
            ))}
            {d.commissionPayments.map((p, i) => (
              <li key={`c${i}`}>
                <div>
                  <strong>Comisión</strong>
                  <span>{p.paidOn}</span>
                </div>
                <b>{money(p.amountCents)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Cada estrella con su logro: si la tienda ya lo cumple, o si el administrador se la otorga a mano. */
function StarsEditor({ storeId, slug }: { storeId: number; slug: string }) {
  const utils = trpc.useUtils();
  const q = trpc.stars.adminForStore.useQuery({ storeId });
  const set = trpc.stars.set.useMutation();

  async function toggle(star: VerificationStar, awarded: boolean) {
    try {
      await set.mutateAsync({ storeId, star, awarded });
      await Promise.all([
        utils.stars.adminForStore.invalidate({ storeId }),
        utils.stars.forStores.invalidate({ slugs: [slug] }),
      ]);
      toast.success(awarded ? "Estrella otorgada" : "Estrella quitada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ocurrió un error");
    }
  }

  const d = q.data;
  return (
    <section className="czd-stars">
      <h3>Estrellas de verificación</h3>
      <p className="czd-muted">
        Se ganan solas al cumplir cada logro. También puedes otorgar una a mano.
        {d && !d.active ? " Con el plan vencido la tienda no muestra ninguna." : ""}
      </p>
      <ul>
        {verificationStars.map(star => {
          const info = verificationStarInfo[star];
          const earned = d?.earned.includes(star) ?? false;
          const manual = d?.manual.includes(star) ?? false;
          return (
            <li key={star} className={earned || manual ? "is-on" : ""}>
              <VerificationStars size={22} stars={[star]} />
              <div>
                <strong>{info.achievement}</strong>
                <small>{info.rule}</small>
                <small className="czd-stars-state">
                  {earned ? "Ganada por logro" : manual ? "Otorgada a mano" : "Todavía no la cumple"}
                </small>
              </div>
              {!earned && (
                <button
                  type="button"
                  className={manual ? "czd-danger" : "czd-primary czd-primary--sm"}
                  disabled={set.isPending || q.isLoading}
                  onClick={() => void toggle(star, !manual)}
                >
                  {manual ? "Quitar" : "Otorgar"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
