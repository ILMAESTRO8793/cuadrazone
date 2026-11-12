import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { reviewKindLabels, reviewKinds } from "@shared/listingReviews";
import { trpc } from "@/lib/trpc";
import "./adminShowcase.css";

/** Ocultar o volver a mostrar reseñas de servicios, bienes raíces, autos y empleos. */
export function AdminListingReviews({ enabled }: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const [q, setQ] = useState("");
  const list = trpc.listingReviews.adminList.useQuery({ q }, { enabled });
  const moderate = trpc.listingReviews.adminModerate.useMutation();

  async function toggle(id: number, hide: boolean) {
    let reason = "";
    if (hide) {
      reason =
        prompt("¿Por qué ocultas esta reseña? (al menos 5 caracteres)") ?? "";
      if (!reason.trim()) return;
    }
    try {
      await moderate.mutateAsync({ id, hide, reason });
      await Promise.all([
        utils.listingReviews.adminList.invalidate(),
        utils.listingReviews.list.invalidate(),
      ]);
      toast.success(hide ? "Reseña oculta" : "Reseña visible otra vez");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ocurrió un error");
    }
  }

  return (
    <section className="member-card as-wrap" aria-labelledby="alr-title">
      <h2 id="alr-title">
        Reseñas de servicios, bienes raíces, autos y empleos
      </h2>
      <p className="member-muted">
        Las ocultas no se ven ni cuentan en el promedio ni en las estrellas.
      </p>
      <div className="as-filter">
        <label>
          Ver
          <select value={q} onChange={e => setQ(e.target.value)}>
            <option value="">Todas</option>
            {reviewKinds.map(k => (
              <option key={k} value={k}>
                {reviewKindLabels[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.data && list.data.length === 0 && (
        <p className="as-empty">Todavía no hay reseñas.</p>
      )}
      <ul className="as-list">
        {list.data?.map(r => (
          <li key={r.id} className={r.hiddenAt ? "is-off" : ""}>
            <div className="as-thumb" aria-hidden="true">
              <Star size={22} fill="#d9a400" color="#b8860b" />
            </div>
            <div>
              <strong>
                {r.rating} / 5 · {reviewKindLabels[r.kind]} #{r.listingId}
              </strong>
              <small>{r.body}</small>
              {r.hiddenAt && <small>Oculta: {r.hiddenReason}</small>}
            </div>
            <div className="as-row-actions">
              <button
                type="button"
                className={`member-button${r.hiddenAt ? "" : " as-danger"}`}
                disabled={moderate.isPending}
                onClick={() => void toggle(r.id, !r.hiddenAt)}
              >
                {r.hiddenAt ? "Mostrar" : "Ocultar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
