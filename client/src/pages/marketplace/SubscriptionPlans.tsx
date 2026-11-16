import {
  LISTING_PLANS,
  PLAN_ACTIVATION_NOTICE,
  listingPlanIds,
  listingSectionLabels,
  listingSections,
  listingUnits,
  moneyLabel,
  trialOfferLabel,
} from "@shared/pricing";
import { Check, Info, ShoppingBag } from "lucide-react";
import { Link } from "wouter";
import {
  SellerPlanCards,
  PlanConditions,
} from "@/features/membership/SellerPlanCards";

/** Planes de Bienes raíces, Autos y Empleos: cada sección se paga aparte. */
function ListingPlans() {
  return (
    <div className="plan-grid seller-plan-grid">
      {listingPlanIds.map(id => {
        const plan = LISTING_PLANS[id];
        return (
          <article className="plan-card seller-plan-card" key={id}>
            <div className="plan-kicker">{plan.range} anuncios</div>
            <h2>{plan.name}</h2>
            <div className="plan-price">
              <strong>{moneyLabel(plan.monthlyCents)}</strong>
              <span>/ mes por sección</span>
            </div>
            <ul>
              {listingSections.map(section => (
                <li key={section}>
                  <Check size={16} aria-hidden="true" />
                  {listingSectionLabels[section]}: {plan.range.toLowerCase()}{" "}
                  {listingUnits[section]}
                </li>
              ))}
              <li>
                <Check size={16} aria-hidden="true" />
                Sin comisión
              </li>
            </ul>
          </article>
        );
      })}
    </div>
  );
}

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
              Un plan según tu tamaño.
              <br />
              Tú eliges cómo crecer.
            </h1>
            <p className="intro-copy">
              Planes para pymes, empresas medianas y grandes empresas; los
              compradores no pagan nada. <strong>{trialOfferLabel()}.</strong>{" "}
              Después pagas la mensualidad del plan. La comisión por venta es
              solo para comercios y restaurantes: 10%, 5% o 3% según el plan.{" "}
              <strong>
                Servicios, bienes raíces, autos y empleos no pagan comisión.
              </strong>
            </p>
          </div>
          <span className="demo-badge">{trialOfferLabel()}</span>
        </div>

        <h2 className="plans-group-title">Comercios</h2>
        <SellerPlanCards storeKind="comercio" />

        <h2 className="plans-group-title">Servicios</h2>
        <SellerPlanCards storeKind="servicios" />

        <h2 className="plans-group-title">Restaurantes</h2>
        <SellerPlanCards storeKind="restaurante" />

        <h2 className="plans-group-title">Bienes raíces, Autos y Empleos</h2>
        <p className="intro-copy">
          Cada sección se paga aparte, según cuántos anuncios tienes publicados
          en ella. La primera vez que publicas en una sección empieza tu mes
          gratis.
        </p>
        <ListingPlans />

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
            <strong>Elegir no es pagar</strong>
            <p>
              {PLAN_ACTIVATION_NOTICE} Primero debes completar la verificación.
              Los pagos se hacen por Yappy, transferencia o efectivo y nuestro
              equipo los confirma; el cobro automático en línea llegará más
              adelante.
            </p>
          </div>
        </div>
        <PlanConditions />
        <section className="plan-steps">
          <h2>Tu recorrido como vendedor</h2>
          <ol>
            <li>Elige si eres comercio, servicios o restaurante.</li>
            <li>Elige y guarda tu preferencia de plan.</li>
            <li>
              Completa el perfil, categorías y documentos de tu solicitud.
            </li>
            <li>
              La administración revisa la identificación y contactos
              verificados.
            </li>
            <li>
              Al ser aprobado, tu tienda se activa con tu tiempo gratis y sin
              comisión.
            </li>
            <li>
              Antes de que termine, paga tu primera mensualidad; desde entonces
              se cobra la comisión de tu plan en productos y pedidos de
              restaurante.
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
