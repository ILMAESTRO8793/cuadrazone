import { Check, Sparkles, Store } from "lucide-react";
import { Link } from "wouter";
import { VerificationStars } from "@/components/marketplace/VerificationStars";
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
              <>
                <div className="plan-stars">
                  <VerificationStars size={22} />
                  <span>Estrellas de verificación</span>
                </div>
                <p className="plan-pending-note">
                  Cada estrella se otorga solo con acreditación real. No
                  garantiza ventas ni primer puesto permanente.
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
        La verificación de identidad es obligatoria para ambos. Las cinco
        estrellas de verificación (roja, amarilla, morada, azul y verde)
        requieren acreditación real y autorización institucional vigente: la
        confianza no se compra.
      </p>
      <p>
        Con Mayor Visibilidad, tus publicaciones aparecen en la franja{" "}
        <strong>Destacados</strong> arriba del Mercado, Tiendas, Servicios y
        Eventos cuando cumplen los filtros de quien busca, identificadas como{" "}
        <strong>ubicación de pago</strong>. La franja rota cada 10 minutos entre
        las tiendas destacadas: no se promete una primera posición permanente.
        Además, tu tienda puede salir en los banners de publicidad de la
        portada. La prueba gratis no incluye destacados ni publicidad.
      </p>
      <p>
        El envío e impuestos aplicables se informan por separado. La comisión
        por venta se calcula sobre los productos y los boletos; los servicios y
        las citas no pagan comisión.
      </p>
    </section>
  );
}
