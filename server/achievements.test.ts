import { describe, expect, it } from "vitest";
import { earnedStars, type AchievementMetrics } from "@shared/stars";

const base: AchievementMetrics = {
  featured: false,
  profileComplete: false,
  sales: 0,
  closedListings: 0,
  reviewCount: 0,
  reviewAverage: 0,
  lostClaims: 0,
  paidMonths: 0,
  upToDate: false,
};

describe("estrellas por logros", () => {
  it("sin logros no hay estrellas", () => {
    expect(earnedStars(base)).toEqual([]);
  });
  it("Mayor Visibilidad tiene las cinco estrellas", () => {
    expect(earnedStars({ ...base, featured: true })).toEqual([
      "roja",
      "amarilla",
      "morada",
      "azul",
      "verde",
    ]);
  });
  it("el plan Normal no lleva estrellas aunque cumpla logros", () => {
    expect(
      earnedStars({
        ...base,
        profileComplete: true,
        sales: 50,
        reviewCount: 20,
        reviewAverage: 4.9,
        paidMonths: 24,
        upToDate: true,
      })
    ).toEqual([]);
  });
});
