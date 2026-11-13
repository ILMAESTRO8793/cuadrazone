import { Link } from "wouter";
import { UtensilsCrossed } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { StoreLogo } from "@/components/marketplace/StoreLogo";
import "./restaurant.css";

const usd = (c: number) => `US$${(c / 100).toFixed(2)}`;

/** Franja «Comida de restaurantes» en /mercado: cada plato lleva al menú de su restaurante. */
export function RestaurantDishesStrip() {
  const q = trpc.menu.dishes.useQuery(undefined, { staleTime: 60_000 });
  if (!q.data?.length) return null;
  return (
    <section className="rm-strip" aria-labelledby="rm-strip-title">
      <h2 id="rm-strip-title">
        <UtensilsCrossed size={20} aria-hidden="true" /> Comida de restaurantes
      </h2>
      <div className="rm-strip-track">
        {q.data.map(d => (
          <Link
            key={d.id}
            href={`/tiendas/${d.store.slug}#menu`}
            className="rm-strip-card"
          >
            <span className="rm-strip-photo">
              {d.imageUrl ? (
                <img src={d.imageUrl} alt="" loading="lazy" />
              ) : (
                <UtensilsCrossed size={28} aria-hidden="true" />
              )}
            </span>
            <strong>{d.name}</strong>
            <span className="rm-strip-store">
              <StoreLogo
                name={d.store.name}
                logoUrl={d.store.logoUrl}
                size={18}
              />{" "}
              {d.store.name}
            </span>
            <b>
              {d.fromPrice ? `Desde ${usd(d.priceCents)}` : usd(d.priceCents)}
            </b>
          </Link>
        ))}
      </div>
    </section>
  );
}
