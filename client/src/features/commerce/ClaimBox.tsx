import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  CLAIM_RESPONSE_HOURS,
  claimReasonLabels,
  claimReasons,
  claimResolutionLabels,
  claimStatusLabels,
  type ClaimReason,
} from "@shared/claims";
import { trpc } from "@/lib/trpc";
import "./claims.css";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";
const when = (iso: string) =>
  new Intl.DateTimeFormat("es-PA", {
    timeZone: "America/Panama",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

/** Etapa 6 · Reclamo de un pedido: el comprador lo abre y el vendedor responde. */
export function ClaimBox({ orderId }: { orderId: number }) {
  const utils = trpc.useUtils();
  const data = trpc.claims.forOrder.useQuery({ orderId }, { retry: false });
  const open = trpc.claims.open.useMutation();
  const respond = trpc.claims.respond.useMutation();
  const withdraw = trpc.claims.withdraw.useMutation();
  const [form, setForm] = useState<{
    reason: ClaimReason;
    description: string;
  } | null>(null);
  const [response, setResponse] = useState("");
  const refresh = () => void utils.claims.forOrder.invalidate({ orderId });

  if (!data.data) return null;
  const { role, claim, canOpen } = data.data;

  if (!claim) {
    if (!canOpen) return null;
    return (
      <section className="live-panel claim-box">
        {!form ? (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setForm({ reason: "not_received", description: "" })}
          >
            <AlertTriangle size={16} /> Tengo un problema con este pedido
          </button>
        ) : (
          <form
            className="claim-form"
            onSubmit={async e => {
              e.preventDefault();
              try {
                await open.mutateAsync({ orderId, ...form });
                toast.success(
                  `Reclamo enviado. El vendedor tiene ${CLAIM_RESPONSE_HOURS} horas para responder.`
                );
                setForm(null);
                refresh();
              } catch (error) {
                toast.error(errorText(error));
              }
            }}
          >
            <h2>Abrir un reclamo</h2>
            <p className="re-muted re-small">
              Antes, intenta resolverlo escribiéndole al vendedor. Si no se
              arregla, el vendedor tendrá {CLAIM_RESPONSE_HOURS} horas para
              responder y CuadraZone decidirá.
            </p>
            <label>
              ¿Qué pasó?
              <select
                value={form.reason}
                onChange={e =>
                  setForm({ ...form, reason: e.target.value as ClaimReason })
                }
              >
                {claimReasons.map(r => (
                  <option key={r} value={r}>
                    {claimReasonLabels[r]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cuéntanos los detalles
              <textarea
                value={form.description}
                onChange={e =>
                  setForm({ ...form, description: e.target.value })
                }
                minLength={20}
                maxLength={2000}
                required
                placeholder="Qué recibiste, cuándo, qué le pediste al vendedor…"
              />
            </label>
            <div className="claim-actions">
              <button
                className="btn btn-gold"
                type="submit"
                disabled={open.isPending}
              >
                {open.isPending ? "Enviando…" : "Enviar reclamo"}
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setForm(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>
    );
  }

  return (
    <section className={`live-panel claim-box claim-box--${claim.status}`}>
      <h2>
        {claim.status === "resolved" ? (
          <CheckCircle2 size={18} />
        ) : (
          <AlertTriangle size={18} />
        )}{" "}
        Reclamo · {claimReasonLabels[claim.reason]}
      </h2>
      <p className="claim-status">
        <strong>
          {claim.status === "resolved" && claim.resolution
            ? claimResolutionLabels[claim.resolution]
            : claimStatusLabels[claim.status]}
        </strong>
        {claim.status === "open" &&
          (claim.overdue
            ? " · El vendedor no respondió a tiempo; CuadraZone decidirá."
            : ` · Plazo del vendedor: ${when(claim.respondBy)}`)}
      </p>
      <blockquote>
        <span>Comprador</span>
        {claim.description}
      </blockquote>
      {claim.sellerResponse && (
        <blockquote>
          <span>Vendedor</span>
          {claim.sellerResponse}
        </blockquote>
      )}
      {claim.resolutionNote && (
        <blockquote className="is-admin">
          <span>Decisión de CuadraZone</span>
          {claim.resolutionNote}
        </blockquote>
      )}
      {role === "seller" && claim.status !== "resolved" && (
        <form
          className="claim-form"
          onSubmit={async e => {
            e.preventDefault();
            try {
              await respond.mutateAsync({ claimId: claim.id, response });
              toast.success("Respuesta enviada. CuadraZone revisará el caso.");
              setResponse("");
              refresh();
            } catch (error) {
              toast.error(errorText(error));
            }
          }}
        >
          <label>
            {claim.sellerResponse
              ? "Agregar o corregir tu respuesta"
              : "Tu respuesta"}
            <textarea
              value={response}
              onChange={e => setResponse(e.target.value)}
              minLength={10}
              maxLength={2000}
              required
              placeholder="Explica qué pasó y qué ofreces: reenvío, cambio o devolución del dinero."
            />
          </label>
          <button
            className="btn btn-gold"
            type="submit"
            disabled={respond.isPending}
          >
            {respond.isPending ? "Enviando…" : "Responder"}
          </button>
        </form>
      )}
      {role === "buyer" && claim.status !== "resolved" && (
        <button
          type="button"
          className="btn btn-outline"
          disabled={withdraw.isPending}
          onClick={async () => {
            if (
              !window.confirm(
                "¿Retirar el reclamo? Úsalo si ya se resolvió con el vendedor."
              )
            )
              return;
            try {
              await withdraw.mutateAsync({ claimId: claim.id });
              toast.success("Reclamo retirado");
              refresh();
            } catch (error) {
              toast.error(errorText(error));
            }
          }}
        >
          Ya se resolvió: retirar reclamo
        </button>
      )}
    </section>
  );
}
