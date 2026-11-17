import { useState } from "react";
import { Check, Sparkles, Store } from "lucide-react";
import { Link } from "wouter";
import { VerificationStars } from "@/components/marketplace/VerificationStars";
import {
  getSellerPlan,
  isFeaturedPlan,
  plansForStoreKind,
  SERVICE_PLAN_BENEFITS,
  sellerPlanLabel,
  sellerPlanAnnualLabel,
  planAmountCents,
  ANNUAL_DISCOUNT_PCT,
  type SellerPlanId,
} from "@shared/pricing";

/** Frase corta arriba de cada plan. */
const kicker: Record<SellerPlanId, string> = {
  normal: "Pymes · tu espacio para vender",
  mayor_visibilidad: "Pymes · más exposición",
  mediana: "Empresas medianas",
  grande: "Grandes empresas",
  rest_basico: "Pymes · hasta 20 platos",
  rest_medio: "Mediana empresa · de 21 a 100 platos",
  rest_grande: "Gran empresa · más de 100 platos",
};

export function SellerPlanCards({
  selected,
  disabled,
  onChoose,
  storeKind,
}: {
  selected?: SellerPlanId;
  disabled?: boolean;
  onChoose?: (id: SellerPlanId) => void;
  /** Tipo de tienda: comercio, servicios o restaurante. */
  storeKind?: string | null;
}) {
  const ids = plansForStoreKind(storeKind);
  const [cycle, setCycle] = useState<"mensual" | "anual">("mensual");
  const money = (cents: number) => `US${(cents / 100).toFixed(2)}`;
  return (
    <>
    <div className="plan-cycle" role="radiogroup" aria-label="Forma de pago">
      <button type="button" role="radio" aria-checked={cycle === "mensual"} className={cycle === "mensual" ? "is-active" : ""} onClick={() => setCycle("mensual")}>
        Pago mensual
      </button>
      <button type="button" role="radio" aria-checked={cycle === "anual"} className={cycle === "anual" ? "is-active" : ""} onClick={() => setCycle("anual")}>
        Pago anual <span>−{ANNUAL_DISCOUNT_PCT} %</span>
      </button>
    </div>
    <div className="plan-grid seller-plan-grid">
      {ids.map(id => {
        const plan = getSellerPlan(id);
        const annual = planAmountCents(id, 12);
        const saved = plan.monthlyCents * 12 - annual;
        return (
          <article
            className={`plan-card seller-plan-card ${isFeaturedPlan(id) ? "plan-card--visibility" : ""} ${selected === id ? "plan-card--selected" : ""}`}
            key={id}
          >
            <div className="plan-kicker">
              {isFeaturedPlan(id) ? (
                <Sparkles size={18} aria-hidden="true" />
              ) : (
                <Store size={18} aria-hidden="true" />
              )}
              {kicker[id]}
            </div>
            <h2>{plan.name}</h2>
            {cycle === "mensual" ? (
              <>
                <div className="plan-price">
                  <strong>{sellerPlanLabel(id)}</strong>
                  <span>/ mes</span>
                </div>
                <p className="plan-annual">
                  o <strong>{sellerPlanAnnualLabel(id)} al año</strong> con{" "}
                  {ANNUAL_DISCOUNT_PCT} % de descuento
                </p>
              </>
            ) : (
              <>
                <div className="plan-price">
                  <strong>{sellerPlanAnnualLabel(id)}</strong>
                  <span>/ año</span>
                </div>
                <p className="plan-annual">
                  Equivale a <strong>{money(Math.floor(annual / 12))} al mes</strong>.
                  Ahorras {money(saved)} frente a pagar mes a mes.
                </p>
              </>
            )}
            <p>{plan.description}</p>
            <ul>
              {(
                (storeKind === "servicios" && SERVICE_PLAN_BENEFITS[id]) ||
                plan.benefits
              ).map(item => (
                <li key={item}>
                  <Check size={16} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            {isFeaturedPlan(id) && (
              <>
                <div className="plan-stars">
                  <span>Las cinco estrellas de verificación</span>
                </div>
                <VerificationStars size={22} labeled />
                <p className="plan-stars-why">
                  Las estrellas le dicen al comprador que tu tienda es de
                  confianza: más credibilidad, más ganas de comprarte.
                </p>
                <p className="plan-pending-note">
                  Con {plan.name} se ven las cinco estrellas en tu tienda y en
                  tus anuncios. No garantiza ventas ni primer puesto permanente.
                </p>
              </>
            )}
            {onChoose ? (
              <button
                className={`btn ${selected === id ? "btn-outline" : "btn-gold"} btn-wide`}
                type="button"
                disabled={disabled}
                aria-pressed={selected === id}
                onClick={() => onChoose(id)}
              >
                {selected === id
                  ? "Opción seleccionada"
                  : `Seleccionar ${plan.name}`}
              </button>
            ) : (
              <Link
                href={`/solicitud-vendedor?tipo=${storeKind ?? "comercio"}&plan=${id}`}
                className="btn btn-gold btn-wide"
              >
                Elegir {plan.name}
              </Link>
            )}
            <small className="plan-selection-note">
              Solo selección de preferencia; no se realiza un cobro.
            </small>
          </article>
        );
      })}
    </div>
    </>
  );
}

/** Sección de planes que la persona está mirando. */
export type PlanSection =
  | "comercios"
  | "servicios"
  | "restaurantes"
  | "inmuebles"
  | "autos"
  | "empleos";

/** Sección según el tipo de tienda del vendedor. */
export function planSectionForStoreKind(kind: string | null | undefined): PlanSection {
  if (kind === "servicios") return "servicios";
  if (kind === "restaurante") return "restaurantes";
  return "comercios";
}

const anuncios: Record<"inmuebles" | "autos" | "empleos", [string, string]> = {
  inmuebles: ["Bienes raíces", "cuántos inmuebles tienes publicados"],
  autos: ["Autos", "cuántos vehículos tienes publicados"],
  empleos: ["Empleos", "cuántas vacantes tienes publicadas"],
};

/** Condiciones del plan, solo de la sección que la persona va a escoger. */
export function PlanConditions({ section }: { section: PlanSection }) {
  const tope =
    "Al llegar al tope de tu plan no puedes publicar más hasta que subes de plan.";
  const verificacion =
    "La verificación de identidad es obligatoria. Cambiar tu preferencia de plan no cambia una suscripción ya cobrada.";
  let title = "";
  let parts: React.ReactNode[] = [];
  if (section === "comercios") {
    title = "Cómo funciona el plan de Comercios";
    parts = [
      <>
        El plan depende de cuántos productos publicas: pymes hasta 99
        (Normal o Mayor Visibilidad), empresas medianas de 100 a 300 y grandes
        empresas más de 300. {tope}
      </>,
      <>
        Las cinco estrellas de verificación son de Mayor Visibilidad (al
        pagarlo) y de las empresas medianas y grandes (desde que se registran).
        Con esos planes tus productos también aparecen en la franja{" "}
        <strong>Destacados</strong>, identificados como{" "}
        <strong>ubicación de pago</strong>; la franja rota cada 10 minutos.
      </>,
      <>
        La comisión por venta entregada es de 10% (Normal), 5% (Mayor
        Visibilidad y empresa mediana) o 3% (gran empresa), solo sobre el
        precio de los productos. No hay comisión durante el tiempo gratis. El
        envío se informa por separado.
      </>,
      <>
        Comercios no acepta restaurantes, casas, autos ni vacantes de empleo:
        cada uno tiene su propia sección. {verificacion}
      </>,
    ];
  } else if (section === "servicios") {
    title = "Cómo funciona el plan de Servicios";
    parts = [
      <>
        Con el plan Normal publicas hasta 20 servicios; con Mayor Visibilidad,
        sin límite. {tope}
      </>,
      <>
        Con Mayor Visibilidad tienes las cinco estrellas de verificación y tus
        servicios aparecen en la franja <strong>Destacados</strong>,
        identificados como <strong>ubicación de pago</strong>; la franja rota
        cada 10 minutos.
      </>,
      <>Los servicios y las citas no pagan comisión, solo la mensualidad. {verificacion}</>,
    ];
  } else if (section === "restaurantes") {
    title = "Cómo funciona el plan de Restaurantes";
    parts = [
      <>
        El plan depende de cuántos platos tiene tu menú: pyme hasta 20, mediana
        empresa de 21 a 100 y gran empresa más de 100. {tope}
      </>,
      <>
        Tu restaurante tiene su menú con secciones, tamaños y extras, y recibe
        pedidos a domicilio. Aparece en Restaurantes, no en Comercios.
      </>,
      <>
        La comisión por pedido entregado es de 10% (pyme), 5% (mediana empresa)
        o 3% (gran empresa). No hay comisión durante el tiempo gratis.{" "}
        {verificacion}
      </>,
    ];
  } else {
    const [name, unit] = anuncios[section];
    title = `Cómo funciona el plan de ${name}`;
    parts = [
      <>
        El plan depende de {unit}: hasta 20, de 21 a 100 o más de 100. {tope}
      </>,
      <>
        Este plan es solo para {name}; las otras secciones se pagan aparte. La
        primera vez que publicas empieza tu mes gratis. No necesitas tener
        tienda.
      </>,
      <>{name} no paga comisión, solo la mensualidad.</>,
    ];
  }
  return (
    <section className="plan-conditions" aria-labelledby="plan-conditions-title">
      <h2 id="plan-conditions-title">{title}</h2>
      {parts.map((part, i) => (
        <p key={i}>{part}</p>
      ))}
    </section>
  );
}
