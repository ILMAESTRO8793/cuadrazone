import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";

const original = process.env.ADMIN_EMAILS;
afterEach(() => { process.env.ADMIN_EMAILS = original; });

describe("lista de administradores", () => {
  it("tolera comillas, espacios, mayúsculas y separadores distintos", () => {
    for (const value of ['"info@cuadrazone.com"', " Info@CuadraZone.com ", "info@cuadrazone.com;otro@gmail.com", "info@cuadrazone.com, otro@gmail.com"]) {
      process.env.ADMIN_EMAILS = value;
      expect(ENV.adminEmails).toContain("info@cuadrazone.com");
    }
    process.env.ADMIN_EMAILS = "info@cuadrazone.com,otro@gmail.com";
    expect(ENV.adminEmails).toEqual(["info@cuadrazone.com", "otro@gmail.com"]);
  });
});

import { landingFor } from "./_core/codeAuth";
describe("a dónde va después de entrar", () => {
  it("el administrador va a su panel si no tenía una página pendiente", () => {
    expect(landingFor("/", true)).toBe("/admin");
    expect(landingFor("/vendedor", true)).toBe("/vendedor");
    expect(landingFor("/", false)).toBe("/");
  });
});
