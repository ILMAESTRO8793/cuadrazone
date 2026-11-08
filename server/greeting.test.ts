import { describe, expect, it } from "vitest";
import { greetingName } from "@shared/greeting";

describe("greetingName", () => {
  it("usa el primer nombre con la inicial en mayúscula", () => {
    expect(greetingName("SALEM PIERRE")).toBe("Salem");
    expect(greetingName("salem pierre")).toBe("Salem");
    expect(greetingName("  María José  Pérez ")).toBe("María");
    expect(greetingName("ÁNGEL")).toBe("Ángel");
  });

  it("respeta un nombre que ya trae su propia forma", () => {
    expect(greetingName("McKenzie Ruiz")).toBe("McKenzie");
  });

  it("no usa el correo como nombre", () => {
    expect(greetingName("pierresalemofficial@gmail.com")).toBeNull();
  });

  it("devuelve null si no hay nombre", () => {
    expect(greetingName("")).toBeNull();
    expect(greetingName("   ")).toBeNull();
    expect(greetingName(null)).toBeNull();
    expect(greetingName(undefined)).toBeNull();
  });
});
