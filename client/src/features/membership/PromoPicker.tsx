import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { PromoCandidate } from "@shared/showcase";
import { trpc } from "@/lib/trpc";
import { StoreLogo } from "@/components/marketplace/StoreLogo";
import "./promoPicker.css";

const kindLabels = {
  tienda: "Tienda",
  producto: "Producto",
  servicio: "Servicio",
} as const;

/**
 * Escoger qué promocionar sin subir nada: las tiendas destacadas (Mayor
 * Visibilidad) o los productos y servicios publicados. Al tocar uno, llena el
 * formulario con su nombre, su foto y su enlace.
 */
export function PromoPicker({
  initial = "tiendas",
  onPick,
}: {
  initial?: "tiendas" | "items";
  onPick: (c: PromoCandidate) => void;
}) {
  const [kind, setKind] = useState<"tiendas" | "items">(initial);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [onlyFeatured, setOnlyFeatured] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(input), 300);
    return () => clearTimeout(t);
  }, [input]);
  const list = trpc.showcase.adminCandidates.useQuery({
    kind,
    q,
    onlyFeatured,
  });

  return (
    <div className="pp">
      <div className="pp-head">
        <strong>
          <Sparkles size={16} /> Escoger de CuadraZone
        </strong>
        <div className="pp-tabs" role="tablist" aria-label="Qué promocionar">
          <button
            type="button"
            role="tab"
            aria-selected={kind === "tiendas"}
            className={kind === "tiendas" ? "is-active" : ""}
            onClick={() => setKind("tiendas")}
          >
            Tiendas destacadas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "items"}
            className={kind === "items" ? "is-active" : ""}
            onClick={() => setKind("items")}
          >
            Productos o servicios
          </button>
        </div>
      </div>
      <div className="pp-filters">
        <input
          type="search"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={
            kind === "tiendas"
              ? "Buscar tienda"
              : "Buscar producto, servicio o tienda"
          }
          aria-label="Buscar"
        />
        <label>
          <input
            type="checkbox"
            checked={onlyFeatured}
            onChange={e => setOnlyFeatured(e.target.checked)}
          />
          Solo tiendas con Mayor Visibilidad
        </label>
      </div>
      {list.isLoading && (
        <p className="pp-muted" role="status">
          Buscando…
        </p>
      )}
      {list.error && <p className="member-error">{list.error.message}</p>}
      {list.data && list.data.length === 0 && (
        <p className="pp-muted">
          {onlyFeatured
            ? "Ninguna tienda con Mayor Visibilidad coincide. Quita el filtro para ver todas."
            : "No hay resultados con esa búsqueda."}
        </p>
      )}
      <ul className="pp-grid">
        {list.data?.map(c => (
          <li key={c.key}>
            <button
              type="button"
              className={picked === c.key ? "is-picked" : ""}
              aria-pressed={picked === c.key}
              onClick={() => {
                setPicked(c.key);
                onPick(c);
              }}
            >
              <span className="pp-img">
                {c.kind === "tienda" || !c.imageUrl ? (
                  <StoreLogo
                    name={c.kind === "tienda" ? c.title : c.storeName}
                    logoUrl={c.kind === "tienda" ? c.imageUrl : null}
                    size={56}
                  />
                ) : (
                  <img src={c.imageUrl} alt="" loading="lazy" />
                )}
              </span>
              <span className="pp-text">
                <b>{c.title}</b>
                <small>{c.subtitle}</small>
                <em>
                  {kindLabels[c.kind]}
                  {c.featured ? " · Mayor Visibilidad" : ""}
                </em>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
