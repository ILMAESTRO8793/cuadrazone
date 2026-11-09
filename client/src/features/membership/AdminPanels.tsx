import { useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  BarChart3,
  EyeOff,
  Gavel,
  Search,
  ShieldBan,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  claimReasonLabels,
  claimResolutionLabels,
  claimStatusLabels,
  type ClaimResolution,
} from "@shared/claims";
import { subscriptionPlanName } from "@shared/pricing";
import { monthLabel } from "@shared/sellerDashboard";
import { trpc } from "@/lib/trpc";
import "../catalog/sellerDashboard.css";
import "./adminPanels.css";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";
const money = (cents: number) =>
  `US$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-PA", {
        timeZone: "America/Panama",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(iso))
    : "";

// ───────────── Reclamos ─────────────

export function AdminClaims({ enabled }: { enabled: boolean }) {
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const list = trpc.adminPanel.claims.useQuery({ filter }, { enabled });
  const resolve = trpc.adminPanel.resolveClaim.useMutation();
  const [draft, setDraft] = useState<
    Record<
      number,
      { resolution: Exclude<ClaimResolution, "withdrawn">; note: string }
    >
  >({});

  async function decide(claimId: number) {
    const d = draft[claimId];
    if (!d) return;
    try {
      await resolve.mutateAsync({
        claimId,
        resolution: d.resolution,
        note: d.note,
      });
      toast.success("Decisión registrada y enviada a las dos partes");
      void list.refetch();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <section className="ap2-section">
      <div className="ap2-head">
        <h2>
          <Gavel size={20} /> Reclamos
        </h2>
        <label>
          Mostrar
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
          >
            <option value="pending">Pendientes</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </div>
      <p className="re-muted re-small">
        El vendedor tiene 48 horas para responder. Puedes decidir cuando
        responde o cuando se le vence el plazo. El pago fue directo al vendedor:
        si decides a favor del comprador, el vendedor debe reembolsar; si no
        cumple, suspéndelo en Moderación.
      </p>
      {list.isLoading && <p role="status">Cargando reclamos…</p>}
      {list.error && <p className="member-error">{list.error.message}</p>}
      {list.data?.length === 0 && (
        <p className="ap2-empty">
          No hay reclamos {filter === "pending" ? "pendientes" : ""}.
        </p>
      )}
      <div className="ap2-cards">
        {list.data?.map(c => {
          const d = draft[c.id] ?? {
            resolution: "buyer_favor" as const,
            note: "",
          };
          return (
            <article
              key={c.id}
              className={`ap2-card ${c.overdue ? "is-overdue" : ""}`}
            >
              <header>
                <strong>
                  Pedido{" "}
                  <Link href={`/pedidos/${c.orderId}`}>{c.order.number}</Link> ·{" "}
                  {c.order.storeName}
                </strong>
                <span>
                  {money(c.order.totalCents)} · abierto {when(c.createdAt)}
                </span>
              </header>
              <p className="ap2-tag">
                {claimReasonLabels[c.reason]} ·{" "}
                {c.status === "resolved" && c.resolution
                  ? claimResolutionLabels[c.resolution]
                  : c.overdue
                    ? "Plazo vencido sin respuesta"
                    : claimStatusLabels[c.status]}
              </p>
              <blockquote>
                <span>Comprador</span>
                {c.description}
              </blockquote>
              {c.sellerResponse ? (
                <blockquote>
                  <span>Vendedor · {when(c.sellerRespondedAt)}</span>
                  {c.sellerResponse}
                </blockquote>
              ) : (
                c.status === "open" && (
                  <p className="re-muted re-small">
                    El vendedor puede responder hasta {when(c.respondBy)}.
                  </p>
                )
              )}
              {c.resolutionNote && (
                <blockquote>
                  <span>Decisión</span>
                  {c.resolutionNote}
                </blockquote>
              )}
              {c.canResolve && (
                <form
                  className="ap2-form"
                  onSubmit={e => {
                    e.preventDefault();
                    void decide(c.id);
                  }}
                >
                  <label>
                    Decisión
                    <select
                      value={d.resolution}
                      onChange={e =>
                        setDraft(x => ({
                          ...x,
                          [c.id]: {
                            ...d,
                            resolution: e.target.value as typeof d.resolution,
                          },
                        }))
                      }
                    >
                      <option value="buyer_favor">A favor del comprador</option>
                      <option value="seller_favor">A favor del vendedor</option>
                      <option value="agreement">
                        Acuerdo entre las partes
                      </option>
                    </select>
                  </label>
                  <label>
                    Nota para las dos partes
                    <textarea
                      value={d.note}
                      onChange={e =>
                        setDraft(x => ({
                          ...x,
                          [c.id]: { ...d, note: e.target.value },
                        }))
                      }
                      minLength={5}
                      required
                      placeholder="Qué se decidió y qué debe hacer cada parte."
                    />
                  </label>
                  <button
                    className="btn btn-gold"
                    type="submit"
                    disabled={resolve.isPending}
                  >
                    Registrar decisión
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ───────────── Moderación ─────────────

type Kind = "product" | "service" | "event";
const kindLabels: Record<Kind, string> = {
  product: "Productos",
  service: "Servicios",
  event: "Eventos",
};

function ContentModeration({ enabled }: { enabled: boolean }) {
  const [kind, setKind] = useState<Kind>("product");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const list = trpc.adminPanel.content.useQuery({ kind, q: term }, { enabled });
  const moderate = trpc.adminPanel.moderateContent.useMutation();
  async function act(id: number, hide: boolean) {
    const reason = hide
      ? window.prompt("Motivo (se le envía al vendedor):", "")
      : "";
    if (hide && reason === null) return;
    try {
      await moderate.mutateAsync({ kind, id, hide, reason: reason ?? "" });
      toast.success(
        hide
          ? "Publicación oculta; avisamos al vendedor"
          : "El vendedor ya puede volver a publicarla"
      );
      void list.refetch();
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  return (
    <section className="ap2-section">
      <h3>
        <EyeOff size={18} /> Publicaciones
      </h3>
      <form
        className="ap2-search"
        onSubmit={e => {
          e.preventDefault();
          setTerm(q);
        }}
      >
        <select value={kind} onChange={e => setKind(e.target.value as Kind)}>
          {(Object.keys(kindLabels) as Kind[]).map(k => (
            <option key={k} value={k}>
              {kindLabels[k]}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Título o tienda"
        />
        <button className="btn btn-outline" type="submit">
          <Search size={15} /> Buscar
        </button>
      </form>
      {list.error && <p className="member-error">{list.error.message}</p>}
      <ul className="ap2-rows">
        {list.data?.map(r => (
          <li key={r.id} className={r.moderatedAt ? "is-hidden" : ""}>
            <div>
              <a href={r.path} target="_blank" rel="noopener noreferrer">
                {r.title}
              </a>
              <span className="re-muted re-small">
                {r.storeName} · {r.status}
                {r.moderatedAt ? ` · Oculta: ${r.moderationReason ?? ""}` : ""}
              </span>
            </div>
            <button
              className="btn btn-outline"
              disabled={moderate.isPending}
              onClick={() => void act(r.id, !r.moderatedAt)}
            >
              {r.moderatedAt ? "Permitir de nuevo" : "Ocultar"}
            </button>
          </li>
        ))}
        {list.data?.length === 0 && (
          <li className="re-muted">Sin resultados.</li>
        )}
      </ul>
    </section>
  );
}

function ReviewModeration({ enabled }: { enabled: boolean }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const list = trpc.adminPanel.reviews.useQuery({ q: term }, { enabled });
  const moderate = trpc.adminPanel.moderateReview.useMutation();
  async function act(id: number, hide: boolean) {
    const reason = hide
      ? window.prompt("Motivo para ocultar la reseña:", "")
      : "";
    if (hide && reason === null) return;
    try {
      await moderate.mutateAsync({ id, hide, reason: reason ?? "" });
      toast.success(
        hide
          ? "Reseña oculta: ya no se muestra ni cuenta en el promedio"
          : "Reseña visible de nuevo"
      );
      void list.refetch();
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  return (
    <section className="ap2-section">
      <h3>
        <Star size={18} /> Reseñas
      </h3>
      <form
        className="ap2-search"
        onSubmit={e => {
          e.preventDefault();
          setTerm(q);
        }}
      >
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Texto, producto o tienda"
        />
        <button className="btn btn-outline" type="submit">
          <Search size={15} /> Buscar
        </button>
      </form>
      <ul className="ap2-rows">
        {list.data?.map(r => (
          <li key={r.id} className={r.hiddenAt ? "is-hidden" : ""}>
            <div>
              <span>
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)} «{r.body}»
              </span>
              <span className="re-muted re-small">
                <a
                  href={`/articulo/${r.productSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {r.productTitle}
                </a>{" "}
                · {r.storeName}
                {r.hiddenAt ? ` · Oculta: ${r.hiddenReason ?? ""}` : ""}
              </span>
            </div>
            <button
              className="btn btn-outline"
              disabled={moderate.isPending}
              onClick={() => void act(r.id, !r.hiddenAt)}
            >
              {r.hiddenAt ? "Mostrar" : "Ocultar"}
            </button>
          </li>
        ))}
        {list.data?.length === 0 && <li className="re-muted">Sin reseñas.</li>}
      </ul>
    </section>
  );
}

function SellerSuspension({ enabled }: { enabled: boolean }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const list = trpc.adminPanel.sellers.useQuery({ q: term }, { enabled });
  const suspend = trpc.adminPanel.suspend.useMutation();
  const unsuspend = trpc.adminPanel.unsuspend.useMutation();
  async function act(applicationId: number, suspended: boolean, name: string) {
    try {
      if (!suspended) {
        const reason = window.prompt(
          `Motivo para suspender «${name}» (se le envía por correo):`,
          ""
        );
        if (reason === null) return;
        await suspend.mutateAsync({ applicationId, reason });
        toast.success("Tienda suspendida y oculta");
      } else {
        if (!window.confirm(`¿Levantar la suspensión de «${name}»?`)) return;
        const result = await unsuspend.mutateAsync({ applicationId, note: "" });
        toast.success(
          result.status === "active"
            ? "Suspensión levantada: la tienda vuelve a mostrarse"
            : "Suspensión levantada; la tienda se mostrará cuando pague"
        );
      }
      void list.refetch();
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  return (
    <section className="ap2-section">
      <h3>
        <ShieldBan size={18} /> Suspender vendedores
      </h3>
      <p className="re-muted re-small">
        La suspensión oculta toda la tienda. A diferencia de «Desactivar» en
        Suscripciones, un pago no la reactiva: solo un administrador la levanta.
      </p>
      <form
        className="ap2-search"
        onSubmit={e => {
          e.preventDefault();
          setTerm(q);
        }}
      >
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Tienda, correo o celular"
        />
        <button className="btn btn-outline" type="submit">
          <Search size={15} /> Buscar
        </button>
      </form>
      <ul className="ap2-rows">
        {list.data?.map(s => (
          <li key={s.applicationId} className={s.suspended ? "is-hidden" : ""}>
            <div>
              {s.storeSlug ? (
                <a
                  href={`/tiendas/${s.storeSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.storeName}
                </a>
              ) : (
                <span>{s.storeName ?? "Sin tienda"}</span>
              )}
              <span className="re-muted re-small">
                {s.email} · {subscriptionPlanName(s.planId)} ·{" "}
                {s.suspended
                  ? "Suspendido"
                  : s.subscriptionStatus === "active"
                    ? "Activa"
                    : "Oculta"}
              </span>
            </div>
            <button
              className="btn btn-outline"
              disabled={suspend.isPending || unsuspend.isPending}
              onClick={() =>
                void act(s.applicationId, s.suspended, s.storeName ?? s.email)
              }
            >
              {s.suspended ? "Levantar suspensión" : "Suspender"}
            </button>
          </li>
        ))}
        {list.data?.length === 0 && (
          <li className="re-muted">Sin resultados.</li>
        )}
      </ul>
    </section>
  );
}

export function AdminModeration({ enabled }: { enabled: boolean }) {
  return (
    <div className="ap2-grid">
      <ContentModeration enabled={enabled} />
      <ReviewModeration enabled={enabled} />
      <SellerSuspension enabled={enabled} />
    </div>
  );
}

// ───────────── Reportes ─────────────

export function AdminReports({ enabled }: { enabled: boolean }) {
  const r = trpc.adminPanel.reports.useQuery(undefined, { enabled });
  if (r.isLoading) return <p role="status">Calculando reportes…</p>;
  if (r.error) return <p className="member-error">{r.error.message}</p>;
  const d = r.data!;
  const peak = Math.max(
    1,
    ...d.revenue.map(m => m.subscriptionsCents + m.commissionsCents)
  );
  const current = d.revenue[d.revenue.length - 1]!;
  return (
    <div className="ap2-reports">
      <section className="ap2-section">
        <h2>
          <Users size={20} /> Usuarios y vendedores
        </h2>
        <div className="ap2-kpis">
          <div>
            <span>Usuarios</span>
            <strong>{d.users.total}</strong>
          </div>
          <div>
            <span>Activos (30 días)</span>
            <strong>{d.users.active30}</strong>
          </div>
          <div>
            <span>Nuevos (30 días)</span>
            <strong>{d.users.new30}</strong>
          </div>
          <div>
            <span>Solicitudes por revisar</span>
            <strong>{d.sellers.pendingApplications}</strong>
          </div>
        </div>
        <div className="ap2-kpis ap2-kpis--small">
          <div>
            <span>En prueba gratis</span>
            <strong>{d.sellers.trial}</strong>
          </div>
          <div>
            <span>Plan Normal</span>
            <strong>{d.sellers.normal}</strong>
          </div>
          <div>
            <span>Mayor Visibilidad</span>
            <strong>{d.sellers.mayorVisibilidad}</strong>
          </div>
          <div>
            <span>Ocultas por falta de pago</span>
            <strong>{d.sellers.hiddenUnpaid}</strong>
          </div>
          <div>
            <span>Ocultas por comisión</span>
            <strong>{d.sellers.hiddenCommission}</strong>
          </div>
          <div>
            <span>Suspendidas</span>
            <strong>{d.sellers.suspended}</strong>
          </div>
          <div>
            <span>Desactivadas</span>
            <strong>{d.sellers.cancelled}</strong>
          </div>
        </div>
      </section>

      <section className="ap2-section">
        <h2>
          <BarChart3 size={20} /> Ingresos de CuadraZone
        </h2>
        <p className="re-muted re-small">
          Pagos registrados por fecha de pago: mensualidades y comisiones. Este
          mes: {money(current.subscriptionsCents + current.commissionsCents)}.
        </p>
        <div
          className="sd-bars ap2-bars"
          role="img"
          aria-label="Ingresos de los últimos 6 meses"
        >
          {d.revenue.map(m => {
            const total = m.subscriptionsCents + m.commissionsCents;
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
              <th>Mensualidades</th>
              <th>Comisiones</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {[...d.revenue].reverse().map(m => (
              <tr key={m.month}>
                <td>{monthLabel(m.month)}</td>
                <td>{money(m.subscriptionsCents)}</td>
                <td>{money(m.commissionsCents)}</td>
                <td>
                  <strong>
                    {money(m.subscriptionsCents + m.commissionsCents)}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ap2-section">
        <h2>Ventas en la plataforma (últimos 90 días)</h2>
        <div className="ap2-kpis">
          <div>
            <span>Pedidos entregados</span>
            <strong>{d.sales90.orders}</strong>
            <em>{money(d.sales90.productsCents)}</em>
          </div>
          <div>
            <span>Boletos vendidos</span>
            <strong>{d.sales90.tickets}</strong>
            <em>{money(d.sales90.ticketsCents)}</em>
          </div>
          <div>
            <span>Citas atendidas</span>
            <strong>{d.sales90.appointmentsCompleted}</strong>
            <em>de {d.sales90.appointmentsTotal} reservadas</em>
          </div>
        </div>
        <h3>Ventas por categoría</h3>
        {d.categories.length === 0 ? (
          <p className="re-muted">
            Todavía no hay ventas entregadas en este período.
          </p>
        ) : (
          <table className="sd-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Unidades</th>
                <th>Ventas</th>
              </tr>
            </thead>
            <tbody>
              {d.categories.map(c => (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td>{c.quantity}</td>
                  <td>{money(c.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="ap2-section">
        <h2>
          <AlertTriangle size={20} /> Reclamos
        </h2>
        <div className="ap2-kpis ap2-kpis--small">
          <div>
            <span>Esperando al vendedor</span>
            <strong>{d.claims.open}</strong>
          </div>
          <div>
            <span>Plazo vencido</span>
            <strong>{d.claims.overdue}</strong>
          </div>
          <div>
            <span>Por decidir</span>
            <strong>{d.claims.toDecide}</strong>
          </div>
          <div>
            <span>Resueltos (90 días)</span>
            <strong>{d.claims.resolved90}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
