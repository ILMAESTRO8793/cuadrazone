import { z } from "zod";

/** Panamá con un margen: no se acepta un punto fuera del país. */
export const PANAMA_BOUNDS = {
  south: 7.0,
  north: 9.8,
  west: -83.1,
  east: -77.1,
} as const;
export const PANAMA_CENTER = { lat: 8.98, lng: -79.52 } as const;

/** Radio del círculo que ve el público (la zona, no el punto exacto). */
export const APPROX_RADIUS_M = 500;
/** Tamaño de la cuadrícula de la zona aproximada (~550 m). */
const GRID = 0.005;

export const placeKinds = ["tienda", "inmueble", "auto", "empleo"] as const;
export type PlaceKind = (typeof placeKinds)[number];
/** Lo que se puede ubicar en una página pública (un servicio usa el punto de su tienda). */
export const publicPlaceKinds = [
  "tienda",
  "servicio",
  "inmueble",
  "auto",
  "empleo",
] as const;
export type PublicPlaceKind = (typeof publicPlaceKinds)[number];

export type Point = { lat: number; lng: number };
/** Lo que ve el público: el centro de la zona y el radio del círculo. */
export type ApproxPlace = Point & { radiusM: number };

export const pointInput = z
  .object({
    lat: z.number().finite().min(PANAMA_BOUNDS.south).max(PANAMA_BOUNDS.north),
    lng: z.number().finite().min(PANAMA_BOUNDS.west).max(PANAMA_BOUNDS.east),
  })
  .strict();

export const toE6 = (v: number) => Math.round(v * 1_000_000);
export const fromE6 = (v: number) => v / 1_000_000;

export function inPanama(p: Point) {
  return pointInput.safeParse(p).success;
}

/**
 * Zona aproximada: el centro de la celda de ~550 m donde cae el punto. Siempre
 * da lo mismo para el mismo punto, así nadie lo «afina» recargando la página.
 */
export function approximate(p: Point): ApproxPlace {
  const snap = (v: number) => (Math.floor(v / GRID) + 0.5) * GRID;
  return {
    lat: Math.round(snap(p.lat) * 1e5) / 1e5,
    lng: Math.round(snap(p.lng) * 1e5) / 1e5,
    radiusM: APPROX_RADIUS_M,
  };
}

/** Enlaces para llegar con Google Maps o Waze. */
export function directionsLinks(p: Point) {
  const ll = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
    waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
  };
}
