import { z } from "zod";

/** Secciones con reseñas propias (los productos usan su propio sistema). */
export const reviewKinds = ["servicio", "inmueble", "auto", "empleo"] as const;
export type ReviewKind = (typeof reviewKinds)[number];

export const reviewKindLabels: Record<ReviewKind, string> = {
  servicio: "Servicio",
  inmueble: "Bien raíz",
  auto: "Auto",
  empleo: "Empleo",
};

/** Qué tiene que haber hecho la persona para poder reseñar. */
export const reviewRequirement: Record<ReviewKind, string> = {
  servicio:
    "Puedes reseñar después de solicitar este servicio o tener una cita con el proveedor.",
  inmueble:
    "Puedes reseñar después de contactar al anunciante con los botones de WhatsApp o Llamar.",
  auto: "Puedes reseñar después de contactar al vendedor con los botones de WhatsApp o Llamar.",
  empleo: "Puedes reseñar a la empresa después de postularte a esta vacante.",
};

/** Etiqueta que acompaña cada reseña publicada. */
export const reviewAuthorLabel: Record<ReviewKind, string> = {
  servicio: "Cliente verificado",
  inmueble: "Contacto verificado",
  auto: "Contacto verificado",
  empleo: "Postulante verificado",
};

export const listingRef = z
  .object({ kind: z.enum(reviewKinds), listingId: z.number().int().positive() })
  .strict();

export const saveListingReviewInput = z
  .object({
    kind: z.enum(reviewKinds),
    listingId: z.number().int().positive(),
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(3, "Escribe al menos 3 caracteres").max(1000),
  })
  .strict();
export type SaveListingReviewInput = z.infer<typeof saveListingReviewInput>;

/** «4.6» con un decimal; 0 si no hay reseñas. */
export function averageRating(ratings: readonly number[]): number {
  if (!ratings.length) return 0;
  return (
    Math.round((ratings.reduce((a, r) => a + r, 0) / ratings.length) * 10) / 10
  );
}
