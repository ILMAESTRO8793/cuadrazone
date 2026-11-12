/**
 * Las cinco estrellas de verificación de CuadraZone. Cada una es un logro:
 * se gana sola cuando el vendedor o anunciante lo cumple (y un administrador
 * también puede otorgarla a mano).
 */
export const verificationStars = [
  "roja",
  "amarilla",
  "morada",
  "azul",
  "verde",
] as const;
export type VerificationStar = (typeof verificationStars)[number];

export const verificationStarInfo: Record<
  VerificationStar,
  { label: string; color: string; achievement: string; rule: string }
> = {
  roja: {
    label: "Estrella roja",
    color: "#d32f2f",
    achievement: "Tienda Destacada",
    rule: "Tiene el plan Mayor Visibilidad pagado y vigente.",
  },
  amarilla: {
    label: "Estrella amarilla",
    color: "#f2b705",
    achievement: "Perfil Completo",
    rule: "Su tienda tiene logo, descripción, teléfono y su web o Instagram.",
  },
  morada: {
    label: "Estrella morada",
    color: "#7b3fb0",
    achievement: "Vendedor Comprobado",
    rule: "Tiene 20 ventas o más, o 10 anuncios cerrados como vendidos, alquilados o vacante cubierta.",
  },
  azul: {
    label: "Estrella azul",
    color: "#1f6fc5",
    achievement: "Clientes Felices",
    rule: "Promedio de 4.5 o más en al menos 10 reseñas, sin reclamos perdidos.",
  },
  verde: {
    label: "Estrella verde",
    color: "#2e8b3e",
    achievement: "Socio Fiel",
    rule: "Lleva 12 meses o más de plan pagado y está al día.",
  },
};

/** Descripción mínima de la tienda para «Perfil Completo». */
export const MIN_DESCRIPTION = 30;
export const MIN_SALES = 20;
export const MIN_CLOSED_LISTINGS = 10;
export const MIN_REVIEWS = 10;
export const MIN_AVERAGE = 4.5;
export const MIN_PAID_MONTHS = 12;

/** Lo que se mide de cada vendedor o anunciante. */
export type AchievementMetrics = {
  /** Mayor Visibilidad pagado y vigente (de tienda o de anunciante). */
  featured: boolean;
  /** La tienda tiene logo, descripción, teléfono y su web o Instagram. */
  profileComplete: boolean;
  sales: number;
  closedListings: number;
  reviewCount: number;
  reviewAverage: number;
  lostClaims: number;
  paidMonths: number;
  /** Plan al día (tienda activa o anunciante vigente). */
  upToDate: boolean;
};

/** Qué estrellas ganó por sus logros. */
export function earnedStars(m: AchievementMetrics): VerificationStar[] {
  const out: VerificationStar[] = [];
  if (m.featured) out.push("roja");
  if (m.profileComplete) out.push("amarilla");
  if (m.sales >= MIN_SALES || m.closedListings >= MIN_CLOSED_LISTINGS)
    out.push("morada");
  if (
    m.reviewCount >= MIN_REVIEWS &&
    m.reviewAverage >= MIN_AVERAGE &&
    m.lostClaims === 0
  )
    out.push("azul");
  if (m.paidMonths >= MIN_PAID_MONTHS && m.upToDate) out.push("verde");
  return out;
}

/** Ordena y quita repetidas o desconocidas. */
export function sortStars(stars: readonly string[]): VerificationStar[] {
  return verificationStars.filter(s => stars.includes(s));
}
