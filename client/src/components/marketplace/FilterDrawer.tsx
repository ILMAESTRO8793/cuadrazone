import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Cuántos filtros tienen valor (sin contar la búsqueda de texto). */
export function countActiveFilters(values: Record<string, unknown>): number {
  return Object.entries(values).filter(
    ([key, value]) =>
      key !== "q" && value !== "" && value !== null && value !== undefined && value !== false
  ).length;
}

/*
 * Filtros compactos: a la vista solo quedan la búsqueda y el botón «Filtros»
 * (los elementos marcados con la clase `filter-keep`); el resto se despliega
 * al pulsarlo. Funciona igual en la web y en la app.
 */
export default function FilterDrawer({
  active,
  children,
  className = "",
}: {
  active: number;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`filter-drawer ${open ? "is-open" : ""} ${className}`}>
      <button
        type="button"
        className="filter-toggle"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Filtros
        {active > 0 && (
          <span className="filter-count" aria-label={`${active} activos`}>
            {active}
          </span>
        )}
        <ChevronDown size={15} aria-hidden="true" className="filter-chevron" />
      </button>
      {children}
    </div>
  );
}
