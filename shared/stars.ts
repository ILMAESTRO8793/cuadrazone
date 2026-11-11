/** Las cinco estrellas de verificación de CuadraZone, en su orden. */
export const verificationStars = ["roja", "amarilla", "morada", "azul", "verde"] as const;
export type VerificationStar = (typeof verificationStars)[number];
export const verificationStarInfo: Record<VerificationStar, { label: string; color: string }> = {
  roja: { label: "Estrella roja", color: "#d32f2f" },
  amarilla: { label: "Estrella amarilla", color: "#f2b705" },
  morada: { label: "Estrella morada", color: "#7b3fb0" },
  azul: { label: "Estrella azul", color: "#1f6fc5" },
  verde: { label: "Estrella verde", color: "#2e8b3e" },
};
/** Ordena y quita repetidas o desconocidas. */
export function sortStars(stars: readonly string[]): VerificationStar[] {
  return verificationStars.filter(s => stars.includes(s));
}
