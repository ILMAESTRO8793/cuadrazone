import { useEffect, useRef, useState } from "react";
import {
  Bike,
  Camera,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  DISPATCH_MIN_CENTS,
  DISPATCH_PING_MS,
  DISPATCH_SHARE_PCT,
  dispatchVehicleLabels,
  dispatchVehicles,
  dispatcherStatusLabels,
  type DispatchVehicle,
} from "@shared/dispatch";
import { directionsLinks, type Point } from "@shared/location";
import { provinceOptions } from "@shared/marketplace";
import { trpc } from "@/lib/trpc";
import { AuthGate } from "@/features/membership/AuthGate";
import { DeliveryMap } from "@/components/maps/Maps";
import "./dispatch.css";

const usd = (c: number) => `US$${(c / 100).toFixed(2)}`;
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

export function DispatcherPage() {
  return (
    <AuthGate>
      <DispatcherContent />
    </AuthGate>
  );
}

function DispatcherContent() {
  const me = trpc.dispatch.me.useQuery();
  if (me.isLoading)
    return (
      <div className="dz-page container">
        <p role="status">Cargando…</p>
      </div>
    );
  const d = me.data;
  return (
    <div className="dz-page container">
      <header className="dz-head">
        <Bike size={30} aria-hidden="true" />
        <div>
          <p className="eyebrow">CuadraZone</p>
          <h1>Despachador</h1>
          <p>
            Lleva pedidos de comercios dentro de tu provincia. Ganas el{" "}
            {DISPATCH_SHARE_PCT} % de la comisión de cada pedido, mínimo{" "}
            {usd(DISPATCH_MIN_CENTS)} por entrega.
          </p>
        </div>
      </header>
      {!d || d.status === "pending" || d.status === "rejected" ? (
        <ApplyForm current={d ?? null} />
      ) : d.status === "suspended" ? (
        <p className="member-notice">
          Tu cuenta de despachador está suspendida. Escríbenos desde Ayuda para
          revisarla.
        </p>
      ) : (
        <Approved province={d.province} />
      )}
      {d && <DeleteAccount />}
    </div>
  );
}

/** El despachador borra su cuenta (antes debe cancelar o entregar sus pedidos). */
function DeleteAccount() {
  const utils = trpc.useUtils();
  const remove = trpc.dispatch.deleteMe.useMutation();
  return (
    <section className="dz-card dz-delete">
      <h2>Eliminar mi cuenta de despachador</h2>
      <p>
        Dejarás de ver pedidos. Tu historial de entregas se conserva para tus
        pagos pendientes. Tu cuenta de CuadraZone sigue activa.
      </p>
      <button
        className="btn btn-outline dz-danger"
        disabled={remove.isPending}
        onClick={async () => {
          if (
            !window.confirm(
              "¿Eliminar tu cuenta de despachador? No se puede deshacer."
            )
          )
            return;
          try {
            await remove.mutateAsync();
            await utils.dispatch.me.invalidate();
            toast.success("Tu cuenta de despachador fue eliminada");
          } catch (error) {
            toast.error(errorText(error));
          }
        }}
      >
        {remove.isPending ? "Eliminando…" : "Eliminar mi cuenta"}
      </button>
    </section>
  );
}

function ApplyForm({
  current,
}: {
  current: {
    fullName: string;
    phone: string;
    province: string;
    vehicle: DispatchVehicle;
    plate: string;
    status: keyof typeof dispatcherStatusLabels;
  } | null;
}) {
  const utils = trpc.useUtils();
  const apply = trpc.dispatch.register.useMutation();
  const [f, setF] = useState({
    fullName: current?.fullName ?? "",
    phone: current?.phone ?? "+507",
    province: current?.province ?? "Panamá",
    vehicle: (current?.vehicle ?? "moto") as DispatchVehicle,
    plate: current?.plate ?? "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apply.mutateAsync(f);
      await utils.dispatch.me.invalidate();
      toast.success("Solicitud enviada. Te avisaremos cuando la aprobemos.");
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  return (
    <section className="dz-card">
      {current && (
        <p className="member-notice">
          Estado: <strong>{dispatcherStatusLabels[current.status]}</strong>.{" "}
          {current.status === "rejected"
            ? "Tu solicitud no fue aprobada. Puedes corregir tus datos y enviarla de nuevo."
            : "Un administrador revisa tu solicitud."}
        </p>
      )}
      <h2>{current ? "Tus datos" : "Quiero ser despachador"}</h2>
      <form className="dz-form" onSubmit={submit}>
        <label>
          Nombre completo
          <input
            value={f.fullName}
            onChange={e => setF({ ...f, fullName: e.target.value })}
            required
            maxLength={120}
            autoComplete="name"
          />
        </label>
        <label>
          Celular
          <input
            value={f.phone}
            onChange={e =>
              setF({ ...f, phone: e.target.value.replace(/[^\d+]/g, "") })
            }
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="+50760000000"
          />
        </label>
        <label>
          Provincia donde entregas
          <select
            value={f.province}
            onChange={e => setF({ ...f, province: e.target.value })}
          >
            {provinceOptions.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vehículo
          <select
            value={f.vehicle}
            onChange={e =>
              setF({ ...f, vehicle: e.target.value as DispatchVehicle })
            }
          >
            {dispatchVehicles.map(v => (
              <option key={v} value={v}>
                {dispatchVehicleLabels[v]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Placa (si tiene)
          <input
            value={f.plate}
            onChange={e => setF({ ...f, plate: e.target.value })}
            maxLength={20}
          />
        </label>
        <button
          className="btn btn-gold"
          type="submit"
          disabled={apply.isPending}
        >
          {apply.isPending
            ? "Enviando…"
            : current
              ? "Guardar datos"
              : "Enviar solicitud"}
        </button>
      </form>
    </section>
  );
}

function Approved({ province }: { province: string }) {
  const [tab, setTab] = useState<"disponibles" | "mias" | "ganancias">("mias");
  return (
    <>
      <div
        className="admin-tabs"
        role="group"
        aria-label="Secciones del despachador"
      >
        <button
          className={tab === "mias" ? "active" : ""}
          onClick={() => setTab("mias")}
        >
          Mis entregas
        </button>
        <button
          className={tab === "disponibles" ? "active" : ""}
          onClick={() => setTab("disponibles")}
        >
          Disponibles en {province}
        </button>
        <button
          className={tab === "ganancias" ? "active" : ""}
          onClick={() => setTab("ganancias")}
        >
          Ganancias
        </button>
      </div>
      {tab === "disponibles" ? (
        <Available onTaken={() => setTab("mias")} />
      ) : tab === "mias" ? (
        <MyJobs />
      ) : (
        <Earnings />
      )}
    </>
  );
}

function Available({ onTaken }: { onTaken: () => void }) {
  const utils = trpc.useUtils();
  const list = trpc.dispatch.available.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const take = trpc.dispatch.take.useMutation();
  if (list.isLoading) return <p role="status">Buscando pedidos…</p>;
  if (!list.data?.length)
    return (
      <div className="admin-empty">
        <Package size={30} aria-hidden="true" />
        <h3>No hay pedidos disponibles ahora</h3>
        <p>
          Aparecen cuando una tienda de tu provincia confirma un pedido con
          envío.
        </p>
      </div>
    );
  return (
    <div className="dz-list">
      {list.data.map(j => (
        <article key={j.orderId} className="dz-card">
          <h3>Pedido {j.number}</h3>
          <p>
            <MapPin size={14} aria-hidden="true" /> Recoger en{" "}
            <strong>{j.storeName}</strong> ({j.pickupCity}) · Entregar en{" "}
            {j.dropCity}
          </p>
          <p className="dz-earning">Ganas {usd(j.earningCents)}</p>
          <button
            className="btn btn-gold"
            disabled={take.isPending}
            onClick={async () => {
              try {
                await take.mutateAsync({ orderId: j.orderId });
                await Promise.all([
                  utils.dispatch.available.invalidate(),
                  utils.dispatch.mine.invalidate(),
                ]);
                toast.success("¡Pedido tomado! Ve a recogerlo.");
                onTaken();
              } catch (error) {
                toast.error(errorText(error));
                utils.dispatch.available.invalidate();
              }
            }}
          >
            Tomar pedido
          </button>
        </article>
      ))}
    </div>
  );
}

/** Mientras haya pedidos en camino, manda la posición cada 15 s. */
function useLiveSharing(orderIds: number[], on: boolean) {
  const ping = trpc.dispatch.ping.useMutation();
  const last = useRef(0);
  const ids = orderIds.join(",");
  useEffect(() => {
    if (!on || !ids || !("geolocation" in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      pos => {
        const now = Date.now();
        if (now - last.current < DISPATCH_PING_MS) return;
        last.current = now;
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        for (const orderId of ids.split(",").map(Number))
          ping.mutate({ orderId, point }, { onError: () => undefined });
      },
      () =>
        toast.error(
          "No pudimos leer tu ubicación. Revisa el permiso de ubicación."
        ),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ids]);
}

function Go({ to, label }: { to: Point | null; label: string }) {
  if (!to) return <span className="cz-map-hint">Sin punto en el mapa.</span>;
  const l = directionsLinks(to);
  return (
    <span className="cz-map-actions">
      {label}:
      <a
        className="btn btn-outline"
        href={l.google}
        target="_blank"
        rel="noopener noreferrer"
      >
        Google Maps
      </a>
      <a
        className="btn btn-outline"
        href={l.waze}
        target="_blank"
        rel="noopener noreferrer"
      >
        Waze
      </a>
    </span>
  );
}

function MyJobs() {
  const utils = trpc.useUtils();
  const jobs = trpc.dispatch.mine.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const release = trpc.dispatch.release.useMutation();
  const deliver = trpc.dispatch.deliver.useMutation();
  const [sharing, setSharing] = useState(true);
  const [uploading, setUploading] = useState<number | null>(null);
  const onTheWay = (jobs.data ?? [])
    .filter(j => j.status === "shipped")
    .map(j => j.orderId);
  useLiveSharing(onTheWay, sharing);

  async function refresh() {
    await Promise.all([
      utils.dispatch.mine.invalidate(),
      utils.dispatch.earnings.invalidate(),
    ]);
  }
  async function sendPhoto(orderId: number, file: File) {
    setUploading(orderId);
    try {
      const r = await fetch(`/api/dispatch/${orderId}/photo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type, "x-cz-request": "1" },
        body: file,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No se pudo subir la foto");
      await refresh();
      toast.success("Foto guardada. Ahora toca «Entregado».");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setUploading(null);
    }
  }

  if (jobs.isLoading) return <p role="status">Cargando tus entregas…</p>;
  if (!jobs.data?.length)
    return (
      <div className="admin-empty">
        <Package size={30} aria-hidden="true" />
        <h3>No tienes entregas en curso</h3>
        <p>Toma un pedido en «Disponibles».</p>
      </div>
    );
  return (
    <div className="dz-list">
      {onTheWay.length > 0 && (
        <label className="dz-share">
          <input
            type="checkbox"
            checked={sharing}
            onChange={e => setSharing(e.target.checked)}
          />
          Compartir mi ubicación en vivo con el comprador (cada 15 segundos,
          solo mientras llevo el pedido)
        </label>
      )}
      {jobs.data.map(j => (
        <article key={j.orderId} className="dz-card">
          <header className="dz-card-head">
            <h3>Pedido {j.number}</h3>
            <span
              className={`dz-badge ${j.status === "shipped" ? "dz-badge--go" : ""}`}
            >
              {j.status === "shipped" ? "En camino" : "Por recoger"}
            </span>
          </header>
          <p className="dz-earning">
            Ganas {usd(j.earningCents)} · {j.items} artículo
            {j.items === 1 ? "" : "s"}
          </p>
          <DeliveryMap
            pickup={j.pickup.point}
            drop={j.drop.point}
            label={`Ruta del pedido ${j.number}`}
          />
          <div className="dz-stops">
            <div>
              <h4>1. Recoger</h4>
              <p>
                <strong>{j.pickup.name}</strong> · {j.pickup.city}
              </p>
              {j.pickup.phone && (
                <p>
                  <Phone size={14} aria-hidden="true" />{" "}
                  <a href={`tel:${j.pickup.phone}`}>{j.pickup.phone}</a>
                </p>
              )}
              <Go to={j.pickup.point} label="Ir a la tienda" />
            </div>
            <div>
              <h4>2. Entregar</h4>
              <p>
                <strong>{j.drop.name}</strong> · {j.drop.city}
              </p>
              <p>{j.drop.address}</p>
              <p>
                <Phone size={14} aria-hidden="true" />{" "}
                <a href={`tel:${j.drop.phone}`}>{j.drop.phone}</a>
              </p>
              <Go to={j.drop.point} label="Ir al comprador" />
            </div>
          </div>
          {j.status === "confirmed" ? (
            <div className="cz-map-actions">
              <p className="cz-map-hint">
                Cuando la tienda te entregue el pedido, ella toca «Producto
                enviado» y aquí se activa la entrega.
              </p>
              <button
                className="btn btn-outline"
                disabled={release.isPending}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "¿Cancelar este pedido? Volverá a Disponibles para que otro despachador lo tome."
                    )
                  )
                    return;
                  try {
                    await release.mutateAsync({ orderId: j.orderId });
                    await refresh();
                  } catch (error) {
                    toast.error(errorText(error));
                  }
                }}
              >
                Cancelar pedido
              </button>
            </div>
          ) : (
            <div className="dz-deliver">
              {j.photoUrl && (
                <img
                  src={j.photoUrl}
                  alt="Foto de la entrega"
                  className="dz-photo"
                />
              )}
              <label className="btn btn-outline dz-photo-btn">
                <Camera size={16} aria-hidden="true" />{" "}
                {uploading === j.orderId
                  ? "Subiendo…"
                  : j.photoUrl
                    ? "Cambiar foto"
                    : "Tomar foto de la entrega"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  hidden
                  disabled={uploading !== null}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) sendPhoto(j.orderId, file);
                  }}
                />
              </label>
              <button
                className="btn btn-gold"
                disabled={!j.photoUrl || deliver.isPending}
                onClick={async () => {
                  try {
                    await deliver.mutateAsync({ orderId: j.orderId });
                    await refresh();
                    toast.success("¡Entregado! Tu ganancia quedó registrada.");
                  } catch (error) {
                    toast.error(errorText(error));
                  }
                }}
              >
                <CheckCircle2 size={16} aria-hidden="true" /> Entregado
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function Earnings() {
  const e = trpc.dispatch.earnings.useQuery();
  if (e.isLoading) return <p role="status">Cargando ganancias…</p>;
  const d = e.data;
  if (!d) return null;
  return (
    <>
      <div className="dz-totals">
        <div>
          <small>Este mes</small>
          <strong>{usd(d.monthCents)}</strong>
        </div>
        <div>
          <small>Por cobrar</small>
          <strong>{usd(d.unpaidCents)}</strong>
        </div>
        <div>
          <small>Total ganado</small>
          <strong>{usd(d.totalCents)}</strong>
        </div>
      </div>
      {!d.deliveries.length ? (
        <div className="admin-empty">
          <Wallet size={30} aria-hidden="true" />
          <h3>Todavía no tienes entregas</h3>
        </div>
      ) : (
        <table className="dz-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Tienda</th>
              <th>Entregado</th>
              <th>Ganancia</th>
              <th>Pago</th>
            </tr>
          </thead>
          <tbody>
            {d.deliveries.map(r => (
              <tr key={r.orderId}>
                <td>{r.number}</td>
                <td>{r.storeName}</td>
                <td>
                  {r.deliveredAt
                    ? new Date(r.deliveredAt).toLocaleDateString("es-PA")
                    : "—"}
                </td>
                <td>{usd(r.earningCents)}</td>
                <td>{r.paid ? "Pagado" : "Pendiente"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
