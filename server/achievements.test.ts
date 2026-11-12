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
  it("roja con Mayor Visibilidad", () => {
    expect(earnedStars({ ...base, featured: true })).toEqual(["roja"]);
  });
  it("amarilla con el perfil completo", () => {
    expect(earnedStars({ ...base, profileComplete: true })).toEqual(["amarilla"]);
  });
  it("morada con 20 ventas o 10 anuncios cerrados", () => {
    expect(earnedStars({ ...base, sales: 20 })).toEqual(["morada"]);
    expect(earnedStars({ ...base, closedListings: 10 })).toEqual(["morada"]);
    expect(earnedStars({ ...base, sales: 19, closedListings: 9 })).toEqual([]);
  });
  it("azul con 10 reseñas, 4.5 o más y sin reclamos perdidos", () => {
    expect(earnedStars({ ...base, reviewCount: 10, reviewAverage: 4.5 })).toEqual(["azul"]);
    expect(earnedStars({ ...base, reviewCount: 9, reviewAverage: 5 })).toEqual([]);
    expect(earnedStars({ ...base, reviewCount: 12, reviewAverage: 4.8, lostClaims: 1 })).toEqual([]);
  });
  it("verde con 12 meses pagados y al día", () => {
    expect(earnedStars({ ...base, paidMonths: 12, upToDate: true })).toEqual(["verde"]);
    expect(earnedStars({ ...base, paidMonths: 12, upToDate: false })).toEqual([]);
  });
});
