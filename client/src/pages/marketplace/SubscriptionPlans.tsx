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
              Dos planes para vendedores; los compradores no pagan nada.{" "}
              <strong>Los primeros 3 meses son gratis.</strong> Después pagas
              la mensualidad del plan. Si vendes productos físicos, pagas 8% de
              comisión por venta durante la prueba y 5% después, siempre sin el
              envío. <strong>Los servicios no pagan comisión.</strong>
            </p>
          </div>
          <span className="demo-badge">
            3 meses gratis al ser aprobado
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
            <li>Elige y guarda tu preferencia de plan.</li>
            <li>
              Completa el perfil, categorías y documentos de tu solicitud.
            </li>
            <li>
              La administración revisa la identificación y contactos
              verificados.
            </li>
            <li>
              Al ser aprobado, tu tienda se activa con 3 meses gratis (los
              productos físicos pagan 8% de comisión por venta).
            </li>
            <li>
              Antes de que termine la prueba, paga tu primera mensualidad; desde
              entonces la comisión de productos baja a 5%. Los servicios siguen
              sin comisión.
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
