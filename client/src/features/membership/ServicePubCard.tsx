import { useState } from "react";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { SERVICE_PUB_NAME, servicePubStatusLabels } from "@shared/servicePub";
import { trpc } from "@/lib/trpc";

const money = (c: number) => `US$${(c / 100).toFixed(2)}`;
const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Panama",
  }).format(new Date(iso));

/** El vendedor pide (o cancela) Service Pub: publicidad personalizada aparte de su plan. */
export function ServicePubCard() {
  const utils = trpc.useUtils();
  const mine = trpc.servicePub.mine.useQuery(undefined, { retry: false });
  const request = trpc.servicePub.request.useMutation();
  const cancel = trpc.servicePub.cancel.useMutation();
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const d = mine.data;
  if (!d) return null;
  const sub = d.subscription;
  const isOn = sub && (sub.status === "active" || sub.status === "requested");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await request.mutateAsync({ message });
      await utils.servicePub.mine.invalidate();
      setOpen(false);
      toast.success(
        "Pedido enviado. Te escribiremos para coordinar el pago y el diseño."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo enviar el pedido"
      );
    }
  }
  async function stop() {
    if (
      !confirm(
        "¿Cancelar Service Pub? Tu anuncio deja de salir cuando venza lo que ya pagaste."
      )
    )
      return;
    try {
      await cancel.mutateAsync();
      await utils.servicePub.mine.invalidate();
      toast.success("Service Pub cancelado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cancelar"
      );
    }
  }

  return (
    <section className="service-pub-card" aria-labelledby="service-pub-title">
      <div className="service-pub-icon" aria-hidden="true">
        <Megaphone size={24} />
      </div>
      <div className="service-pub-body">
        <h2 id="service-pub-title">
          {SERVICE_PUB_NAME}{" "}
          <span>{money(d.monthlyCents)}/mes · aparte de tu plan</span>
        </h2>
        <p>
          Publicidad hecha a tu medida: diseñamos un banner o un bloque para tu
          tienda, producto o servicio y lo ponemos en la portada y en la vitrina
          de tu sección. Funciona con cualquier plan y lo cancelas cuando
          quieras.
        </p>
        {sub && (
          <p className={`service-pub-status service-pub-status--${sub.status}`}>
            <strong>{servicePubStatusLabels[sub.status]}</strong>
            {sub.status === "active" && sub.activeUntil
              ? ` · hasta el ${dateLabel(sub.activeUntil)}`
              : ""}
            {sub.message ? ` · «${sub.message}»` : ""}
          </p>
        )}
        {!d.eligible ? (
          <p className="service-pub-muted">
            Disponible cuando tu tienda esté aprobada.
          </p>
        ) : open ? (
          <form className="service-pub-form" onSubmit={submit}>
            <label>
              ¿Qué quieres promocionar?
              <textarea
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={500}
                required
                minLength={5}
                placeholder="Ej.: Mis tortas de Navidad, con 15 % de descuento hasta el 24 de diciembre"
              />
            </label>
            <div className="service-pub-actions">
              <button
                className="btn btn-gold"
                type="submit"
                disabled={request.isPending}
              >
                {request.isPending ? "Enviando…" : "Pedir Service Pub"}
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <small className="service-pub-muted">
              No se cobra nada ahora. El equipo de CuadraZone te escribe para el
              pago (Yappy o transferencia) y el diseño.
            </small>
          </form>
        ) : (
          <div className="service-pub-actions">
            <button
              className="btn btn-gold"
              type="button"
              onClick={() => {
                setMessage(sub?.message ?? "");
                setOpen(true);
              }}
            >
              {isOn
                ? "Cambiar lo que quiero promocionar"
                : "Quiero Service Pub"}
            </button>
            {isOn && (
              <button
                className="btn btn-outline"
                type="button"
                disabled={cancel.isPending}
                onClick={() => void stop()}
              >
                Cancelar Service Pub
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
