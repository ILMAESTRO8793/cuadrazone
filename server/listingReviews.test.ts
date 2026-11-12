import { describe, expect, it } from "vitest";
import { averageRating, saveListingReviewInput } from "@shared/listingReviews";

describe("reseñas de servicios, bienes raíces, autos y empleos", () => {
  it("calcula el promedio con un decimal", () => {
    expect(averageRating([])).toBe(0);
    expect(averageRating([5, 4, 5])).toBe(4.7);
    expect(averageRating([3])).toBe(3);
  });
  it("solo acepta de 1 a 5 estrellas y un texto real", () => {
    const base = { kind: "servicio", listingId: 3, body: "Muy buen servicio" };
    expect(
      saveListingReviewInput.safeParse({ ...base, rating: 5 }).success
    ).toBe(true);
    expect(
      saveListingReviewInput.safeParse({ ...base, rating: 0 }).success
    ).toBe(false);
    expect(
      saveListingReviewInput.safeParse({ ...base, rating: 6 }).success
    ).toBe(false);
    expect(
      saveListingReviewInput.safeParse({ ...base, rating: 4, body: "ok" })
        .success
    ).toBe(false);
    expect(
      saveListingReviewInput.safeParse({ ...base, kind: "producto", rating: 4 })
        .success
    ).toBe(false);
  });
});
