import { describe, expect, it } from "vitest";
import {
  approximate,
  directionsLinks,
  inPanama,
  pointInput,
} from "../shared/location";

describe("ubicaciones en el mapa", () => {
  it("el público ve una zona, no el punto exacto", () => {
    const exact = { lat: 8.983412, lng: -79.519873 };
    const zone = approximate(exact);
    expect(zone.radiusM).toBe(500);
    expect(zone).not.toMatchObject(exact);
    // Dentro de ~400 m del punto real.
    expect(Math.abs(zone.lat - exact.lat)).toBeLessThan(0.004);
    expect(Math.abs(zone.lng - exact.lng)).toBeLessThan(0.004);
    // El mismo punto siempre da la misma zona; uno cercano en la misma celda, también.
    expect(approximate(exact)).toEqual(zone);
    expect(approximate({ lat: 8.9834, lng: -79.5198 })).toEqual(zone);
  });

  it("solo acepta puntos dentro de Panamá", () => {
    expect(inPanama({ lat: 8.98, lng: -79.52 })).toBe(true);
    expect(inPanama({ lat: 40.7, lng: -74 })).toBe(false);
    expect(pointInput.safeParse({ lat: Number.NaN, lng: -79 }).success).toBe(
      false
    );
  });

  it("arma los enlaces para llegar", () => {
    const l = directionsLinks({ lat: 8.98, lng: -79.52 });
    expect(l.google).toContain("destination=8.980000,-79.520000");
    expect(l.waze).toContain("ll=8.980000,-79.520000");
  });
});
