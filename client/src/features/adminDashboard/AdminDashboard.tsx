import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import {
  Area,
  AreaChart,
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { subscriptionPlanName } from "@shared/pricing";
import { revenueSourceLabels, revenueSources } from "@shared/finance";
import { trpc } from "@/lib/trpc";
import { StoreLogo } from "@/components/marketplace/StoreLogo";
import { StoresPanel } from "./StoresPanel";
import { CustomersPanel } from "./CustomersPanel";
import { ExpensesPanel } from "./ExpensesPanel";
import { FinancePanel } from "./FinancePanel";
import { AdminDispatchers } from "../dispatch/AdminDispatchers";
import "../dispatch/dispatch.css";
import {
  SERIES,
  dayLabel,
  delta,
  int,
  money,
  moneyShort,
  paymentLabels,
  shortMonth,
} from "./format";
import "./dashboard.css";

export type Section = "resumen" | "tiendas" | "clientes" | "despachadores" | "gastos" | "finanzas";
const sections: Array<[Section, string]> = [
  ["resumen", "Resumen"],
  ["tiendas", "Tiendas"],
  ["clientes", "Clientes"],
  ["despachadores", "Despachadores"],
  ["gastos", "Gastos"],
  ["finanzas", "Impuestos y socios"],
];

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export type Overview =
  inferRouterOutputs<AppRouter>["adminDashboard"]["overview"];

export function AdminDashboard({
  enabled,
  initialSection = "resumen",
}: {
  enabled: boolean;
  initialSection?: Section;
}) {
  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Panama",
      year: "numeric",
    }).format(new Date())
  );
  const [year, setYear] = useState(currentYear);
  const [section, setSection] = useState<Section>(initialSection);
  const overview = trpc.adminDashboard.overview.useQuery({ year }, { enabled });
  const years = Array.from(
    { length: currentYear - 2025 + 1 },
    (_, i) => currentYear - i
  );

  return (
    <div className="czd">
      <Hero
        data={overview.data}
        loading={overview.isLoading}
        year={year}
        years={years}
        onYear={setYear}
      />
      <nav className="czd-nav" aria-label="Secciones del dashboard">
        {sections.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={section === id ? "page" : undefined}
            className={section === id ? "is-active" : ""}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {overview.error && (
        <p className="member-error">{overview.error.message}</p>
      )}
      {section === "resumen" && overview.data && (
        <Summary data={overview.data} />
      )}
      {section === "tiendas" && <StoresPanel enabled={enabled} />}
      {section === "clientes" && <CustomersPanel enabled={enabled} />}
      {section === "despachadores" && <AdminDispatchers enabled={enabled} />}
      {section === "gastos" && <ExpensesPanel enabled={enabled} year={year} />}
      {section === "finanzas" && overview.data && (
        <FinancePanel data={overview.data} />
      )}
    </div>
  );
}

// ───────────── Portada: ingresos de hoy, del mes y del año ─────────────

type Lens = "hoy" | "mes" | "anio";

function Hero({
  data,
  loading,
  year,
  years,
  onYear,
}: {
  data: Overview | undefined;
  loading: boolean;
  year: number;
  years: number[];
  onYear: (y: number) => void;
}) {
  const [lens, setLens] = useState<Lens>("mes");
  const series = useMemo(() => {
    if (!data) return [];
    if (lens === "anio")
      return data.monthly.map(m => ({
        key: m.month,
        label: shortMonth(m.month),
        total: m.suscripciones + m.comisiones + m.anuncios,
      }));
    return data.daily.map(d => ({
      key: d.date,
      label: dayLabel(d.date),
      total: d.suscripciones + d.comisiones + d.anuncios,
    }));
  }, [data, lens]);

  const t = data?.totals;
  const lenses: Array<{
    id: Lens;
    label: string;
    value: number;
    note: string;
  }> = t
    ? [
        {
          id: "hoy",
          label: "Hoy",
          value: t.todayCents,
          note: "Pagos registrados hoy",
        },
        {
          id: "mes",
          label: "Este mes",
          value: t.monthCents,
          note: changeNote(delta(t.monthCents, t.prevMonthCents), {
            of: "del mes pasado",
            vs: "al mes pasado",
            same: "el mes pasado",
          }),
        },
        {
          id: "anio",
          label: `Año ${year}`,
          value: t.yearCents,
          note: changeNote(delta(t.yearCents, t.prevYearCents), {
            of: `de ${year - 1}`,
            vs: `a ${year - 1}`,
            same: `en ${year - 1}`,
          }),
        },
      ]
    : [];

  return (
    <header className="czd-hero">
      <div className="czd-hero-top">
        <div>
          <h1>Dashboard CuadraZone</h1>
          <p>Lo que entra, lo que sale y lo que le toca a cada socio.</p>
        </div>
        <label className="czd-year">
          <span>Año</span>
          <select value={year} onChange={e => onYear(Number(e.target.value))}>
            {years.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading && (
        <p className="czd-hero-loading" role="status">
          Calculando ingresos…
        </p>
      )}
      {t && (
        <>
          <div
            className="czd-lenses"
            role="tablist"
            aria-label="Período de ingresos"
          >
            {lenses.map(l => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={lens === l.id}
                className={lens === l.id ? "is-active" : ""}
                onClick={() => setLens(l.id)}
              >
                <span className="czd-lens-label">{l.label}</span>
                <strong>{money(l.value)}</strong>
                <small>{l.note}</small>
              </button>
            ))}
          </div>
          <div
            className="czd-hero-chart"
            aria-label={
              lens === "anio"
                ? `Ingresos por mes de ${year}`
                : "Ingresos de los últimos 30 días"
            }
          >
            <p className="czd-hero-chart-title">
              {lens === "anio"
                ? `Ingresos por mes · ${year}`
                : "Ingresos diarios · últimos 30 días"}
            </p>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart
                key={lens}
                data={series}
                margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="czd-gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f2c230" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f2c230" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(255,255,255,.08)"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={lens === "anio" ? 0 : 4}
                  tick={{ fill: "rgba(255,255,255,.62)", fontSize: 12 }}
                />
                <YAxis
                  width={62}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => moneyShort(Number(v))}
                  tick={{ fill: "rgba(255,255,255,.62)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,.35)", strokeWidth: 1 }}
                  content={<HeroTip />}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#f2c230"
                  strokeWidth={2}
                  fill="url(#czd-gold)"
                  activeDot={{
                    r: 5,
                    stroke: "#26300f",
                    strokeWidth: 2,
                    fill: "#f2c230",
                  }}
                  isAnimationActive={!reducedMotion}
                  animationDuration={1400}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </header>
  );
}

function changeNote(
  pct: number | null,
  ref: { of: string; vs: string; same: string }
) {
  if (pct === null) return `Sin datos ${ref.of} para comparar`;
  if (pct === 0) return `Igual que ${ref.same}`;
  return `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)} % frente ${ref.vs}`;
}

function HeroTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; total: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="czd-tip czd-tip--dark">
      <span>{p.label}</span>
      <strong>{money(p.total)}</strong>
    </div>
  );
}

// ───────────── Resumen ─────────────

function Summary({ data }: { data: Overview }) {
  const [table, setTable] = useState(false);
  const s = data.people.sellers;
  const planMix = [
    {
      id: "normal",
      label: "Plan Normal",
      n: s.normal,
      color: SERIES.suscripciones,
    },
    {
      id: "mayor",
      label: "Mayor Visibilidad",
      n: s.mayorVisibilidad,
      color: SERIES.comisiones,
    },
    {
      id: "prueba",
      label: "Prueba gratis",
      n: s.trial,
      color: SERIES.anuncios,
    },
  ];
  const mixTotal = planMix.reduce((a, p) => a + p.n, 0);
  const monthly = data.monthly.map(m => ({ ...m, label: shortMonth(m.month) }));

  return (
    <div className="czd-grid">
      <section
        className="czd-panel czd-panel--wide"
        aria-labelledby="czd-people"
      >
        <h2 id="czd-people">Personas en CuadraZone</h2>
        <div className="czd-tiles">
          <Tile label="Vendedores aprobados" value={int(s.total)} />
          <Tile label="Compradores" value={int(data.people.buyers)} />
          <Tile
            label="Usuarios nuevos (30 días)"
            value={int(data.people.newUsers30)}
          />
          <Tile
            label="Solicitudes por revisar"
            value={int(data.people.pendingApplications)}
          />
          <Tile
            label="Ventas de vendedores"
            value={money(data.sales.gmvCents, false)}
            note={`${int(data.sales.orders)} pedidos entregados en ${data.year}`}
          />
        </div>
        <div className="czd-mix">
          <div className="czd-mix-head">
            <h3>Vendedores por plan</h3>
            <span>
              {int(mixTotal)} con plan activo · {int(s.hidden)} ocultos por pago
              · {int(s.suspended)} suspendidos
            </span>
          </div>
          <div
            className="czd-mix-bar"
            role="img"
            aria-label={planMix.map(p => `${p.label}: ${p.n}`).join(", ")}
          >
            {mixTotal === 0 ? (
              <span className="czd-mix-empty" />
            ) : (
              planMix
                .filter(p => p.n > 0)
                .map(p => (
                  <span
                    key={p.id}
                    style={{ flexGrow: p.n, background: p.color }}
                    title={`${p.label}: ${p.n}`}
                  />
                ))
            )}
          </div>
          <ul className="czd-legend">
            {planMix.map(p => (
              <li key={p.id}>
                <i style={{ background: p.color }} />
                {p.label} <strong>{int(p.n)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="czd-panel czd-panel--wide"
        aria-labelledby="czd-monthly"
      >
        <div className="czd-panel-head">
          <div>
            <h2 id="czd-monthly">Ingresos y gastos por mes</h2>
            <p>
              {data.year}: ingresos {money(data.totals.yearCents)} · gastos{" "}
              {money(data.expenses.yearCents)}
            </p>
          </div>
          <button
            type="button"
            className="czd-ghost"
            onClick={() => setTable(v => !v)}
          >
            {table ? "Ver gráfico" : "Ver tabla"}
          </button>
        </div>
        <ul className="czd-legend">
          {revenueSources.map(src => (
            <li key={src}>
              <i style={{ background: SERIES[src] }} />
              {revenueSourceLabels[src]}
            </li>
          ))}
          <li>
            <i
              className="czd-legend-line"
              style={{ background: SERIES.gastos }}
            />
            Gastos
          </li>
        </ul>
        {table ? (
          <div className="czd-table-wrap">
            <table className="czd-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  {revenueSources.map(s => (
                    <th key={s}>{revenueSourceLabels[s]}</th>
                  ))}
                  <th>Gastos</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map(m => {
                  const income = m.suscripciones + m.comisiones + m.anuncios;
                  return (
                    <tr key={m.month}>
                      <td>{shortMonth(m.month)}</td>
                      {revenueSources.map(s => (
                        <td key={s}>{money(m[s])}</td>
                      ))}
                      <td>{money(m.gastos)}</td>
                      <td className={income - m.gastos < 0 ? "is-neg" : ""}>
                        {money(income - m.gastos)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
              data={monthly}
              margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="28%"
            >
              <CartesianGrid vertical={false} stroke="#e6e9dc" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "#cfd4c0" }}
                tick={{ fill: "#5e6650", fontSize: 12 }}
              />
              <YAxis
                width={62}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => moneyShort(Number(v))}
                tick={{ fill: "#5e6650", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(91,122,30,.07)" }}
                content={<MonthTip />}
              />
              {revenueSources.map((src, i) => (
                <Bar
                  key={src}
                  dataKey={src}
                  stackId="ingresos"
                  fill={SERIES[src]}
                  maxBarSize={24}
                  stroke="#ffffff"
                  strokeWidth={1}
                  radius={i === revenueSources.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
              <Line
                dataKey="gastos"
                type="monotone"
                stroke={SERIES.gastos}
                strokeWidth={2}
                dot={{
                  r: 4,
                  stroke: "#fff",
                  strokeWidth: 2,
                  fill: SERIES.gastos,
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="czd-panel" aria-labelledby="czd-subs">
        <h2 id="czd-subs">Suscripciones vendidas en {data.year}</h2>
        {data.subscriptions.byPlan.length === 0 ? (
          <p className="czd-empty">
            Todavía no hay mensualidades pagadas este año. Se registran en
            Suscripciones.
          </p>
        ) : (
          <ul className="czd-rank">
            {data.subscriptions.byPlan.map(p => {
              const max = data.subscriptions.byPlan[0]!.amountCents || 1;
              return (
                <li key={p.planId}>
                  <div>
                    <strong>{subscriptionPlanName(p.planId)}</strong>
                    <span>{int(p.count)} pagos</span>
                  </div>
                  <div className="czd-rank-bar">
                    <span
                      style={{
                        width: `${(p.amountCents / max) * 100}%`,
                        background:
                          p.planId === "mayor_visibilidad"
                            ? SERIES.comisiones
                            : SERIES.suscripciones,
                      }}
                    />
                  </div>
                  <b>{money(p.amountCents)}</b>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="czd-panel" aria-labelledby="czd-recent">
        <h2 id="czd-recent">Últimos pagos de mensualidad</h2>
        {data.subscriptions.recent.length === 0 ? (
          <p className="czd-empty">
            Aquí verás cada mensualidad en cuanto la registres.
          </p>
        ) : (
          <ul className="czd-feed">
            {data.subscriptions.recent.map(r => (
              <li key={r.id}>
                <StoreLogo name={r.storeName} logoUrl={r.logoUrl} size={36} />
                <div>
                  <strong>{r.storeName}</strong>
                  <span>
                    {subscriptionPlanName(r.planId)} · {r.months}{" "}
                    {r.months === 1 ? "mes" : "meses"} ·{" "}
                    {paymentLabels[r.method] ?? r.method}
                  </span>
                </div>
                <div className="czd-feed-amount">
                  <b>{money(r.amountCents)}</b>
                  <span>{dayLabel(r.paidOn)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="czd-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function MonthTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: Overview["monthly"][number] }>;
}) {
  if (!active || !payload?.length) return null;
  const m = payload[0]!.payload;
  const income = m.suscripciones + m.comisiones + m.anuncios;
  return (
    <div className="czd-tip">
      <span>{label}</span>
      {revenueSources.map(s => (
        <p key={s}>
          <i style={{ background: SERIES[s] }} />
          {revenueSourceLabels[s]}
          <b>{money(m[s])}</b>
        </p>
      ))}
      <p>
        <i style={{ background: SERIES.gastos }} />
        Gastos<b>{money(m.gastos)}</b>
      </p>
      <p className="czd-tip-total">
        Resultado<b>{money(income - m.gastos)}</b>
      </p>
    </div>
  );
}
