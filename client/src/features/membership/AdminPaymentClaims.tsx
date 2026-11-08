// «Pagos por revisar»: avisos «Ya pagué» de los vendedores. El administrador
// mira el comprobante, confirma que el dinero llegó y lo aprueba (el pago se
// registra solo y la tienda se activa o se extiende) o lo rechaza con un motivo.
import { useState } from "react";
import { toast } from "sonner";
import { conceptLabels, platformMethodLabels } from "@shared/billing";
import { getSellerPlan, type SellerPlanId } from "@shared/pricing";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { DocumentViewer } from "./DocumentViewer";

const money = (cents: number) => `US$${(cents / 100).toFixed(2)}`;
const day = (value: Date | string) =>
  new Date(value).toLocaleDateString("es-PA", {
    timeZone: "America/Panama",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function AdminPaymentClaims({
  enabled,
  onChanged,
}: {
  enabled: boolean;
  onChanged: () => void;
}) {
  const claims = trpc.membership.billing.claims.useQuery(
    { status: "pending" },
    { enabled }
  );
  const utils = trpc.useUtils();
  const refresh = async () => {
    await utils.membership.billing.claims.invalidate();
    onChanged();
  };

  if (claims.isLoading) return <p role="status">Cargando pagos por revisar…</p>;
  if (claims.error)
    return (
      <p className="member-error" role="alert">
        {claims.error.message}
      </p>
    );
  const rows = claims.data ?? [];

  return (
    <div className="admin-claims">
      <div className="admin-list-heading">
        <h2>
          Pagos por revisar{" "}
          {rows.length > 0 && (
            <span className="admin-claims__count">{rows.length}</span>
          )}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="member-muted">
          No hay avisos de pago pendientes. Cuando un vendedor pulse «Ya pagué»,
          aparecerá aquí.
        </p>
      ) : (
        <ul className="admin-claims__list">
          {rows.map(claim => (
            <ClaimRow key={claim.id} claim={claim} onDone={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}

type Claim =
  inferRouterOutputs<AppRouter>["membership"]["billing"]["claims"][number];

function ClaimRow({
  claim,
  onDone,
}: {
  claim: Claim;
  onDone: () => Promise<void>;
}) {
  const approve = trpc.membership.billing.approve.useMutation();
  const reject = trpc.membership.billing.reject.useMutation();
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const busy = approve.isPending || reject.isPending;

  const doApprove = async () => {
    try {
      await approve.mutateAsync({ claimId: claim.id });
      toast.success("Pago aprobado", {
        description: `${claim.sellerName}: ${money(claim.amountCents)} registrado.`,
      });
      await onDone();
    } catch (error) {
      toast.error("No se pudo aprobar", {
        description:
          error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
      setConfirming(false);
    }
  };
  const doReject = async () => {
    try {
      await reject.mutateAsync({ claimId: claim.id, reason: reason.trim() });
      toast.success("Aviso rechazado", {
        description: "El vendedor recibirá el motivo por correo.",
      });
      await onDone();
    } catch (error) {
      toast.error("No se pudo rechazar", {
        description:
          error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
    }
  };

  return (
    <li className="admin-claim">
      <div className="admin-claim__summary">
        <strong>{claim.sellerName}</strong>
        <span className="admin-claim__amount">{money(claim.amountCents)}</span>
        <small>
          {conceptLabels[claim.concept]} · {platformMethodLabels[claim.method]}{" "}
          · comprobante <strong>{claim.reference}</strong> · pagado el{" "}
          {day(`${claim.paidOn}T12:00:00Z`)}
        </small>
        <small>
          {claim.subscriptionCents > 0 &&
            `Mensualidad: ${claim.months} × ${getSellerPlan(claim.planId as SellerPlanId).name} = ${money(claim.subscriptionCents)}. `}
          {claim.commissionCents > 0 &&
            `Comisión de meses cerrados: ${money(claim.commissionCents)}. `}
          Enviado el {day(claim.createdAt)}.
        </small>
        {claim.note && <small>Nota: {claim.note}</small>}
      </div>
      <div className="admin-claim__actions">
        <DocumentViewer
          document={{
            id: claim.id,
            fileName: claim.receiptName,
            mimeType: claim.receiptMime,
          }}
          src={`/api/billing/claims/${claim.id}/receipt`}
          label="Ver comprobante"
        />
        {!confirming && !rejecting && (
          <>
            <button
              type="button"
              className="member-button member-button--gold member-button--small"
              onClick={() => setConfirming(true)}
              disabled={busy}
            >
              Aprobar
            </button>
            <button
              type="button"
              className="member-button member-button--outline member-button--small"
              onClick={() => setRejecting(true)}
              disabled={busy}
            >
              Rechazar
            </button>
          </>
        )}
      </div>
      {confirming && (
        <div
          className="admin-claim__confirm"
          role="group"
          aria-label="Confirmar aprobación"
        >
          <p>
            ¿Confirmaste en {platformMethodLabels[claim.method]} que llegaron{" "}
            <strong>{money(claim.amountCents)}</strong> con el comprobante{" "}
            <strong>{claim.reference}</strong>?
          </p>
          <button
            type="button"
            className="member-button member-button--gold member-button--small"
            onClick={doApprove}
            disabled={busy}
          >
            {approve.isPending ? "Aprobando…" : "Sí, el dinero llegó"}
          </button>
          <button
            type="button"
            className="member-button member-button--outline member-button--small"
            onClick={() => setConfirming(false)}
            disabled={busy}
          >
            Cancelar
          </button>
        </div>
      )}
      {rejecting && (
        <div className="admin-claim__confirm">
          <label className="member-field">
            <span>Motivo del rechazo (lo verá el vendedor)</span>
            <input
              value={reason}
              onChange={event => setReason(event.target.value)}
              maxLength={500}
              placeholder="Ej.: no encontramos ese comprobante en Yappy"
            />
          </label>
          <button
            type="button"
            className="member-button member-button--outline member-button--small"
            onClick={doReject}
            disabled={busy || reason.trim().length < 5}
          >
            {reject.isPending ? "Rechazando…" : "Rechazar aviso"}
          </button>
          <button
            type="button"
            className="member-button member-button--outline member-button--small"
            onClick={() => setRejecting(false)}
            disabled={busy}
          >
            Cancelar
          </button>
        </div>
      )}
    </li>
  );
}
