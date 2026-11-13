import { Bike } from "lucide-react";
import { toast } from "sonner";
import {
  dispatchVehicleLabels,
  dispatcherStatusLabels,
} from "@shared/dispatch";
import { trpc } from "@/lib/trpc";

const usd = (c: number) => `US$${(c / 100).toFixed(2)}`;

/** Administración: aprobar despachadores y marcar sus pagos. */
export function AdminDispatchers({ enabled }: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const list = trpc.dispatch.adminList.useQuery(undefined, { enabled });
  const setStatus = trpc.dispatch.adminSetStatus.useMutation();
  const markPaid = trpc.dispatch.adminMarkPaid.useMutation();
  const remove = trpc.dispatch.adminDelete.useMutation();
  const busy = setStatus.isPending || remove.isPending;
  async function run(p: Promise<unknown>, ok: string) {
    try {
      await p;
      await utils.dispatch.adminList.invalidate();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ocurrió un error");
    }
  }
  return (
    <section className="member-card">
      <h2>
        <Bike size={20} aria-hidden="true" /> Despachadores
      </h2>
      <p className="member-notice">
        Ganan el 50 % de la comisión de cada pedido que entregan, mínimo US$2.
        Págales por fuera (Yappy o transferencia) y luego toca «Marcar pagado».
      </p>
      {list.isLoading && <p role="status">Cargando…</p>}
      {list.data && !list.data.length && (
        <p>Todavía nadie se ha registrado como despachador.</p>
      )}
      {!!list.data?.length && (
        <div className="dz-admin-table">
          <table className="dz-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Celular</th>
                <th>Provincia</th>
                <th>Vehículo</th>
                <th>Estado</th>
                <th>Entregas</th>
                <th>Por pagar</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map(d => (
                <tr key={d.userId}>
                  <td>{d.fullName}</td>
                  <td>
                    <a href={`tel:${d.phone}`}>{d.phone}</a>
                  </td>
                  <td>{d.province}</td>
                  <td>
                    {dispatchVehicleLabels[d.vehicle]}
                    {d.plate ? ` · ${d.plate}` : ""}
                  </td>
                  <td>{dispatcherStatusLabels[d.status]}</td>
                  <td>{d.delivered}</td>
                  <td>{usd(d.unpaidCents)}</td>
                  <td className="dz-actions">
                    {d.status !== "approved" && (
                      <button
                        className="btn btn-gold"
                        disabled={busy}
                        onClick={() =>
                          run(
                            setStatus.mutateAsync({
                              userId: d.userId,
                              status: "approved",
                            }),
                            "Despachador aprobado"
                          )
                        }
                      >
                        Aprobar
                      </button>
                    )}
                    {d.status === "pending" && (
                      <button
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() =>
                          window.confirm(`¿Rechazar la solicitud de ${d.fullName}?`) &&
                          run(
                            setStatus.mutateAsync({ userId: d.userId, status: "rejected" }),
                            "Solicitud rechazada"
                          )
                        }
                      >
                        Rechazar
                      </button>
                    )}
                    {d.status === "approved" && (
                      <button
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() =>
                          window.confirm(`¿Suspender a ${d.fullName}?`) &&
                          run(
                            setStatus.mutateAsync({
                              userId: d.userId,
                              status: "suspended",
                            }),
                            "Despachador suspendido"
                          )
                        }
                      >
                        Suspender
                      </button>
                    )}
                    {d.unpaidCents > 0 && (
                      <button
                        className="btn btn-outline"
                        disabled={markPaid.isPending}
                        onClick={() =>
                          window.confirm(
                            `¿Ya le pagaste ${usd(d.unpaidCents)} a ${d.fullName}?`
                          ) &&
                          run(
                            markPaid.mutateAsync({ userId: d.userId }),
                            "Pago registrado"
                          )
                        }
                      >
                        Marcar pagado
                      </button>
                    )}
                    <button
                      className="btn btn-outline dz-danger"
                      disabled={busy}
                      onClick={() =>
                        window.confirm(
                          `¿Eliminar a ${d.fullName} como despachador? No se puede deshacer.${
                            d.unpaidCents > 0
                              ? ` Todavía le debes ${usd(d.unpaidCents)}: págale antes.`
                              : ""
                          } Sus pedidos por recoger volverán a Disponibles.`
                        ) &&
                        run(remove.mutateAsync({ userId: d.userId }), "Despachador eliminado")
                      }
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
