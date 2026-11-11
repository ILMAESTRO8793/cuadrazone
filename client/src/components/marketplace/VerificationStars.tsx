import { Star } from "lucide-react";

/** Las cinco estrellas de verificación de CuadraZone, en su orden. */
export const VERIFICATION_STARS = [
  { id: "roja", label: "Estrella roja", color: "#d32f2f" },
  { id: "amarilla", label: "Estrella amarilla", color: "#f2b705" },
  { id: "morada", label: "Estrella morada", color: "#7b3fb0" },
  { id: "azul", label: "Estrella azul", color: "#1f6fc5" },
  { id: "verde", label: "Estrella verde", color: "#2e8b3e" },
] as const;

export function VerificationStars({ size = 18 }: { size?: number }) {
  return (
    <span
      className="verification-stars"
      role="img"
      aria-label="Cinco estrellas de verificación: roja, amarilla, morada, azul y verde"
      style={{ display: "inline-flex", gap: Math.round(size / 6) }}
    >
      {VERIFICATION_STARS.map(s => (
        <Star key={s.id} size={size} color={s.color} fill={s.color} strokeWidth={1.5} aria-hidden="true" />
      ))}
    </span>
  );
}
