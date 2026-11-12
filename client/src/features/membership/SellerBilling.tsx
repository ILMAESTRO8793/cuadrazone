// Panel «Pagar a CuadraZone» del vendedor: cuánto debe (mensualidad y comisión),
// los datos de pago de CuadraZone (Yappy, transferencia, tarjeta) y el aviso
// «Ya pagué» con su comprobante. Un administrador confirma cada aviso.
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  CreditCard,
  Landmark,
  Receipt,
  Smartphone,
} from "lucide-react";
import {
  conceptLabels,
  PLATFORM_PAYMENT_METHODS,
  platformMethodLabels,
  type PaymentConcept,
  type PlatformPaymentMethod,
} from "@shared/billing";
import { MAX_DOCUMENT_BYTES } from "@shared/membership";
import {
  getSellerPlan,
  planAmountCents,
  sellerPlanIds,
  type SellerPlanId,
} from "@shared/pricing";
import { trpc } from "@/lib/trpc";
import { authFetch } from "@/lib/authFetch";

const money = (cents: number) => `US$${(cents / 100).toFixed(2)}`;
const longDay = (value: Date | string) =>
  new Date(value).toLocaleDateString("es-PA", {
    timeZone: "America/Panama",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const todayInPanama = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
const claimStatusText = {
  pending: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
} as const;

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };
  return (
    <div className="billing-copy">
      <span>{label}</span>
      <strong>{value}</strong>
      <button
        type="button"
        className="member-button member-button--outline member-button--small"
        onClick={copy}
        aria-label={`Copiar ${label.toLowerCase()}`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

export function SellerBilling() {
  const billing = trpc.membership.billing.mine.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const data = billing.data;

  if (billing.isLoading)
    return (
      <p role="status" className="member-muted">
        Consultando lo que tienes por pagar…
      </p>
    );
  if (billing.error)
    return (
      <p className="member-notice member-notice--error" role="alert">
        {billing.error.message}{" "}
        <button
          type="button"
          className="member-inline-link"
          onClick={() => billing.refetch()}
        >
          Reintentar
        </button>
      </p>
    );
  if (!data) return null;

  const { subscription, commission, platform } = data;
  const heldForCommission =
    subscription.status === "past_due" &&
    subscription.holdReason === "commission";
  const hasAnyMethod = Boolean(
    platform.yappy || platform.bank || platform.cardUrl
  );

  return (
    <section className="billing" aria-labelledby="billing-title">
      <h2 id="billing-title">Pagar a CuadraZone</h2>

      {heldForCommission && (
        <p className="member-notice member-notice--error" role="alert">
          <strong>Tu tienda está oculta porque la comisión venció.</strong> Paga
          la comisión y avísanos abajo: la volvemos a mostrar en cuanto
          confirmemos el pago.
        </p>
      )}

      <div className="billing-due">
        <div>
          <span>Mensualidad · {getSellerPlan(data.chosenPlanId).name}</span>
          <strong>{money(data.monthlyCents)}</strong>
          <small>
            al mes
            {subscription.endsAt
              ? ` · tu tienda está pagada hasta el ${longDay(subscription.endsAt)}`
              : ""}
          </small>
        </div>
        <div
          className={commission.dueCents > 0 ? "billing-due--alert" : undefined}
        >
          <span>Comisión por pagar</span>
          <strong>{money(commission.dueCents)}</strong>
          <small>
            {commission.dueCents > 0 && commission.deadline
              ? `de ${commission.dueCount} ${commission.dueCount === 1 ? "pedido" : "pedidos"} · fecha límite: ${longDay(commission.deadline.suspendAt)}`
              : "No tienes comisión vencida."}
          </small>
        </div>
        <div>
          <span>Comisión de este mes</span>
          <strong>{money(commission.accruingCents)}</strong>
          <small>Se cobra al cerrar el mes. Tienes 15 días para pagarla.</small>
        </div>
      </div>

      <h3>Formas de pago</h3>
      {hasAnyMethod ? (
        <div className="billing-methods">
          {platform.yappy && (
            <article className="billing-method">
              <Smartphone size={22} aria-hidden="true" />
              <h4>Yappy</h4>
              <CopyValue label="Yappy" value={platform.yappy.number} />
              {platform.yappy.name && (
                <p className="member-muted">
                  A nombre de {platform.yappy.name}.
                </p>
              )}
              <p className="member-muted">
                En el mensaje del Yappy escribe el nombre de tu tienda.
              </p>
            </article>
          )}
          {platform.bank && (
            <article className="billing-method">
              <Landmark size={22} aria-hidden="true" />
              <h4>Transferencia bancaria</h4>
              <CopyValue label="Banco" value={platform.bank.bank} />
              <CopyValue
                label={
                  platform.bank.accountType
                    ? `Cuenta de ${platform.bank.accountType.toLowerCase()}`
                    : "Cuenta"
                }
                value={platform.bank.account}
              />
              <CopyValue label="Titular" value={platform.bank.holder} />
            </article>
          )}
          {platform.cardUrl && (
            <article className="billing-method">
              <CreditCard size={22} aria-hidden="true" />
              <h4>Tarjeta de crédito o débito</h4>
              <p className="member-muted">
                Pagas en la página segura de la pasarela de pago. CuadraZone
                nunca ve ni guarda los datos de tu tarjeta.
              </p>
              <a
                className="member-button member-button--gold"
                href={platform.cardUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pagar con tarjeta
              </a>
            </article>
          )}
        </div>
      ) : (
        <p className="member-notice">
          Pronto verás aquí los datos de pago de CuadraZone.
          {platform.whatsapp && (
            <>
              {" "}
              Mientras tanto, escríbenos por{" "}
              <a
                className="member-inline-link"
                href={`https://wa.me/${platform.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              .
            </>
          )}
        </p>
      )}

      {data.hasPendingClaim ? (
        <p className="member-notice member-notice--info" role="status">
          Tu aviso de pago está en revisión. Te escribiremos por correo cuando
          lo confirmemos.
        </p>
      ) : (
        <PaymentClaimForm
          chosenPlanId={data.chosenPlanId}
          commissionDueCents={commission.dueCents}
          onSent={() => utils.membership.billing.mine.invalidate()}
        />
      )}

      {data.claims.length > 0 && (
        <>
          <h3>Tus avisos de pago</h3>
          <ul className="billing-claims">
            {data.claims.map(claim => (
              <li key={claim.id}>
                <div>
                  <strong>{money(claim.amountCents)}</strong> ·{" "}
                  {conceptLabels[claim.concept]} ·{" "}
                  {platformMethodLabels[claim.method]}
                  <small>
                    Pagado el {longDay(`${claim.paidOn}T12:00:00Z`)} ·
                    comprobante {claim.reference}
                  </small>
                  {claim.status === "rejected" && claim.rejectReason && (
                    <small className="billing-claims__reason">
                      Motivo: {claim.rejectReason}
                    </small>
                  )}
                </div>
                <em
                  className={`member-status ${claim.status === "approved" ? "member-status--ok" : claim.status === "pending" ? "member-status--pending" : "billing-status--rejected"}`}
                >
                  {claimStatusText[claim.status]}
                </em>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PaymentClaimForm({
  chosenPlanId,
  commissionDueCents,
  onSent,
}: {
  chosenPlanId: SellerPlanId;
  commissionDueCents: number;
  onSent: () => void;
}) {
  const owesCommission = commissionDueCents > 0;
  const [open, setOpen] = useState(false);
  const [concept, setConcept] = useState<PaymentConcept>(
    owesCommission ? "both" : "subscription"
  );
  const [planId, setPlanId] = useState<SellerPlanId>(chosenPlanId);
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<PlatformPaymentMethod>("yappy");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayInPanama());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => {
    const subscription =
      concept === "commission"
        ? 0
        : planAmountCents(planId, months);
    const commission = concept === "subscription" ? 0 : commissionDueCents;
    return subscription + commission;
  }, [concept, planId, months, commissionDueCents]);

  if (!open)
    return (
      <div className="billing-claim-cta">
        <p>
          ¿Ya hiciste el pago? Avísanos con tu comprobante y lo confirmamos.
        </p>
        <button
          type="button"
          className="member-button member-button--gold"
          onClick={() => setOpen(true)}
        >
          <Receipt size={16} aria-hidden="true" /> Ya pagué
        </button>
      </div>
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!file) return setError("Adjunta la captura o el PDF del comprobante.");
    if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES)
      return setError("El comprobante debe pesar como máximo 5 MiB.");
    setSending(true);
    try {
      const meta = {
        concept,
        method,
        reference: reference.trim(),
        paidOn,
        note: note.trim(),
        ...(concept === "commission" ? {} : { planId, months }),
      };
      const response = await authFetch("/api/billing/claims", {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type,
          "X-CZ-Filename": encodeURIComponent(file.name),
          "X-CZ-Claim": encodeURIComponent(JSON.stringify(meta)),
        },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || "No se pudo enviar el aviso de pago.");
      }
      toast.success("Aviso enviado", {
        description: "Revisaremos tu comprobante y te avisaremos por correo.",
      });
      setOpen(false);
      onSent();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo enviar el aviso de pago."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="member-form billing-claim-form"
      onSubmit={submit}
      aria-labelledby="claim-title"
    >
      <h3 id="claim-title">Avisar que ya pagué</h3>
      <fieldset className="billing-concepts">
        <legend>¿Qué pagaste?</legend>
        {(
          [
            "subscription",
            ...(owesCommission ? (["commission", "both"] as const) : []),
          ] as PaymentConcept[]
        ).map(value => (
          <label key={value}>
            <input
              type="radio"
              name="concept"
              value={value}
              checked={concept === value}
              onChange={() => setConcept(value)}
            />
            {conceptLabels[value]}
          </label>
        ))}
      </fieldset>
      {concept !== "commission" && (
        <div className="member-form-grid">
          <label className="member-field">
            <span>Plan</span>
            <select
              value={planId}
              onChange={event => setPlanId(event.target.value as SellerPlanId)}
            >
              {sellerPlanIds.map(id => (
                <option key={id} value={id}>
                  {getSellerPlan(id).name} ·{" "}
                  {money(getSellerPlan(id).monthlyCents)}/mes
                </option>
              ))}
            </select>
          </label>
          <label className="member-field">
            <span>Meses</span>
            <select
              value={months}
              onChange={event => setMonths(Number(event.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>
                  {n === 12 ? "1 año (12 meses) · 10 % de descuento" : `${n} ${n === 1 ? "mes" : "meses"}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="member-form-grid">
        <label className="member-field">
          <span>Cómo pagaste</span>
          <select
            value={method}
            onChange={event =>
              setMethod(event.target.value as PlatformPaymentMethod)
            }
          >
            {PLATFORM_PAYMENT_METHODS.map(value => (
              <option key={value} value={value}>
                {platformMethodLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="member-field">
          <span>Número de comprobante</span>
          <input
            value={reference}
            onChange={event => setReference(event.target.value)}
            required
            minLength={3}
            maxLength={120}
            autoComplete="off"
          />
          <small>
            El número que aparece en la confirmación de Yappy, del banco o de la
            pasarela.
          </small>
        </label>
        <label className="member-field">
          <span>Fecha del pago</span>
          <input
            type="date"
            value={paidOn}
            max={todayInPanama()}
            onChange={event => setPaidOn(event.target.value)}
            required
          />
        </label>
        <label className="member-field">
          <span>Comprobante</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={event => setFile(event.target.files?.[0] ?? null)}
            required
          />
          <small>Captura o PDF, hasta 5 MiB.</small>
        </label>
      </div>
      <label className="member-field">
        <span>Nota (opcional)</span>
        <input
          value={note}
          onChange={event => setNote(event.target.value)}
          maxLength={500}
        />
      </label>
      <p className="billing-total">
        Total a confirmar: <strong>{money(total)}</strong>
        {concept !== "subscription" && (
          <small> · la comisión incluye solo los meses ya cerrados</small>
        )}
      </p>
      {error && (
        <p className="member-notice member-notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="member-form-actions">
        <button
          type="submit"
          className="member-button member-button--gold"
          disabled={sending}
        >
          {sending ? "Enviando…" : "Enviar aviso"}
        </button>
        <button
          type="button"
          className="member-button member-button--outline"
          onClick={() => setOpen(false)}
          disabled={sending}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
