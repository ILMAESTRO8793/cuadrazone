import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { reviewRequirement, type ReviewKind } from "@shared/listingReviews";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import "./listingReviews.css";

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="lr-stars" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          aria-hidden="true"
          fill={n <= Math.round(value) ? "#d9a400" : "none"}
          color={n <= Math.round(value) ? "#b8860b" : "#c9c2b3"}
        />
      ))}
    </span>
  );
}

/** Reseñas de un servicio, inmueble, auto o vacante, con el formulario para quien puede reseñar. */
export function ListingReviews({
  kind,
  listingId,
}: {
  kind: ReviewKind;
  listingId: number;
}) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const list = trpc.listingReviews.list.useQuery({ kind, listingId });
  const eligibility = trpc.listingReviews.eligibility.useQuery(
    { kind, listingId },
    { enabled: !auth.loading && Boolean(auth.user), retry: false }
  );
  const save = trpc.listingReviews.save.useMutation();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const mine = eligibility.data?.mine ?? null;
  useEffect(() => {
    if (mine) {
      setRating(mine.rating);
      setBody(mine.body);
    }
  }, [mine]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ kind, listingId, rating, body });
      await Promise.all([
        utils.listingReviews.list.invalidate({ kind, listingId }),
        utils.listingReviews.eligibility.invalidate({ kind, listingId }),
        utils.stars.forStores.invalidate(),
      ]);
      setEditing(false);
      toast.success("Reseña guardada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la reseña"
      );
    }
  }

  const d = list.data;
  const canReview = eligibility.data?.canReview === true;
  const showForm = canReview && (!mine || editing);

  return (
    <section className="lr" aria-labelledby={`lr-${kind}-${listingId}`}>
      <div className="lr-head">
        <h2 id={`lr-${kind}-${listingId}`}>Reseñas</h2>
        {d && d.count > 0 && (
          <span className="lr-summary">
            <Stars value={d.average} /> <strong>{d.average.toFixed(1)}</strong>{" "}
            · {d.count} {d.count === 1 ? "reseña" : "reseñas"}
          </span>
        )}
      </div>
      {list.isLoading && <p role="status">Cargando reseñas…</p>}
      {d && d.count === 0 && (
        <p className="lr-muted">Todavía no hay reseñas.</p>
      )}
      <ul className="lr-list">
        {d?.reviews.map(r => (
          <li key={r.id}>
            <div className="lr-meta">
              <Stars value={r.rating} size={14} />
              <span>{r.author}</span>
              <time dateTime={r.createdAt}>
                {new Intl.DateTimeFormat("es-PA", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(r.createdAt))}
              </time>
            </div>
            <p>{r.body}</p>
          </li>
        ))}
      </ul>

      {mine && !editing && (
        <div className="lr-mine">
          <strong>Tu reseña</strong> <Stars value={mine.rating} size={14} />
          <p>{mine.body}</p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setEditing(true)}
          >
            Editar mi reseña
          </button>
        </div>
      )}

      {showForm && (
        <form className="lr-form" onSubmit={submit}>
          <fieldset>
            <legend>Tu calificación</legend>
            <div className="lr-pick">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={rating === n}
                  aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                  onClick={() => setRating(n)}
                >
                  <Star
                    size={26}
                    aria-hidden="true"
                    fill={n <= rating ? "#d9a400" : "none"}
                    color={n <= rating ? "#b8860b" : "#c9c2b3"}
                  />
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            Cuéntales a otros cómo te fue
            <textarea
              rows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={1000}
              required
              minLength={3}
            />
          </label>
          <div className="lr-actions">
            <button
              className="btn btn-gold"
              type="submit"
              disabled={save.isPending}
            >
              {save.isPending
                ? "Guardando…"
                : mine
                  ? "Guardar cambios"
                  : "Publicar reseña"}
            </button>
            {editing && (
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {!auth.user && !auth.loading && (
        <p className="lr-muted">
          Inicia sesión para dejar una reseña. {reviewRequirement[kind]}
        </p>
      )}
      {auth.user &&
        eligibility.data &&
        !canReview &&
        !eligibility.data.isOwner &&
        !mine && <p className="lr-muted">{reviewRequirement[kind]}</p>}
    </section>
  );
}

/** Al tocar WhatsApp o Llamar en un inmueble o auto: guarda el contacto para poder reseñar luego. */
export function useRecordContact(kind: "inmueble" | "auto", listingId: number) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const record = trpc.listingReviews.contact.useMutation({
    onSuccess: () =>
      void utils.listingReviews.eligibility.invalidate({ kind, listingId }),
  });
  return () => {
    if (auth.user) record.mutate({ kind, listingId });
  };
}
