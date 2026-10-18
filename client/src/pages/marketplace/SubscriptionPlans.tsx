import { PLAN_ACTIVATION_NOTICE } from "@shared/pricing";
import { Info, ShoppingBag } from "lucide-react";
import { Link } from "wouter";
import {
  SellerPlanCards,
  PlanConditions,
} from "@/features/membership/SellerPlanCards";

export function SubscriptionsPage() {
  return (
    <div className="market-page plans-page">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <strong>Planes y precios</strong>
        </div>
        <div className="page-intro">
          <div>
            <p className="eyebrow">TU NEGOCIO, TU PLAN</p>
            <h1>
              Normal o Mayor Visibilidad.
              <br />
              Tú eliges cómo crecer.
            </h1>
            <p className="intro-copy">
              Dos planes para vendedores. El Normal sigue disponible y los
              compradores no pagan mensualidad.{" "}
              <strong>0% de comisión propia de CuadraZone.</strong>
            </p>
          </div>
          <span className="demo-badge">
            Selección disponible · sin cobros activos
          </span>
        </div>
        <SellerPlanCards />
        <section
          className="plan-buyer-strip"
          aria-labelledby="buyer-free-title"
        >
          <ShoppingBag size={28} aria-hidden="true" />
          <div>
            <p className="eyebrow">PARA COMPRADORES</p>
            <h2 id="buyer-free-title">Cuenta gratuita · Gratis</h2>
            <p>
              Descubre productos y tiendas sin cuota mensual. Pagas lo que
              adquieres y los cargos de cada compra cuando corresponda.
            </p>
          </div>
          <Link href="/mi-cuenta" className="btn btn-outline">
            Crear o abrir mi cuenta
          </Link>
        </section>
        <div className="notice-panel">
          <Info size={20} aria-hidden="true" />
          <div>
            <strong>Elegir no es pagar ni activar una tienda</strong>
            <p>
              {PLAN_ACTIVATION_NOTICE} Primero debes completar la verificación;
              la pasarela y la facturación recurrente siguen pendientes.
            </p>
          </div>
        </div>
        <PlanConditions />
        <section className="plan-steps">
          <h2>Tu recorrido como vendedor</h2>
          <ol>
            <li>Elige y guarda tu preferencia de plan.</li>
            <li>
              Completa el perfil, categorías y documentos de tu solicitud.
            </li>
            <li>
              La administración revisa la identificación y contactos
              verificados.
            </li>
            <li>
              Cuando la pasarela esté habilitada, confirma la contratación y el
              pago para activar los beneficios disponibles.
            </li>
          </ol>
          <Link href="/solicitud-vendedor" className="text-link">
            Preparar mi solicitud
          </Link>
        </section>
      </div>
    </div>
  );
}
