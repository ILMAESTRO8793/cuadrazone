import { useState } from "react";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import {
  SERVICE_PUB_MONTHLY_CENTS,
  servicePubStatusLabels,
} from "@shared/servicePub";
import { panamaDateKey } from "@shared/finance";
import { trpc } from "@/lib/trpc";
import { StoreLogo } from "@/components/marketplace/StoreLogo";
import "./adminShowcase.css";

const money = (c: number) => `US$${(c / 100).toFixed(2)}`;
const dateLabel = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-PA", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "America/Panama",
      }).format(new Date(iso))
    : "";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";
type Method = "yappy" | "transferencia" | "tarjeta" | "efectivo" | "otro";

/** Pedidos de Service Pub (US$10/mes): registrar el pago lo activa o lo renueva. */
export function AdminServicePub({ enabled }: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const list = trpc.servicePub.adminList.useQuery(undefined, { enabled });
  const pay = trpc.servicePub.adminRecordPayment.useMutation();
  const cancel = trpc.servicePub.adminCancel.useMutation();
  const [paying, setPaying] = useState<number | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [form, setForm] = useState({
    months: 1,
    method: "yappy" as Method,
    reference: "",
    paidOn: panamaDateKey(new Date()),
  });

  async function submit(e: React.FormEvent, userId: number) {
    e.preventDefault();
    try {
      const r = await pay.mutateAsync({ userId, ...form });
      await Promise.all([
        utils.servicePub.adminList.invalidate(),
        utils.adminDashboard.overview.invalidate(),
      ]);
      setPaying(null);
      toast.success(
        `Pago registrado. Activo hasta el ${dateLabel(r.activeUntil)}`
      );
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  async function stop(userId: number, name: string) {
    if (!confirm(`¿Cancelar el Service Pub de ${name}?`)) return;
    try {
      await cancel.mutateAsync({ userId });
      await utils.servicePub.adminList.invalidate();
      toast.success("Service Pub cancelado");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  const rows = list.data ?? [];
  const waiting = rows.filter(
    r => r.status === "requested" || r.status === "expired"
  ).length;
  return (
    <section className="member-card as-wrap" aria-labelledby="sp-title">
      <div className="as-head">
        <div>
          <h2 id="sp-title">
            <Megaphone size={20} /> Service Pub ·{" "}
            {money(SERVICE_PUB_MONTHLY_CENTS)}/mes
          </h2>
          <p className="member-muted">
            Publicidad personalizada que el vendedor pide desde «Mi plan»,
            aparte de su plan. Cuando pague, registra el pago aquí: se activa (o
            se renueva) y le llega un correo. Después le armas su banner en
            «Personalizado».
            {waiting ? ` Hay ${waiting} esperando pago.` : ""}
          </p>
        </div>
      </div>
      {list.isLoading && <p role="status">Cargando pedidos…</p>}
      {list.data && rows.length === 0 && (
        <p className="as-empty">Todavía nadie ha pedido Service Pub.</p>
      )}
      <ul className="as-list">
        {rows.map(r => (
          <li
            key={r.userId}
            className={r.status === "cancelled" ? "is-off" : ""}
          >
            <div className="as-thumb">
              <StoreLogo name={r.storeName} logoUrl={r.logoUrl} size={48} />
            </div>
            <div>
              <strong>{r.storeName}</strong>
              <small>
                {servicePubStatusLabels[r.status]}
                {r.status === "active" && r.activeUntil
                  ? ` hasta el ${dateLabel(r.activeUntil)}`
                  : ""}
                {` · pedido el ${dateLabel(r.requestedAt)}`}
              </small>
              {r.message && <small>«{r.message}»</small>}
              <small>
                {r.sellerName}
                {r.phone ? (
                  <>
                    {" "}
                    · <a href={`tel:${r.phone}`}>{r.phone}</a>
                  </>
                ) : null}
                {r.email ? (
                  <>
                    {" "}
                    · <a href={`mailto:${r.email}`}>{r.email}</a>
                  </>
                ) : null}
              </small>
              {picking === r.userId && (
                <PickProducts userId={r.userId} active={r.status === "active"} />
              )}
              {paying === r.userId && (
                <form
                  className="sp-pay"
                  onSubmit={e => void submit(e, r.userId)}
                >
                  <label>
                    Meses
                    <select
                      value={form.months}
                      onChange={e =>
                        setForm({ ...form, months: Number(e.target.value) })
                      }
                    >
                      {[1, 2, 3, 6, 12].map(m => (
                        <option key={m} value={m}>
                          {m} · {money(SERVICE_PUB_MONTHLY_CENTS * m)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Método
                    <select
                      value={form.method}
                      onChange={e =>
                        setForm({ ...form, method: e.target.value as Method })
                      }
                    >
                      <option value="yappy">Yappy</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="otro">Otro</option>
                    </select>
                  </label>
                  <label>
                    Comprobante (opcional)
                    <input
                      value={form.reference}
                      maxLength={120}
                      onChange={e =>
                        setForm({ ...form, reference: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Fecha del pago
                    <input
                      type="date"
                      value={form.paidOn}
                      onChange={e =>
                        setForm({ ...form, paidOn: e.target.value })
                      }
                      required
                    />
                  </label>
                  <div className="as-row-actions">
                    <button
                      className="member-button member-button--gold"
                      type="submit"
                      disabled={pay.isPending}
                    >
                      {pay.isPending ? "Guardando…" : "Registrar pago"}
                    </button>
                    <button
                      className="member-button"
                      type="button"
                      onClick={() => setPaying(null)}
                    >
                      Cerrar
                    </button>
                  </div>
                </form>
              )}
            </div>
            <div className="as-row-actions">
              <button
                type="button"
                className="member-button"
                onClick={() => setPicking(picking === r.userId ? null : r.userId)}
              >
                {picking === r.userId ? "Cerrar productos" : "Productos en Destacados"}
              </button>
              {paying !== r.userId && (
                <button
                  type="button"
                  className="member-button member-button--gold"
                  onClick={() => setPaying(r.userId)}
                >
                  {r.status === "active" ? "Renovar" : "Registrar pago"}
                </button>
              )}
              {r.status !== "cancelled" && (
                <button
                  type="button"
                  className="member-button as-danger"
                  disabled={cancel.isPending}
                  onClick={() => void stop(r.userId, r.storeName)}
                >
                  Cancelar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Qué productos de este cliente salen en «Destacados» de /mercado. Solo se
 * ven en la web mientras su Service Pub esté pagado y tenga Mayor Visibilidad.
 */
function PickProducts({ userId, active }: { userId: number; active: boolean }) {
  const utils = trpc.useUtils();
  const list = trpc.servicePub.adminProducts.useQuery({ userId });
  const set = trpc.servicePub.adminSetFeatured.useMutation({
    onSuccess: () => {
      void utils.servicePub.adminProducts.invalidate({ userId });
      void utils.servicePub.featured.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  if (list.isLoading) return <p className="as-empty">Cargando productos…</p>;
  if (!list.data?.length)
    return <p className="as-empty">Esta tienda todavía no tiene productos.</p>;
  return (
    <div className="sp-picks">
      {!active && (
        <p className="as-empty">
          Su Service Pub no está pagado: lo que actives se verá cuando registres el pago.
        </p>
      )}
      <p className="as-empty">
        Solo se muestra si la tienda tiene el plan Mayor Visibilidad. Se ve la foto, el nombre de la tienda y las 5 estrellas.
      </p>
      <ul>
        {list.data.map(p => (
          <li key={p.id}>
            <label>
              <input
                type="checkbox"
                checked={p.featured}
                disabled={set.isPending || (!p.published && !p.featured)}
                onChange={e => set.mutate({ productId: p.id, on: e.target.checked })}
              />
              {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <span className="sp-noimg" />}
              <span>
                {p.title}
                {!p.published && <small> · no publicado</small>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
