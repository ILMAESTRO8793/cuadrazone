import { describe, expect, it } from "vitest";
import { instagramUrlFrom, instagramUserFrom } from "../shared/socialLinks";

describe("Instagram en el CV", () => {
  it("arma el enlace con solo el usuario", () => {
    expect(instagramUrlFrom("cuadrazone")).toBe("https://www.instagram.com/cuadrazone");
    expect(instagramUrlFrom("@cuadrazone")).toBe("https://www.instagram.com/cuadrazone");
    expect(instagramUrlFrom("https://www.instagram.com/cuadrazone/?hl=es")).toBe("https://www.instagram.com/cuadrazone");
    expect(instagramUrlFrom("instagram.com/ana.gomez_pa")).toBe("https://www.instagram.com/ana.gomez_pa");
    expect(instagramUrlFrom("")).toBe("");
  });
  it("muestra solo el usuario y quita lo que Instagram no acepta", () => {
    expect(instagramUserFrom("https://www.instagram.com/cuadrazone")).toBe("cuadrazone");
    expect(instagramUserFrom("ana gómez!")).toBe("anagmez");
  });
});
