import { Link } from "wouter";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  ExternalLink,
  HelpCircle,
  Package,
  PackageCheck,
  Star,
  Ticket,
  TrendingDown,
  TrendingUp,
  Truck,
  Gavel,
} from "lucide-react";
import type { ReactNode } from "react";
import { commissionPercentLabel, subscriptionPlanName } from "@shared/pricing";
import {
  LOW_STOCK_THRESHOLD,
  TOP_PRODUCTS_DAYS,
  monthLabel,
} from "@shared/sellerDashboard";
import { dayLabel, panamaDayKey, timeLabel } from "@shared/appointments";
import { CLAIM_RESPONSE_HOURS, claimReasonLabels } from "@shared/claims";
import { trpc } from "@/lib/trpc";
import "./sellerDashboard.css";

const money = (cents: number) =>
  `US$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-PA", {
        timeZone: "America/Panama",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(iso))
    : "";

function TodoCard({
  icon,
  count,
  label,
  href,
  tone = "",
}: {
  icon: ReactNode;
  count: number;
  label: string;
  href: string;
  tone?: string;
}) {
  return (
    <Link href={href} className={`sd-todo ${count > 0 ? `is-on ${tone}` : ""}`}>
      <span className="sd-todo-icon">{icon}</span>
      <strong>{count}</strong>
      <span>{label}</span>
    </Link>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="sd-stars" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={14}
          className={n <= Math.round(value) ? "is-on" : ""}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function SellerDashboardPage() {
  const data = trpc.seller.dashboard.useQuery(undefined, {
    refetchInterval: 120_000,
  });
  if (data.isLoading)
    return (
      <div className="re-page container">
        <p role="status">Cargando el resumen de tu tienda…</p>
      </div>
    );
  if (data.error)
    return (
      <div className="re-page container">
        <p className="member-error">{data.error.message}</p>
      </div>
    );
  const d = data.data;
  if (!d || !d.hasStore)
    return (
      <div className="re-page container sd-empty">
        <h1>Todavía no tienes tienda</h1>
        <p>
          Guarda la información de tu tienda para ver aquí tus pedidos, ventas y
          reseñas.
        </p>
        <Link className="btn btn-gold" href="/vendedor/tienda">
          Crear mi tienda
        </Link>
      </div>
    );

  const services = d.store.kind === "servicios";
  const current = d.sales[d.sales.length - 1]!;
  const currentTotal = current.productsCents + current.ticketsCents;
  const peak = Math.max(
    1,
    ...d.sales.map(m => m.productsCents + m.ticketsCents)
  );
  const change = d.salesChangePercent;
  const trialDaysLeft =
    d.plan.inTrial && d.plan.trialEndsAt
      ? Math.ceil(
          (new Date(d.plan.trialEndsAt).getTime() - Date.now()) / 86_400_000
        )
      : null;
  const hidden = d.plan.subscriptionStatus !== "active";

  return (
    <div className="re-page container sd-page">
      <header className="sd-head">
        <div>
          <p className="eyebrow">PANEL DE VENDEDOR · RESUMEN</p>
          <h1>{d.store.name}</h1>
        </div>
        <span className="sd-head-actions">
          <Link className="btn btn-outline" href={`/tiendas/${d.store.slug}`}>
            <ExternalLink size={15} /> Ver mi tienda
          </Link>
          <Link className="btn btn-gold" href="/vendedor/productos">
            {services ? "Mis servicios" : "Mis publicaciones"}
          </Link>
        </span>
      </header>

      {(hidden ||
        d.plan.commissionDueCents > 0 ||
        (trialDaysLeft !== null && trialDaysLeft <= 15)) && (
        <div className={`sd-alert ${hidden ? "is-bad" : ""}`} role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            {hidden
              ? d.plan.holdReason === "commission"
                ? "Tu tienda está oculta por comisión sin pagar. Págala para que vuelva a mostrarse."
                : "Tu tienda está oculta: tu plan no está activo. Paga tu mensualidad para volver a mostrarla."
              : d.plan.commissionDueCents > 0
                ? `Tienes ${money(d.plan.commissionDueCents)} de comisión de meses cerrados por pagar.`
                : `Tu prueba gratis termina en ${trialDaysLeft} ${trialDaysLeft === 1 ? "día" : "días"} (${shortDate(d.plan.trialEndsAt)}).`}
          </span>
          <Link href="/vendedor">Cómo pagar</Link>
        </div>
      )}

      <section aria-labelledby="sd-todo-title">
        <h2 id="sd-todo-title" className="sd-title">
          Por atender
        </h2>
        <div className="sd-todo-grid">
          {!services && (
            <TodoCard
              icon={<Package size={18} />}
              count={d.todo.pendingOrders}
              label="Pedidos por confirmar"
              href="/vendedor/pedidos"
              tone="is-hot"
            />
          )}
          {!services && (
            <TodoCard
              icon={<Truck size={18} />}
              count={d.todo.toShip}
              label="Confirmados por enviar"
              href="/vendedor/pedidos"
            />
          )}
          {services && (
            <TodoCard
              icon={<CalendarCheck size={18} />}
              count={d.todo.appointmentsWeek}
              label="Citas en los próximos 7 días"
              href="/vendedor/agenda"
            />
          )}
          <TodoCard
            icon={<Ticket size={18} />}
            count={d.todo.reservedTickets}
            label="Boletos apartados por cobrar"
            href="/vendedor/eventos"
            tone="is-hot"
          />
          {!services && (
            <TodoCard
              icon={<HelpCircle size={18} />}
              count={d.todo.unansweredQuestions}
              label="Preguntas sin responder"
              href="#sd-questions"
            />
          )}
          {!services && (
            <TodoCard
              icon={<PackageCheck size={18} />}
              count={d.todo.lowStock}
              label={`Con ${LOW_STOCK_THRESHOLD} o menos en inventario`}
              href="#sd-stock"
            />
          )}
          <TodoCard
            icon={<Gavel size={18} />}
            count={d.todo.openClaims}
            label="Reclamos por responder"
            href="#sd-claims"
            tone="is-hot"
          />
          <TodoCard
            icon={<Bell size={18} />}
            count={d.todo.unreadNotifications}
            label="Notificaciones nuevas"
            href="/notificaciones"
          />
        </div>
      </section>

      {d.claims.length > 0 && (
        <section className="sd-card sd-claims" id="sd-claims">
          <h2 className="sd-title">
            <Gavel size={18} /> Reclamos por responder
          </h2>
          <p className="re-muted re-small">
            Tienes {CLAIM_RESPONSE_HOURS} horas desde que se abre cada reclamo. Si no respondes, CuadraZone decide con lo que tenga.
          </p>
          <ul className="sd-list">
            {d.claims.map(c => (
              <li key={c.id}>
                <Link href={`/pedidos/${c.orderId}`}>Pedido {c.orderNumber}</Link> · {claimReasonLabels[c.reason]} ·{" "}
                <strong className={c.overdue ? "sd-overdue" : ""}>
                  {c.overdue ? "Plazo vencido" : `Responde antes del ${dayLabel(panamaDayKey(new Date(c.respondBy)))}, ${timeLabel(c.respondBy)}`}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.appointmentsToday.length > 0 && (
        <section className="sd-card">
          <h2 className="sd-title">
            <CalendarDays size={18} /> Hoy, {dayLabel(panamaDayKey(new Date()))}
          </h2>
          <ul className="sd-list">
            {d.appointmentsToday.map(a => (
              <li key={a.id}>
                <strong>{timeLabel(a.startsAt)}</strong> {a.serviceTitle} ·{" "}
                {a.clientName}
              </li>
            ))}
          </ul>
          <Link href="/vendedor/agenda">Ver mi agenda →</Link>
        </section>
      )}

      <div className="sd-columns">
        <section className="sd-card sd-sales" aria-labelledby="sd-sales-title">
          <h2 id="sd-sales-title" className="sd-title">
            <BarChart3 size={18} /> Ventas
          </h2>
          <div className="sd-kpis">
            <div>
              <span>Este mes</span>
              <strong>{money(currentTotal)}</strong>
              {change !== null && (
                <em className={change >= 0 ? "is-up" : "is-down"}>
                  {change >= 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}{" "}
                  {change >= 0 ? "+" : ""}
                  {change}% vs. mes anterior
                </em>
              )}
            </div>
            <div>
              <span>
                {services ? "Boletos vendidos" : "Pedidos entregados"}
              </span>
              <strong>{services ? current.tickets : current.orders}</strong>
            </div>
            <div>
              <span>Comisión del mes</span>
              <strong>{money(current.commissionCents)}</strong>
            </div>
          </div>
          <div
            className="sd-bars"
            role="img"
            aria-label="Ventas de los últimos 6 meses"
          >
            {d.sales.map(m => {
              const total = m.productsCents + m.ticketsCents;
              return (
                <div key={m.month} className="sd-bar">
                  <span className="sd-bar-value">
                    {total ? money(total).replace(".00", "") : ""}
                  </span>
                  <span className="sd-bar-track">
                    <span
                      className="sd-bar-fill"
                      style={{
                        height: `${Math.max(total ? 4 : 0, (total / peak) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="sd-bar-label">{monthLabel(m.month)}</span>
                </div>
              );
            })}
          </div>
          <table className="sd-table">
            <thead>
              <tr>
                <th>Mes</th>
                {!services && <th>Productos</th>}
                <th>Boletos</th>
                <th>Comisión</th>
              </tr>
            </thead>
            <tbody>
              {[...d.sales].reverse().map(m => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  {!services && (
                    <td>
                      {money(m.productsCents)} <small>({m.orders})</small>
                    </td>
                  )}
                  <td>
                    {money(m.ticketsCents)} <small>({m.tickets})</small>
                  </td>
                  <td>{money(m.commissionCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="re-muted re-small">
            Productos: pedidos entregados, sin el envío. Boletos: reservas
            pagadas.{" "}
            {services ? "Los servicios y citas no pagan comisión." : ""} Pedidos
            en total: {d.totals.orders} ({d.totals.delivered} entregados,{" "}
            {d.totals.cancelled} cancelados).
          </p>
        </section>

        <aside className="sd-side">
          <section className="sd-card">
            <h2 className="sd-title">Plan y comisión</h2>
            <dl className="sd-dl">
              <div>
                <dt>Plan</dt>
                <dd>{subscriptionPlanName(d.plan.planId)}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{hidden ? "Tienda oculta" : "Activa"}</dd>
              </div>
              {d.plan.endsAt && (
                <div>
                  <dt>{d.plan.inTrial ? "Prueba hasta" : "Pagado hasta"}</dt>
                  <dd>{shortDate(d.plan.endsAt)}</dd>
                </div>
              )}
              <div>
                <dt>Comisión actual</dt>
                <dd>{commissionPercentLabel(d.plan.inTrial ? 800 : 500)}</dd>
              </div>
              <div>
                <dt>Comisión por pagar</dt>
                <dd>{money(d.plan.commissionDueCents)}</dd>
              </div>
              <div>
                <dt>Acumulada este mes</dt>
                <dd>{money(d.plan.commissionAccruingCents)}</dd>
              </div>
            </dl>
            <Link href="/vendedor/plan">Cambiar o pagar mi plan →</Link>
          </section>

          <section className="sd-card">
            <h2 className="sd-title">
              <Star size={18} /> Reseñas
            </h2>
            {d.reviews.count === 0 ? (
              <p className="re-muted">
                Todavía no tienes reseñas. Llegan cuando un comprador recibe su
                pedido.
              </p>
            ) : (
              <>
                <p className="sd-rating">
                  <strong>{d.reviews.average?.toFixed(1)}</strong>{" "}
                  <Stars value={d.reviews.average ?? 0} />{" "}
                  <span className="re-muted">({d.reviews.count})</span>
                </p>
                <ul className="sd-reviews">
                  {d.reviews.latest.map(r => (
                    <li key={r.id}>
                      <Stars value={r.rating} />
                      <p>«{r.body}»</p>
                      <Link
                        href={`/articulo/${r.productSlug}`}
                        className="re-muted re-small"
                      >
                        {r.productTitle} · {shortDate(r.createdAt)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </aside>
      </div>

      {!services && (
        <div className="sd-columns sd-columns--even">
          <section className="sd-card">
            <h2 className="sd-title">Lo más vendido</h2>
            <p className="re-muted re-small">
              Últimos {TOP_PRODUCTS_DAYS} días, pedidos entregados.
            </p>
            {d.topProducts.length === 0 ? (
              <p className="re-muted">
                Aún no hay ventas entregadas en este período.
              </p>
            ) : (
              <ol className="sd-top">
                {d.topProducts.map(p => (
                  <li key={`${p.productId}-${p.title}`}>
                    {p.slug ? (
                      <Link href={`/articulo/${p.slug}`}>{p.title}</Link>
                    ) : (
                      <span>{p.title}</span>
                    )}
                    <span>
                      {p.quantity} vendidos · {money(p.revenueCents)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="sd-card" id="sd-stock">
            <h2 className="sd-title">Poco inventario</h2>
            {d.lowStock.length === 0 ? (
              <p className="re-muted">
                Todo tu inventario publicado tiene más de {LOW_STOCK_THRESHOLD}{" "}
                unidades.
              </p>
            ) : (
              <ul className="sd-list">
                {d.lowStock.map((v, i) => (
                  <li key={`${v.slug}-${i}`}>
                    <span
                      className={`sd-stock ${v.stock === 0 ? "is-out" : ""}`}
                    >
                      {v.stock === 0 ? "Agotado" : `${v.stock} uds.`}
                    </span>{" "}
                    <Link href={`/articulo/${v.slug}`}>{v.title}</Link>
                    {(v.size || v.color) && (
                      <span className="re-muted">
                        {" "}
                        · {[v.size, v.color].filter(Boolean).join(" / ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/vendedor/productos">Actualizar inventario →</Link>
          </section>

          <section className="sd-card" id="sd-questions">
            <h2 className="sd-title">Preguntas sin responder</h2>
            {d.questions.length === 0 ? (
              <p className="re-muted">No tienes preguntas pendientes.</p>
            ) : (
              <ul className="sd-list">
                {d.questions.map(q => (
                  <li key={q.id}>
                    «{q.body}» —{" "}
                    <Link href={`/articulo/${q.productSlug}`}>
                      {q.productTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
