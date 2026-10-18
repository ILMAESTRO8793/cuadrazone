import { Check, Sparkles, Store } from "lucide-react";
import { Link } from "wouter";
import {
  sellerPlanIds,
  getSellerPlan,
  sellerPlanLabel,
  type SellerPlanId,
} from "@shared/pricing";

export function SellerPlanCards({
  selected,
  disabled,
  onChoose,
}: {
  selected?: SellerPlanId;
  disabled?: boolean;
  onChoose?: (id: SellerPlanId) => void;
}) {
  return (
    <div className="plan-grid seller-plan-grid">
      {sellerPlanIds.map(id => {
        const plan = getSellerPlan(id);
        return (
          <article
            className={`plan-card seller-plan-card ${id === "mayor_visibilidad" ? "plan-card--visibility" : ""} ${selected === id ? "plan-card--selected" : ""}`}
            key={id}
          >
            <div className="plan-kicker">
              {id === "normal" ? (
                <Store size={18} aria-hidden="true" />
              ) : (
                <Sparkles size={18} aria-hidden="true" />
              )}
              {id === "normal"
                ? "Tu espacio para vender"
                : "Más exposición para tu negocio"}
            </div>
            <h2>{plan.name}</h2>
            <div className="plan-price">
              <strong>{sellerPlanLabel(id)}</strong>
              <span>/ mes</span>
            </div>
            <p>{plan.description}</p>
            <ul>
              {plan.benefits.map(item => (
                <li key={item}>
                  <Check size={16} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            {id === "mayor_visibilidad" && (
              <p className="plan-pending-note">
                Destaque y emblemas pendientes de habilitación. No garantiza
                ventas ni primer puesto permanente.
              </p>
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
  );
}

export function PlanConditions() {
  return (
    <section
      className="plan-conditions"
      aria-labelledby="plan-conditions-title"
    >
      <h2 id="plan-conditions-title">Dos opciones, una sola mensualidad</h2>
      <p>
        El Normal permanece disponible. Cada tienda elige un plan; no se suman
        US$19.99 y US$39.99. Cambiar tu preferencia no cambia una suscripción
        cobrada.
      </p>
      <p>
        La verificación de identidad es obligatoria para ambos. Los cuatro
        emblemas Cuadrangulares requieren acreditación real y autorización
        institucional vigente: la confianza no se compra.
      </p>
      <p>
        Los espacios destacados serán rotativos por categoría y se identificarán
        como <strong>Destacado — ubicación de pago</strong>. No se promete una
        primera posición permanente.
      </p>
      <p>
        Servicios, citas y boletos siguen pendientes de sus fases. Tarifas de
        pasarela, envío e impuestos aplicables se informarán por separado. No
        hay cobros activos ni prioridad comercial habilitada todavía.
      </p>
    </section>
  );
}
