import { Star } from "lucide-react";
import {
  verificationStarInfo,
  verificationStars,
  type VerificationStar,
} from "@shared/stars";
import { trpc } from "@/lib/trpc";

/** Una fila de estrellas de verificación; sin `stars` muestra las cinco. */
export function VerificationStars({
  size = 18,
  stars = verificationStars,
}: {
  size?: number;
  stars?: readonly VerificationStar[];
}) {
  if (!stars.length) return null;
  const names = stars.map(s =>
    verificationStarInfo[s].label.replace("Estrella ", "")
  );
  return (
    <span
      className="verification-stars"
      role="img"
      aria-label={`${stars.length === 1 ? "Estrella" : `${stars.length} estrellas`} de verificación: ${names.join(", ")}`}
      title={stars.map(s => verificationStarInfo[s].label).join(" · ")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(2, Math.round(size / 6)),
      }}
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
}: {
  slug: string;
  size?: number;
}) {
  const q = trpc.stars.forStores.useQuery(
    { slugs: [slug] },
    { staleTime: 5 * 60_000 }
  );
  const stars = q.data?.[slug] ?? [];
  return stars.length ? <VerificationStars size={size} stars={stars} /> : null;
}
