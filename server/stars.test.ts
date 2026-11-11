import { describe, expect, it } from "vitest";
import { sortStars, verificationStars } from "@shared/stars";

describe("estrellas de verificación", () => {
  it("son cinco, en orden roja, amarilla, morada, azul y verde", () => {
    expect(verificationStars).toEqual(["roja", "amarilla", "morada", "azul", "verde"]);
  });
  it("ordena y descarta desconocidas", () => {
    expect(sortStars(["verde", "x", "roja", "azul"])).toEqual(["roja", "azul", "verde"]);
  });
});
