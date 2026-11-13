import { Link } from "wouter";
import { Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import FeaturedStrip from "./FeaturedStrip";
import { StoreLogo } from "./StoreLogo";
import { StoreStars } from "./VerificationStars";
import "./featured.css";

/**
 * «Destacados» de /mercado: solo los productos que un administrador activó
 * para tiendas con Service Pub pagado y plan Mayor Visibilidad. Cada tarjeta
 * muestra la foto, la tienda y sus cinco estrellas.
 */
export function FeaturedPicks() {
  const q = trpc.servicePub.featured.useQuery(undefined, { staleTime: 60_000 });
  const picks = q.data ?? [];
  return (
    <FeaturedStrip className="featured-strip--photo" count={picks.length}>
      {picks.map(p => (
        <article key={p.id} className="fp-card">
          <Link
            href={`/articulo/${p.slug}`}
            className="fp-photo"
            aria-label={p.title}
          >
            {p.imageUrl ? (
              <img src={p.imageUrl} alt="" loading="lazy" />
            ) : (
              <Package size={36} aria-hidden="true" />
            )}
          </Link>
          <Link href={`/tiendas/${p.store.slug}`} className="fp-store">
            <StoreLogo
              name={p.store.name}
              logoUrl={p.store.logoUrl}
              size={20}
            />
            <span>{p.store.name}</span>
          </Link>
          <StoreStars slug={p.store.slug} size={14} />
        </article>
      ))}
    </FeaturedStrip>
  );
}

/** «Destacados» de /servicios: mismas reglas y la misma tarjeta (foto, tienda, estrellas). */
export function FeaturedServicePicks() {
  const q = trpc.servicePub.featuredServices.useQuery(undefined, { staleTime: 60_000 });
  const picks = q.data ?? [];
  return (
    <FeaturedStrip className="featured-strip--photo" count={picks.length}>
      {picks.map(p => (
        <article key={p.id} className="fp-card">
          <Link href={`/servicio/${p.slug}`} className="fp-photo" aria-label={p.title}>
            {p.imageUrl ? (
              <img src={p.imageUrl} alt="" loading="lazy" />
            ) : (
              <Package size={36} aria-hidden="true" />
            )}
          </Link>
          <Link href={`/tiendas/${p.store.slug}`} className="fp-store">
            <StoreLogo name={p.store.name} logoUrl={p.store.logoUrl} size={20} />
            <span>{p.store.name}</span>
          </Link>
          <StoreStars slug={p.store.slug} size={14} />
        </article>
      ))}
    </FeaturedStrip>
  );
}
