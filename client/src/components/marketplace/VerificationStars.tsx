import { Star } from "lucide-react";
import {
  verificationStarInfo,
  verificationStars,
  type VerificationStar,
} from "@shared/stars";
import type { ReviewKind } from "@shared/listingReviews";
import { trpc } from "@/lib/trpc";
import "./verificationStars.css";

/**
 * Una fila de estrellas de verificación; sin `stars` muestra las cinco.
 * `labeled` pone debajo de cada estrella el nombre de su logro.
 */
export function VerificationStars({
  size = 18,
  stars = verificationStars,
  labeled = false,
}: {
  size?: number;
  stars?: readonly VerificationStar[];
  labeled?: boolean;
}) {
  if (!stars.length) return null;
  const names = stars.map(s => verificationStarInfo[s].achievement);
  if (labeled)
    return (
      <ul
        className="vstars vstars--labeled"
        aria-label="Estrellas de verificación"
      >
        {stars.map(s => (
          <li key={s} title={verificationStarInfo[s].rule}>
            <Star
              size={size}
              color={verificationStarInfo[s].color}
              fill={verificationStarInfo[s].color}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span>{verificationStarInfo[s].achievement}</span>
          </li>
        ))}
      </ul>
    );
  return (
    <span
      className="vstars"
      role="img"
      aria-label={`Estrellas de verificación: ${names.join(", ")}`}
      title={names.join(" · ")}
      style={{ gap: Math.max(2, Math.round(size / 6)) }}
    >
      {stars.map(s => (
        <Star
          key={s}
          size={size}
          color={verificationStarInfo[s].color}
          fill={verificationStarInfo[s].color}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/** Las estrellas que una tienda ya ganó; no muestra nada si no tiene. */
export function StoreStars({
  slug,
  size = 18,
  labeled = false,
}: {
  slug: string;
  size?: number;
  labeled?: boolean;
}) {
  const q = trpc.stars.forStores.useQuery(
    { slugs: [slug] },
    { staleTime: 5 * 60_000 }
  );
  const stars = q.data?.[slug] ?? [];
  return stars.length ? (
    <VerificationStars size={size} stars={stars} labeled={labeled} />
  ) : null;
}

/** Las estrellas del dueño de un anuncio (bienes raíces, autos, empleos o servicios). */
export function ListingStars({
  kind,
  listingId,
  size = 18,
  labeled = false,
}: {
  kind: ReviewKind;
  listingId: number;
  size?: number;
  labeled?: boolean;
}) {
  const q = trpc.stars.forListing.useQuery(
    { kind, listingId },
    { staleTime: 5 * 60_000 }
  );
  const stars = q.data ?? [];
  return stars.length ? (
    <VerificationStars size={size} stars={stars} labeled={labeled} />
  ) : null;
}
