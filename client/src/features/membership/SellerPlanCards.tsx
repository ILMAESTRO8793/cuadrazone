import { useState } from "react";
import { Check, Sparkles, Store } from "lucide-react";
import { Link } from "wouter";
import { VerificationStars } from "@/components/marketplace/VerificationStars";
import {
  getSellerPlan,
  isFeaturedPlan,
  plansForStoreKind,
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
              {plan.benefits.map(item => (
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
                href={`/vendedor/plan?plan=${id}`}
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

export function PlanConditions() {
  return (
    <section
      className="plan-conditions"
      aria-labelledby="plan-conditions-title"
    >
      <h2 id="plan-conditions-title">Un solo plan, según tu tamaño</h2>
      <p>
        Cada tienda elige un plan; los precios no se suman. El plan depende de
        cuánto publicas: pymes hasta 99 productos, empresas medianas de 100 a
        300 y grandes empresas más de 300. En servicios, el plan Normal publica
        hasta 20 servicios y Mayor Visibilidad sin límite. En restaurantes:
        hasta 20 platos (pyme), de 21 a 100 (mediana empresa) o más de 100
        (gran empresa). Al llegar al tope de tu plan, para publicar más subes
        de plan. Cambiar tu preferencia no cambia una suscripción cobrada.
      </p>
      <p>
        La verificación de identidad es obligatoria para todos. Las cinco
        estrellas de verificación son de Mayor Visibilidad (al pagarlo) y de las
        empresas medianas y grandes (desde que se registran). Se ven en tu
        tienda y en todos tus anuncios. Si el plan vence, no se muestran.
      </p>
      <p>
        Con Mayor Visibilidad, empresa mediana o grande, tus publicaciones
        aparecen en la franja{" "}
        <strong>Destacados</strong> arriba del Mercado, Tiendas, Servicios y
        Eventos cuando cumplen los filtros de quien busca, identificadas como{" "}
        <strong>ubicación de pago</strong>. La franja rota cada 10 minutos entre
        las tiendas destacadas: no se promete una primera posición permanente.
        La prueba gratis no incluye destacados. La publicidad personalizada
        (banners hechos a tu medida) no está incluida en ningún plan: es el
        servicio aparte Service Pub, que pides desde «Mi plan».
      </p>
      <p>
        El envío e impuestos aplicables se informan por separado. La comisión
        por venta (10%, 5% o 3% según el plan) se calcula sobre los productos,
        los pedidos de restaurante y los boletos; los servicios, las citas,
        los bienes raíces, los autos y las vacantes no pagan comisión.
      </p>
    </section>
  );
}
