import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AuthGate } from "./AuthGate";
import { SellerPlanCards, PlanConditions } from "./SellerPlanCards";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PLAN_CATALOG_VERSION,
  PLAN_ACTIVATION_NOTICE,
  sellerPlanIdInput,
  sellerPlanLabel,
  getSellerPlan,
  type SellerPlanId,
} from "@shared/pricing";

function PlanContent() {
  const search = useSearch();
  const proposed = sellerPlanIdInput.safeParse(
    new URLSearchParams(search).get("plan")
  );
  const preference = trpc.membership.plan.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const membership = trpc.membership.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const save = trpc.membership.plan.select.useMutation();
  const utils = trpc.useUtils();
  const [choice, setChoice] = useState<SellerPlanId>(
    proposed.success ? proposed.data : "normal"
  );
  const [confirm, setConfirm] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    const value = sellerPlanIdInput.safeParse(
      new URLSearchParams(search).get("plan")
    );
    if (value.success) setChoice(value.data);
    else if (preference.data) setChoice(preference.data.planId);
  }, [search, preference.data]);
  const selectedPlan = getSellerPlan(choice);
  async function persist() {
    if (!acknowledged || preference.isLoading || preference.error) return;
    try {
      await save.mutateAsync({
        planId: choice,
        catalogVersion: PLAN_CATALOG_VERSION,
        expectedRevision: preference.data?.revision ?? 0,
        acknowledgePending: true,
      });
      await Promise.all([
        utils.membership.plan.get.invalidate(),
        utils.membership.me.invalidate(),
      ]);
      setConfirm(false);
      setAcknowledged(false);
      toast.success("Preferencia de plan guardada", {
        description: "No se cobró dinero ni se activaron beneficios.",
      });
    } catch (error) {
      setConfirm(false);
      setAcknowledged(false);
      toast.error("No se pudo guardar el plan", {
        description:
          error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
      await preference.refetch();
    }
  }
  if (preference.isLoading)
    return (
      <div className="member-page container">
        <p role="status">Consultando tu plan guardado…</p>
      </div>
    );
  if (preference.error)
    return (
      <div className="member-page container">
        <section className="member-card" role="alert">
          <h1>No pudimos cargar tu plan</h1>
          <p>{preference.error.message}</p>
          <button
            className="btn btn-outline"
            onClick={() => preference.refetch()}
          >
            Reintentar
          </button>
        </section>
      </div>
    );
  return (
    <div className="market-page plans-page">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/vendedor">Mi negocio</Link>
          <span>/</span>
          <strong>Mi plan</strong>
        </div>
        <div className="page-intro">
          <div>
            <p className="eyebrow">SELECCIÓN PRIVADA</p>
            <h1>Elige el plan de tu negocio.</h1>
            <p className="intro-copy">
              Tu cuenta de comprador sigue siendo gratuita. Esta selección se
              guarda para tu cuenta, no activa una suscripción.
            </p>
          </div>
        </div>
        <div className="notice-panel">
          <div>
            <strong>
              {preference.data
                ? `Preferencia guardada: ${getSellerPlan(preference.data.planId).name} · ${sellerPlanLabel(preference.data.planId)}/mes`
                : "Todavía no has guardado una preferencia de plan."}
            </strong>
            <p>{PLAN_ACTIVATION_NOTICE}</p>
          </div>
        </div>
        <SellerPlanCards
          selected={choice}
          disabled={save.isPending}
          onChoose={id => {
            setChoice(id);
            setAcknowledged(false);
          }}
        />
        <section className="plan-save-bar">
          <div>
            <strong>
              {selectedPlan.name} · {sellerPlanLabel(choice)}/mes
            </strong>
            <p>Guardar no modifica pagos ni autorizaciones.</p>
          </div>
          <button
            className="btn btn-gold"
            disabled={save.isPending || preference.data?.planId === choice}
            onClick={() => {
              setConfirm(true);
              setAcknowledged(false);
            }}
          >
            Revisar y guardar preferencia
          </button>
        </section>
        <PlanConditions />
        <Link className="btn btn-outline" href="/solicitud-vendedor">
          {membership.data?.application
            ? "Continuar mi solicitud"
            : "Crear solicitud de vendedor"}
        </Link>
        <Dialog
          open={confirm}
          onOpenChange={open => {
            if (!save.isPending) setConfirm(open);
          }}
        >
          <DialogContent className="cz-demo-dialog">
            <DialogTitle>Guardar {selectedPlan.name}</DialogTitle>
            <DialogDescription>
              Importe mensual del plan: {sellerPlanLabel(choice)}. Es una
              preferencia, no una contratación ni un pago. No se cobran ambos
              planes ni se elimina el Normal.
            </DialogDescription>
            <p>{PLAN_ACTIVATION_NOTICE}</p>
            <label className="plan-confirm-check">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
              />
              Entiendo que los cobros, la prioridad y la acreditación están
              pendientes; esta acción solo guarda mi preferencia.
            </label>
            <button
              className="btn btn-gold"
              disabled={!acknowledged || save.isPending}
              onClick={() => void persist()}
            >
              {save.isPending ? "Guardando…" : "Guardar sin realizar cobro"}
            </button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
export function SellerPlanPage() {
  return (
    <AuthGate>
      <PlanContent />
    </AuthGate>
  );
}
