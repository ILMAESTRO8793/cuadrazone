import { describe, expect, it } from "vitest";
import { readableTextOn, saveBrandingInput } from "@shared/branding";

describe("marca de la tienda", () => {
  it("escoge texto blanco sobre colores oscuros y oscuro sobre claros", () => {
    expect(readableTextOn("#0b2a4a")).toBe("#ffffff");
    expect(readableTextOn("#7a1f2b")).toBe("#ffffff");
    expect(readableTextOn("#f2c230")).toBe("#14181f");
    expect(readableTextOn("#ffffff")).toBe("#14181f");
  });
  it("acepta solo colores #RRGGBB y lemas cortos", () => {
    expect(
      saveBrandingInput.safeParse({
        tagline: "Repostería artesanal",
        brandColor: "#7A1F2B",
      }).success
    ).toBe(true);
    expect(
      saveBrandingInput.safeParse({ tagline: "", brandColor: "" }).success
    ).toBe(true);
    expect(
      saveBrandingInput.safeParse({ tagline: "x", brandColor: "red" }).success
    ).toBe(false);
    expect(
      saveBrandingInput.safeParse({ tagline: "x".repeat(91), brandColor: "" })
        .success
    ).toBe(false);
  });
});
