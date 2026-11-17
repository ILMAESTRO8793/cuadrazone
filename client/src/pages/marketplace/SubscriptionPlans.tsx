import {
  ANNUAL_DISCOUNT_PCT,
  ANNUAL_MONTHS,
  listingPlanAmountCents,
  PLAN_ACTIVATION_NOTICE,
  sectionPlanIds,
  sectionPlanInfo,
  listingRange,
  listingUnits,
  type ListingSection,
  moneyLabel,
  trialOfferLabel,
} from "@shared/pricing";
import { Check, Info, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Link, useSearch } from "wouter";
import {
  SellerPlanCards,
  PlanConditions,
  type PlanSection,
} from "@/features/membership/SellerPlanCards";

/** Formulario donde se publica el primer anuncio de cada sección. */
const listingForms: Record<ListingSection, string> = {
  inmuebles: "/bienes-raices/mis-anuncios?nuevo=1",
  alquileres: "/bienes-raices/mis-anuncios?nuevo=1",
  autos: "/autos/mis-anuncios?nuevo=1",
  autosventa: "/autos/mis-anuncios?nuevo=1",
  empleos: "/empleos/mis-vacantes?nuevo=1",
};

/** Planes de una sección de anuncios (Bienes raíces, Autos o Empleos). */
function ListingPlans({ section }: { section: ListingSection }) {
  const [cycle, setCycle] = useState<"mensual" | "anual">("mensual");
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
      {sectionPlanIds(section).map(id => {
        const plan = sectionPlanInfo(section, id)!;
        const annual = listingPlanAmountCents(id, ANNUAL_MONTHS);
        const saved = plan.monthlyCents * ANNUAL_MONTHS - annual;
        return (
          <article className="plan-card seller-plan-card" key={id}>
            <div className="plan-kicker">
              {`${listingRange(id, section)} ${listingUnits[section]}`}
            </div>
            <h2>{plan.name}</h2>
            {cycle === "mensual" ? (
              <>
                <div className="plan-price">
                  <strong>{moneyLabel(plan.monthlyCents)}</strong>
                  <span>/ mes</span>
                </div>
                <p className="plan-annual">
                  o <strong>{moneyLabel(annual)} al año</strong> con{" "}
                  {ANNUAL_DISCOUNT_PCT} % de descuento
                </p>
              </>
            ) : (
              <>
                <div className="plan-price">
                  <strong>{moneyLabel(annual)}</strong>
                  <span>/ año</span>
                </div>
                <p className="plan-annual">
                  Equivale a <strong>{moneyLabel(Math.floor(annual / ANNUAL_MONTHS))} al mes</strong>.
                  Ahorras {moneyLabel(saved)} frente a pagar mes a mes.
                </p>
              </>
            )}
            <ul>
              <li>
                <Check size={16} aria-hidden="true" />
                {`${listingRange(id, section)} ${listingUnits[section]} ${section === "empleos" ? "publicadas al mes" : section === "alquileres" || section === "autosventa" ? "publicados al mes" : "publicados"}`}
              </li>
              <li>
                <Check size={16} aria-hidden="true" />
                Sin comisión
              </li>
            </ul>
            <Link href={listingForms[section]} className="btn btn-gold btn-wide">
              Elegir {plan.name}
            </Link>
          </article>
        );
      })}
    </div>
    </>
  );
}

const sections: [PlanSection, string][] = [
  ["comercios", "Comercios"],
  ["servicios", "Servicios"],
  ["restaurantes", "Restaurantes"],
  ["inmuebles", "Bienes raíces"],
  ["autos", "Autos"],
  ["empleos", "Empleos"],
];

export function SubscriptionsPage() {
  // La sección se puede abrir directo: /suscripciones?seccion=restaurantes
  const search = useSearch();
  const fromUrl = new URLSearchParams(search).get("seccion");
  const [section, setSection] = useState<PlanSection>(
    sections.some(([id]) => id === fromUrl)
      ? (fromUrl as PlanSection)
      : "comercios"
  );
  const choose = (id: PlanSection) => {
    setSection(id);
    window.history.replaceState(null, "", `/suscripciones?seccion=${id}`);
  };
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

        <div className="plans-sections" role="tablist" aria-label="¿Qué quieres publicar?">
          {sections.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              className={section === id ? "is-active" : ""}
              onClick={() => choose(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {section === "comercios" && <SellerPlanCards storeKind="comercio" />}
        {section === "servicios" && <SellerPlanCards storeKind="servicios" />}
        {section === "restaurantes" && (
          <SellerPlanCards storeKind="restaurante" />
        )}
        {section === "inmuebles" && (
          <>
            {/* Venta y alquiler tienen planes separados. */}
            <h2 className="plans-group-title">Inmuebles en venta</h2>
            <ListingPlans section="inmuebles" />
            <h2 className="plans-group-title">Inmuebles en alquiler</h2>
            <ListingPlans section="alquileres" />
          </>
        )}
        {section === "autos" && (
          <>
            {/* Venta y alquiler tienen planes separados. */}
            <h2 className="plans-group-title">Autos en venta</h2>
            <ListingPlans section="autosventa" />
            <h2 className="plans-group-title">Autos en alquiler</h2>
            <ListingPlans section="autos" />
          </>
        )}
        {section === "empleos" && <ListingPlans section="empleos" />}

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
        <PlanConditions section={section} />
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
