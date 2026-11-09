import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { FEATURED_NOTE, FEATURED_TITLE } from "@shared/featured";
import "./featured.css";

/**
 * Franja «Destacados» del plan Mayor Visibilidad, arriba de cada lista. Se
 * identifica siempre como ubicación de pago. Sin destacados no se muestra.
 */
export default function FeaturedStrip({
  count,
  children,
  className = "",
}: {
  count: number;
  children: ReactNode;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <section
      className={`featured-strip ${className}`}
      aria-label={`${FEATURED_TITLE}: ${FEATURED_NOTE}`}
    >
      <header className="featured-strip-head">
        <span className="featured-strip-title">
          <Star size={16} aria-hidden="true" /> {FEATURED_TITLE}
        </span>
        <span className="featured-strip-note">{FEATURED_NOTE}</span>
      </header>
      <div className="featured-strip-grid">{children}</div>
    </section>
  );
}
