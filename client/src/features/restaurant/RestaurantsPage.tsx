import { Link } from "wouter";
import { Clock, UtensilsCrossed } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { StoreLogo } from "@/components/marketplace/StoreLogo";
import { StoreStars } from "@/components/marketplace/VerificationStars";
import { RestaurantDishesStrip } from "./RestaurantDishesStrip";
import "./restaurant.css";

/** /restaurantes: todos los restaurantes con menú activo y sus platos. */
export function RestaurantsPage() {
  const q = trpc.menu.restaurants.useQuery(undefined, { staleTime: 60_000 });
  const list = q.data ?? [];
  return (
    <div className="re-page container">
      <h1 className="sr-only">Restaurantes</h1>
      <RestaurantDishesStrip />
      <h2 className="rs-title">
        <UtensilsCrossed size={20} aria-hidden="true" /> Restaurantes
      </h2>
      {q.isLoading && <p role="status">Cargando restaurantes…</p>}
      {!q.isLoading && !list.length && (
        <div className="re-empty">
          <Link
            href="/solicitud-vendedor?tipo=restaurante"
            className="btn btn-gold"
          >
            Registra tu restaurante
          </Link>
        </div>
      )}
      <div className="rs-grid">
        {list.map(r => (
          <Link
            key={r.slug}
            href={`/tiendas/${r.slug}#menu`}
            className="rs-card"
          >
            <span className="rs-photo">
              {r.photoUrl ? (
                <img src={r.photoUrl} alt="" loading="lazy" />
              ) : (
                <UtensilsCrossed size={30} aria-hidden="true" />
              )}
            </span>
            <span className="rs-body">
              <span className="rs-name">
                <StoreLogo name={r.name} logoUrl={r.logoUrl} size={24} />
                <strong>{r.name}</strong>
              </span>
              <StoreStars slug={r.slug} size={13} />
              <small className={r.status.open ? "rs-open" : "rs-closed"}>
                {r.status.open
                  ? `Abierto · cierra a las ${r.status.closesAt}`
                  : `Cerrado${r.status.opensLabel ? ` · abre ${r.status.opensLabel}` : ""}`}
              </small>
              <small>
                <Clock size={12} aria-hidden="true" /> ~{r.prepMinutes} min ·{" "}
                {r.city}, {r.province}
              </small>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
