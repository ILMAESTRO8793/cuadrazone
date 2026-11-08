import { LiveFeatured } from "@/features/commerce/LiveFeatured";
import { sellerPlanLabel } from "@shared/pricing";
import { useState } from "react";
import { Link } from "wouter";
import { countries, type CountryCode } from "@shared/countries";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";

/**
 * Foto de cada entrada de la portada (decorativa: el título ya la describe).
 * Las de la primera fila se ven al abrir la página, así que cargan enseguida;
 * las demás esperan a que se acerquen a la pantalla.
 */
function GatePhoto({ name, eager = false }: { name: string; eager?: boolean }) {
  return (
    <span className="gate-photo" aria-hidden="true">
      <img
        src={`/assets/portada/${name}.webp`}
        srcSet={`/assets/portada/${name}-640.webp 640w, /assets/portada/${name}.webp 1200w`}
        // En el celular la foto es una miniatura de 112px a la izquierda.
        sizes="(min-width: 1100px) 33vw, (min-width: 700px) 50vw, 112px"
        alt=""
        width={1200}
        height={900}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
      />
    </span>
  );
}

export default function Home() {
  return (
    <>
      <div className="gate-band">
        <section className="gate container" aria-labelledby="gate-title">
          <div className="gate-grid">
            <div className="gate-main">
              <div className="eyebrow">
                <span className="tiny-gold-dot" /> BIENVENIDO A CUADRAZONE
              </div>
              <h1 id="gate-title">¿Qué estás buscando hoy?</h1>
              <p className="gate-copy">
                Emprendedores de Panamá en un espacio con valores cristianos.
                Elige por dónde quieres empezar.
              </p>
              <CountryPicker />
              <div className="gate-choices">
                <Link
                  href="/mercado"
                  className="gate-choice gate-choice--market"
                >
                  <GatePhoto name="comercios" eager />
                  <span className="gate-text">
                    <strong>COMERCIOS</strong>
                    <span className="gate-detail">
                      Productos, artesanías, ropa, tecnología y libros
                      cristianos de tiendas verificadas.
                    </span>
                  </span>
                  <span className="gate-arrow" aria-hidden="true">
                    <ArrowRight size={26} />
                  </span>
                </Link>
                <Link
                  href="/servicios"
                  className="gate-choice gate-choice--services"
                >
                  <GatePhoto name="servicios" eager />
                  <span className="gate-text">
                    <strong>SERVICIOS</strong>
                    <span className="gate-detail">
                      Clases, tutorías, trabajos a domicilio, consultas
                      profesionales y eventos.
                    </span>
                  </span>
                  <span className="gate-arrow" aria-hidden="true">
                    <ArrowRight size={26} />
                  </span>
                </Link>
                <Link
                  href="/bienes-raices"
                  className="gate-choice gate-choice--estate"
                >
                  <GatePhoto name="bienes-raices" eager />
                  <span className="gate-text">
                    <strong>BIENES RAÍCES</strong>
                    <span className="gate-detail">
                      Casas, apartamentos, terrenos y locales en venta o
                      alquiler.
                    </span>
                  </span>
                  <span className="gate-arrow" aria-hidden="true">
                    <ArrowRight size={26} />
                  </span>
                </Link>
                <Link href="/autos" className="gate-choice gate-choice--cars">
                  <GatePhoto name="autos" />
                  <span className="gate-text">
                    <strong>AUTOS</strong>
                    <span className="gate-detail">
                      Compra, venta y alquiler de autos y motos.
                    </span>
                  </span>
                  <span className="gate-arrow" aria-hidden="true">
                    <ArrowRight size={26} />
                  </span>
                </Link>
                <Link href="/empleos" className="gate-choice gate-choice--jobs">
                  <GatePhoto name="empleo" />
                  <span className="gate-text">
                    <strong>BUSCAR EMPLEO</strong>
                    <span className="gate-detail">
                      Crea tu CV, aplica a vacantes o publica un empleo.
                    </span>
                  </span>
                  <span className="gate-arrow" aria-hidden="true">
                    <ArrowRight size={26} />
                  </span>
                </Link>
                <Link href="/vender" className="gate-choice gate-choice--store">
                  <GatePhoto name="crear-tienda" />
                  <span className="gate-text">
                    <strong>CREAR TU TIENDA</strong>
                    <span className="gate-detail">
                      Vende tus productos u ofrece tus servicios. Los primeros 3
                      meses son gratis.
                    </span>
                  </span>
                  <span className="gate-arrow" aria-hidden="true">
                    <ArrowRight size={26} />
                  </span>
                </Link>
              </div>
              <div className="hero-small gate-small">
                <span>
                  <ShieldCheck size={16} /> Verificación de vendedores
                </span>
                <span>
                  <Check size={15} /> 3 meses gratis para vendedores
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div className="featured-band">
        <LiveFeatured />
      </div>
      <section className="community-values">
        <div className="container values-inner">
          <div>
            <ShieldCheck size={28} strokeWidth={1.4} />
            <span>
              <strong>Confianza desde el inicio</strong>
              <small>Un proceso de verificación para quienes venden.</small>
            </span>
          </div>
          <div>
            <Store size={28} strokeWidth={1.4} />
            <span>
              <strong>Más para tu emprendimiento</strong>
              <small>Empieza con 3 meses sin mensualidad.</small>
            </span>
          </div>
          <div>
            <Truck size={28} strokeWidth={1.4} />
            <span>
              <strong>Conectados en Panamá</strong>
              <small>Envío, retiro o servicio a domicilio.</small>
            </span>
          </div>
        </div>
      </section>
      <section className="seller-invite container">
        <div className="seller-invite-icon">
          <Store size={38} strokeWidth={1.3} />
          <Sparkles size={18} />
        </div>
        <div>
          <span className="eyebrow">TU TRABAJO MERECE SER VISTO</span>
          <h2>Abre nuevas puertas para tu negocio.</h2>
          <p>
            Tu tienda por{" "}
            <strong>Normal {sellerPlanLabel("normal")}/mes</strong> o{" "}
            <strong>
              Mayor Visibilidad {sellerPlanLabel("mayor_visibilidad")}/mes
            </strong>
            . Los primeros 3 meses son gratis. Los productos físicos pagan 8% de
            comisión por venta en la prueba y 5% después; los servicios no pagan
            comisión.
          </p>
        </div>
        <Link className="btn btn-gold" href="/vender">
          Quiero ser vendedor <ArrowRight size={17} />
        </Link>
      </section>
      <section className="buyer-invite container">
        <div>
          <span className="eyebrow">SIN CUOTA DE COMPRADOR</span>
          <h2>
            Cuando encuentres lo tuyo,
            <br />
            da el siguiente paso.
          </h2>
          <p>
            Tu cuenta de comprador será gratuita. Compra productos, reserva
            servicios y adquiere boletos sin pagar una cuota mensual.
          </p>
          <Link className="text-link" href="/suscripciones">
            Conoce cómo funciona <ArrowRight size={15} />
          </Link>
        </div>
        <div className="membership-card">
          <span>COMPRADOR CUADRAZONE</span>
          <div>
            <strong>Gratis</strong>
            <small>sin mensualidad</small>
          </div>
          <p>
            Una cuenta gratuita.
            <br />
            Muchas formas de conectar.
          </p>
          <div>
            <Check size={16} /> Productos, servicios y eventos
          </div>
          <span className="membership-small">
            Cobros no activos en esta vista previa
          </span>
        </div>
      </section>
    </>
  );
}

/** Elegir país: Panamá entra directo; en los demás se deja el correo para el aviso. */
function CountryPicker() {
  const [country, setCountry] = useState<CountryCode>("PA");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const selected = countries.find(c => c.code === country)!;
  async function join(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cz-request": "1" },
        body: JSON.stringify({ email, country }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
      setState("done");
      setMessage(
        `¡Listo! Te avisaremos cuando CuadraZone llegue a ${data.country}.`
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar."
      );
    }
  }
  return (
    <div className="country-picker">
      <label className="country-select">
        <span>¿En qué país estás?</span>
        <select
          value={country}
          onChange={event => {
            setCountry(event.target.value as CountryCode);
            setState("idle");
            setMessage("");
          }}
        >
          {countries.map(c => (
            <option key={c.code} value={c.code}>
              {c.name}
              {c.active ? "" : " · Próximamente"}
            </option>
          ))}
        </select>
      </label>
      {!selected.active && (
        <div
          className="country-waitlist"
          role="region"
          aria-label={`Aviso para ${selected.name}`}
        >
          <p>
            <strong>CuadraZone todavía no está en {selected.name}.</strong>{" "}
            Déjanos tu correo y te avisamos cuando abra.
          </p>
          {state === "done" ? (
            <p className="country-done" role="status">
              {message}
            </p>
          ) : (
            <form onSubmit={join}>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                aria-label="Tu correo"
                autoComplete="email"
              />
              <button
                className="btn btn-gold"
                type="submit"
                disabled={state === "sending"}
              >
                {state === "sending" ? "Enviando…" : "Avísame"}
              </button>
            </form>
          )}
          {state === "error" && (
            <p className="country-error" role="alert">
              {message}
            </p>
          )}
          <p className="country-note">
            Mientras tanto puedes ver lo que hay en Panamá.
          </p>
        </div>
      )}
    </div>
  );
}
