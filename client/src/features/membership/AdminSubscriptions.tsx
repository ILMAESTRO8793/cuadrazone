import { useMemo, useState } from "react";
import { toast } from "sonner";
import { commissionPercentLabel, getSellerPlan, isInTrial, sellerPlanIds, subscriptionPlanName, type SellerPlanId } from "@shared/pricing";
import { trpc } from "@/lib/trpc";

type Status = "not_started" | "active" | "past_due" | "cancelled";
const statusText: Record<Status, string> = {
  not_started: "Sin pagar",
  active: "Activa",
  past_due: "Vencida",
  cancelled: "Desactivada",
};
const methodText = { yappy: "Yappy", transferencia: "Transferencia", efectivo: "Efectivo", otro: "Otro" } as const;
type Method = keyof typeof methodText;

const money = (cents: number) => `US$${(cents / 100).toFixed(2)}`;
const day = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "numeric", month: "short", year: "numeric" }) : "—";
const todayInPanama = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });

export function AdminSubscriptions({ enabled }: { enabled: boolean }) {
  const list = trpc.membership.subscription.list.useQuery(undefined, { enabled });
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<"todas" | Status>("todas");
  const rows = useMemo(
    () => (list.data ?? []).filter(row => filter === "todas" || row.status === filter),
    [list.data, filter]
  );
  const current = list.data?.find(row => row.applicationId === selected) ?? null;

  return (
    <div className="admin-columns">
      <section className="member-card admin-queue">
        <div className="admin-list-heading">
          <h2>Vendedores aprobados</h2>
          <label>
            Suscripción
            <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
              <option value="todas">Todas</option>
              {(Object.keys(statusText) as Status[]).map(key => <option key={key} value={key}>{statusText[key]}</option>)}
            </select>
          </label>
        </div>
        {list.isLoading && <p role="status">Cargando vendedores…</p>}
        {list.error && <p className="member-error" role="alert">{list.error.message}</p>}
        {list.data && rows.length === 0 && (
          <div className="admin-empty"><h3>No hay vendedores en esta vista</h3><p>Aparecen aquí cuando apruebas su solicitud.</p></div>
        )}
        <div className="admin-entries">
          {rows.map(row => (
            <button
              key={row.applicationId}
              className={`admin-entry ${selected === row.applicationId ? "selected" : ""}`}
              onClick={() => setSelected(row.applicationId)}
            >
              <span>
                <strong>{row.name}</strong>
                <small>{row.status === "active" && isInTrial(row.trialEndsAt) ? `Prueba gratis hasta ${day(row.trialEndsAt)}` : `${statusText[row.status]}${row.status === "active" ? ` hasta ${day(row.endsAt)}` : ""}`}</small>
                <small>{row.planId ? subscriptionPlanName(row.planId) : row.chosenPlanId ? `Eligió ${getSellerPlan(row.chosenPlanId).name}` : "Sin plan elegido"}</small>
                {row.pendingCommissionCents > 0 && <small><strong>Debe comisión: {money(row.pendingCommissionCents)}</strong></small>}
              </span>
            </button>
          ))}
        </div>
      </section>
      {current ? (
        <section className="member-card admin-detail">
          <SubscriptionDetail key={current.applicationId} row={current} onChanged={() => list.refetch()} />
        </section>
      ) : (
        <section className="member-card admin-empty">
          <h2>Selecciona un vendedor</h2>
          <p>Registra su pago o revisa su historial. Cuando un vendedor aprobado te pague por Yappy, transferencia o efectivo, su tienda se publica al registrar el pago y se oculta sola al vencer.</p>
        </section>
      )}
    </div>
  );
}

type Row = {
  applicationId: number;
  pendingCommissionCents: number;
  name: string;
  email: string;
  phone: string;
  status: Status;
  planId: string | null;
  chosenPlanId: SellerPlanId | null;
  endsAt: Date | null;
  trialEndsAt: Date | null;
};

function SubscriptionDetail({ row, onChanged }: { row: Row; onChanged: () => Promise<unknown> }) {
  const payments = trpc.membership.subscription.payments.useQuery({ applicationId: row.applicationId });
  const record = trpc.membership.subscription.recordPayment.useMutation();
  const deactivate = trpc.membership.subscription.deactivate.useMutation();
  const [planId, setPlanId] = useState<SellerPlanId>(
    (sellerPlanIds as readonly string[]).includes(row.planId ?? "") ? (row.planId as SellerPlanId) : row.chosenPlanId ?? "normal"
  );
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<Method>("yappy");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayInPanama());
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const amountCents = getSellerPlan(planId).monthlyCents * months;
  const digits = row.phone.replace(/\D/g, "");
  const referenceOk = method === "efectivo" || reference.trim().length >= 3;

  async function save() {
    try {
      const result = await record.mutateAsync({
        applicationId: row.applicationId, planId, months, amountCents, method,
        reference: reference.trim(), paidOn, note: note.trim(),
      });
      toast.success(`Suscripción activa hasta ${day(result.endsAt)}`);
      setConfirming(false); setReference(""); setNote("");
      await Promise.all([onChanged(), payments.refetch()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el pago");
      setConfirming(false);
    }
  }

  async function turnOff() {
    try {
      await deactivate.mutateAsync({ applicationId: row.applicationId, reason: reason.trim() });
      toast.success("Suscripción desactivada; la tienda ya no es visible");
      setReason("");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo desactivar");
    }
  }

  return (
    <div>
      <h2>{row.name}</h2>
      <p>
        {row.email} · <a className="member-inline-link" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">{row.phone}</a>
      </p>
      <p className="member-notice">
        Estado: <strong>{row.status === "active" && isInTrial(row.trialEndsAt) ? `Prueba gratis hasta ${day(row.trialEndsAt)} (comisión 8%)` : `${statusText[row.status]} (comisión 5%)`}</strong>
        {row.planId && sellerPlanIds.includes(row.planId as SellerPlanId) && <> · Plan {subscriptionPlanName(row.planId)}</>}
        {row.endsAt && <> · {row.status === "active" ? "Activa hasta" : "Venció"} el {day(row.endsAt)}</>}
      </p>

      <div className="admin-review-form">
        <h3>Registrar pago de mensualidad</h3>
        <p>{row.status === "active" && isInTrial(row.trialEndsAt) ? "Está en su prueba gratis. Si paga por adelantado, los meses se suman al terminar la prueba y la comisión sigue en 8% hasta entonces." : "Primero confirma en tu cuenta de Yappy o del banco que el dinero llegó."}</p>
        <label>Plan
          <select value={planId} onChange={e => { setPlanId(e.target.value as SellerPlanId); setConfirming(false); }}>
            {sellerPlanIds.map(id => <option key={id} value={id}>{getSellerPlan(id).name} · {money(getSellerPlan(id).monthlyCents)} al mes</option>)}
          </select>
        </label>
        <label>Meses pagados
          <select value={months} onChange={e => { setMonths(Number(e.target.value)); setConfirming(false); }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} {n === 1 ? "mes" : "meses"}</option>)}
          </select>
        </label>
        <p>Monto que debiste recibir: <strong>{money(amountCents)}</strong></p>
        <label>Método
          <select value={method} onChange={e => { setMethod(e.target.value as Method); setConfirming(false); }}>
            {(Object.keys(methodText) as Method[]).map(key => <option key={key} value={key}>{methodText[key]}</option>)}
          </select>
        </label>
        <label>{method === "efectivo" ? "Recibo (opcional)" : "Número de comprobante"}
          <input maxLength={120} value={reference} onChange={e => setReference(e.target.value)} placeholder={method === "yappy" ? "Ej.: número de confirmación de Yappy" : ""} />
        </label>
        <label>Fecha del pago
          <input type="date" value={paidOn} max={todayInPanama()} onChange={e => setPaidOn(e.target.value)} />
        </label>
        <label>Nota (opcional)
          <input maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <div className="admin-actions">
          {!confirming ? (
            <button className="btn btn-gold" disabled={!referenceOk || !paidOn || record.isPending} onClick={() => setConfirming(true)}>
              Registrar {money(amountCents)}
            </button>
          ) : (
            <>
              <button className="btn btn-outline" disabled={record.isPending} onClick={() => setConfirming(false)}>Cancelar</button>
              <button className="btn btn-gold" disabled={record.isPending} onClick={() => void save()}>
                {record.isPending ? "Guardando…" : `Confirmar ${money(amountCents)} por ${methodText[method]}`}
              </button>
            </>
          )}
        </div>
        <small>Si la suscripción sigue vigente, los meses se suman desde su vencimiento actual.</small>
      </div>

      <CommissionSection applicationId={row.applicationId} onChanged={onChanged} />

      <h3>Historial de mensualidades</h3>
      {payments.isLoading && <p role="status">Cargando pagos…</p>}
      {payments.data?.length === 0 && <p>Todavía no hay pagos registrados.</p>}
      <ul className="admin-audit">
        {payments.data?.map(p => (
          <li key={p.id}>
            <strong>{money(p.amountCents)}</strong> · {methodText[p.method as Method]} {p.reference && `· ${p.reference}`} · pagado el {p.paidOn}
            <br />
            <small>
              {subscriptionPlanName(p.planId)}, {p.months} {p.months === 1 ? "mes" : "meses"}: del {day(p.periodStart)} al {day(p.periodEnd)} · registrado por {p.recordedByName ?? "administrador"}
              {p.note && ` · ${p.note}`}
            </small>
          </li>
        ))}
      </ul>

      {row.status === "active" && (
        <div className="admin-review-form">
          <h3>Desactivar antes de tiempo</h3>
          <p>Úsalo solo si el pago se revirtió o por una falta grave. La tienda deja de verse de inmediato.</p>
          <label>Motivo<input maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
          <div className="admin-actions">
            <button className="btn btn-outline" disabled={reason.trim().length < 5 || deactivate.isPending} onClick={() => void turnOff()}>
              {deactivate.isPending ? "Desactivando…" : "Desactivar suscripción"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommissionSection({ applicationId, onChanged }: { applicationId: number; onChanged: () => Promise<unknown> }) {
  const detail = trpc.membership.commission.detail.useQuery({ applicationId });
  const record = trpc.membership.commission.recordPayment.useMutation();
  const [method, setMethod] = useState<Method>("yappy");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayInPanama());
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const data = detail.data;
  const referenceOk = method === "efectivo" || reference.trim().length >= 3;

  async function save() {
    if (!data) return;
    try {
      const result = await record.mutateAsync({ applicationId, amountCents: data.totalCents, method, reference: reference.trim(), paidOn, note: note.trim() });
      toast.success(`Comisión de ${money(result.amountCents)} registrada (${result.orderCount} pedidos)`);
      setConfirming(false); setReference(""); setNote("");
      await Promise.all([detail.refetch(), onChanged()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar");
      setConfirming(false);
      await detail.refetch();
    }
  }

  return (
    <div className="admin-review-form">
      <h3>Comisiones por venta</h3>
      {detail.isLoading && <p role="status">Calculando comisiones…</p>}
      {detail.error && <p className="member-error" role="alert">{detail.error.message}</p>}
      {data && (
        <>
          <p>
            Pendiente: <strong>{money(data.totalCents)}</strong> de {data.orderCount} {data.orderCount === 1 ? "pedido entregado" : "pedidos entregados"}.
            Se calcula sobre los productos, sin el envío.
          </p>
          {data.orders.length > 0 && (
            <ul className="admin-audit">
              {data.orders.map(order => (
                <li key={order.id}>
                  {order.number}: {money(order.commissionCents)} ({commissionPercentLabel(order.commissionBps)} de {money(order.subtotalCents)}) · entregado el {day(order.deliveredAt)}
                </li>
              ))}
            </ul>
          )}
          {data.totalCents > 0 && (
            <>
              <label>Método
                <select value={method} onChange={e => { setMethod(e.target.value as Method); setConfirming(false); }}>
                  {(Object.keys(methodText) as Method[]).map(key => <option key={key} value={key}>{methodText[key]}</option>)}
                </select>
              </label>
              <label>{method === "efectivo" ? "Recibo (opcional)" : "Número de comprobante"}
                <input maxLength={120} value={reference} onChange={e => setReference(e.target.value)} />
              </label>
              <label>Fecha del pago
                <input type="date" value={paidOn} max={todayInPanama()} onChange={e => setPaidOn(e.target.value)} />
              </label>
              <label>Nota (opcional)<input maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
              <div className="admin-actions">
                {!confirming ? (
                  <button className="btn btn-gold" disabled={!referenceOk || !paidOn || record.isPending} onClick={() => setConfirming(true)}>
                    Registrar pago de {money(data.totalCents)}
                  </button>
                ) : (
                  <>
                    <button className="btn btn-outline" disabled={record.isPending} onClick={() => setConfirming(false)}>Cancelar</button>
                    <button className="btn btn-gold" disabled={record.isPending} onClick={() => void save()}>
                      {record.isPending ? "Guardando…" : `Confirmar ${money(data.totalCents)} por ${methodText[method]}`}
                    </button>
                  </>
                )}
              </div>
              <small>El pago salda todos los pedidos pendientes que aparecen arriba.</small>
            </>
          )}
          {data.payments.length > 0 && (
            <>
              <h4>Comisiones pagadas</h4>
              <ul className="admin-audit">
                {data.payments.map(p => (
                  <li key={p.id}>
                    <strong>{money(p.amountCents)}</strong> · {p.orderCount} pedidos · {methodText[p.method as Method]} {p.reference && `· ${p.reference}`} · pagado el {p.paidOn}
                    <br /><small>Registrado por {p.recordedByName ?? "administrador"}{p.note && ` · ${p.note}`}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
