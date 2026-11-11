import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CORPORATE_ISR_RATE,
  DIVIDEND_TAX_RATE,
  ITBMS_THRESHOLD_CENTS,
  type FinanceSettings,
  type ProfitSplit,
} from "@shared/finance";
import { trpc } from "@/lib/trpc";
import type { Overview } from "./AdminDashboard";
import { money } from "./format";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

export function FinancePanel({ data }: { data: Overview }) {
  const [period, setPeriod] = useState<"mes" | "anio">("mes");
  const f = data.finance;
  const split = period === "mes" ? f.month : f.year;
  const sa = f.settings.entity === "sociedad_anonima";
  const periodName = period === "mes" ? "este mes" : `${data.year} (hasta hoy)`;

  return (
    <div className="czd-grid">
      <section
        className="czd-panel czd-panel--wide"
        aria-labelledby="czd-split"
      >
        <div className="czd-panel-head">
          <div>
            <h2 id="czd-split">
              De lo que entra a lo que le toca a cada socio
            </h2>
            <p>
              {sa
                ? "Como sociedad anónima"
                : "Como personas naturales (todavía sin S.A.)"}
              : se pagan los gastos,
              {sa ? " el ISR de la sociedad," : ""} se deja{" "}
              {f.settings.reservePct} % como flujo de caja y el resto se reparte
              según las acciones.
            </p>
          </div>
          <div className="czd-seg" role="tablist" aria-label="Período">
            <button
              type="button"
              role="tab"
              aria-selected={period === "mes"}
              className={period === "mes" ? "is-active" : ""}
              onClick={() => setPeriod("mes")}
            >
              Este mes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={period === "anio"}
              className={period === "anio" ? "is-active" : ""}
              onClick={() => setPeriod("anio")}
            >
              Año {data.year}
            </button>
          </div>
        </div>
        <Cascade split={split} sa={sa} reservePct={f.settings.reservePct} />
        <div className="czd-partners">
          {split.partners.map(p => (
            <article key={p.name} className="czd-partner">
              <header>
                <span className="czd-partner-initial" aria-hidden="true">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{p.name}</h3>
                  <span>{p.sharePct} % de las acciones</span>
                </div>
              </header>
              <dl>
                <div>
                  <dt>
                    {sa ? "Dividendo" : "Salario"} de {periodName}
                  </dt>
                  <dd>{money(p.grossCents)}</dd>
                </div>
                <div>
                  <dt>
                    {sa
                      ? `Impuesto de dividendos (${DIVIDEND_TAX_RATE * 100} %)`
                      : "ISR personal estimado"}
                  </dt>
                  <dd>− {money(p.taxCents)}</dd>
                </div>
                <div className="czd-partner-net">
                  <dt>Le queda</dt>
                  <dd>{money(p.netCents)}</dd>
                </div>
              </dl>
            </article>
          ))}
          <article className="czd-partner czd-partner--reserve">
            <header>
              <span className="czd-partner-initial" aria-hidden="true">
                $
              </span>
              <div>
                <h3>Flujo de caja</h3>
                <span>
                  {f.settings.reservePct} % que se queda en CuadraZone
                </span>
              </div>
            </header>
            <dl>
              <div className="czd-partner-net">
                <dt>Reserva de {periodName}</dt>
                <dd>{money(split.reserveCents)}</dd>
              </div>
              <div>
                <dt>Impuestos estimados del período</dt>
                <dd>{money(split.totalTaxCents)}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section className="czd-panel" aria-labelledby="czd-tax">
        <h2 id="czd-tax">Impuestos en Panamá</h2>
        <ul className="czd-notes">
          {sa ? (
            <>
              <li>
                <b>ISR de la sociedad: {CORPORATE_ISR_RATE * 100} %</b> de la
                utilidad neta gravable.
              </li>
              <li>
                <b>Dividendos: {DIVIDEND_TAX_RATE * 100} %</b> que la S.A.
                retiene al repartir (acciones nominativas).
              </li>
              <li>
                La S.A. paga además la tasa única anual y el Aviso de Operación.
              </li>
            </>
          ) : (
            <>
              <li>
                <b>ISR de personas naturales</b> (art. 700 del Código Fiscal),
                por año y por socio: hasta US$11 000 no paga; de US$11 000 a
                US$50 000, 15 % sobre lo que pase de 11 000; más de US$50 000,
                US$5 850 + 25 % sobre lo que pase de 50 000.
              </li>
              <li>
                En «Este mes» el ISR se calcula como si el mes se repitiera todo
                el año y se divide entre 12.
              </li>
            </>
          )}
          <li>
            <b>ITBMS 7 %:</b> hay que inscribirse cuando los ingresos del año
            pasan de {money(ITBMS_THRESHOLD_CENTS, false)}.{" "}
            {f.itbmsThresholdReached ? (
              <strong className="czd-warn">Este año ya lo superaron.</strong>
            ) : (
              `Van ${money(data.totals.yearCents, false)}.`
            )}
            {f.settings.itbmsIncluded
              ? " Los cobros se tratan como si ya incluyeran el ITBMS."
              : ""}
          </li>
          <li>
            Son cálculos de referencia: confirmen con su contador antes de
            declarar.
          </li>
        </ul>
      </section>

      <SettingsEditor settings={f.settings} />
    </div>
  );
}

function Cascade({
  split,
  sa,
  reservePct,
}: {
  split: ProfitSplit;
  sa: boolean;
  reservePct: number;
}) {
  const base = Math.max(split.grossIncomeCents, split.expensesCents, 1);
  const steps: Array<{
    label: string;
    cents: number;
    kind: "in" | "out" | "sum";
  }> = [
    { label: "Ingresos cobrados", cents: split.grossIncomeCents, kind: "in" },
    ...(split.itbmsCents
      ? [
          {
            label: "ITBMS (7 %) para la DGI",
            cents: -split.itbmsCents,
            kind: "out" as const,
          },
        ]
      : []),
    { label: "Gastos", cents: -split.expensesCents, kind: "out" },
    {
      label: split.profitCents < 0 ? "Pérdida" : "Utilidad",
      cents: split.profitCents,
      kind: "sum",
    },
    ...(sa
      ? [
          {
            label: `ISR de la sociedad (${CORPORATE_ISR_RATE * 100} %)`,
            cents: -split.corporateIsrCents,
            kind: "out" as const,
          },
        ]
      : []),
    {
      label: `Flujo de caja (${reservePct} %)`,
      cents: -split.reserveCents,
      kind: "out",
    },
    {
      label: "Para repartir entre socios",
      cents: split.distributableCents,
      kind: "sum",
    },
  ];
  return (
    <ol className="czd-cascade">
      {steps.map(s => (
        <li
          key={s.label}
          className={`czd-cascade--${s.kind}${s.cents < 0 && s.kind === "sum" ? " is-neg" : ""}`}
        >
          <span>{s.label}</span>
          <div className="czd-cascade-bar">
            <i
              style={{
                width: `${Math.min(100, (Math.abs(s.cents) / base) * 100)}%`,
              }}
            />
          </div>
          <b>
            {s.cents < 0 ? "− " : ""}
            {money(Math.abs(s.cents))}
          </b>
        </li>
      ))}
    </ol>
  );
}

function SettingsEditor({ settings }: { settings: FinanceSettings }) {
  const utils = trpc.useUtils();
  const save = trpc.adminDashboard.saveSettings.useMutation();
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const sum = draft.partners.reduce((a, p) => a + (Number(p.sharePct) || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        ...draft,
        partners: draft.partners.map(p => ({
          name: p.name,
          sharePct: Number(p.sharePct),
        })),
      });
      await utils.adminDashboard.overview.invalidate();
      toast.success("Reparto guardado");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <section className="czd-panel" aria-labelledby="czd-settings">
      <h2 id="czd-settings">Socios y reglas del reparto</h2>
      <form className="czd-form" onSubmit={submit}>
        <label>
          Tipo de empresa
          <select
            value={draft.entity}
            onChange={e =>
              setDraft({
                ...draft,
                entity: e.target.value as FinanceSettings["entity"],
              })
            }
          >
            <option value="personas_naturales">
              Personas naturales (todavía sin S.A.)
            </option>
            <option value="sociedad_anonima">Sociedad anónima (S.A.)</option>
          </select>
        </label>
        <div className="czd-form-row">
          <label>
            Flujo de caja (%)
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.reservePct}
              onChange={e =>
                setDraft({ ...draft, reservePct: Number(e.target.value) })
              }
            />
          </label>
          <label className="czd-check">
            <input
              type="checkbox"
              checked={draft.itbmsIncluded}
              onChange={e =>
                setDraft({ ...draft, itbmsIncluded: e.target.checked })
              }
            />
            Los cobros ya incluyen ITBMS (7 %)
          </label>
        </div>
        {draft.partners.map((p, i) => (
          <div className="czd-form-row" key={i}>
            <label>
              Socio
              <input
                value={p.name}
                maxLength={60}
                onChange={e =>
                  setDraft({
                    ...draft,
                    partners: draft.partners.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    ),
                  })
                }
                required
              />
            </label>
            <label>
              Acciones (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={p.sharePct}
                onChange={e =>
                  setDraft({
                    ...draft,
                    partners: draft.partners.map((x, j) =>
                      j === i ? { ...x, sharePct: Number(e.target.value) } : x
                    ),
                  })
                }
              />
            </label>
          </div>
        ))}
        <p className={Math.abs(sum - 100) < 0.01 ? "czd-muted" : "czd-warn"}>
          Suman {sum} %{" "}
          {Math.abs(sum - 100) < 0.01 ? "" : "· deben sumar 100 %"}
        </p>
        <button
          className="czd-primary"
          type="submit"
          disabled={save.isPending || Math.abs(sum - 100) >= 0.01}
        >
          {save.isPending ? "Guardando…" : "Guardar reparto"}
        </button>
      </form>
    </section>
  );
}
