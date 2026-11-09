/*
 * Etapa 5 · Plan Mayor Visibilidad.
 * Las tiendas con el plan pagado de Mayor Visibilidad aparecen en una franja
 * «Destacados» arriba de cada lista (Mercado, Tiendas, Servicios y Eventos),
 * respetando los filtros de la persona. La franja rota cada 10 minutos para que
 * cada tienda destacada ocupe el primer lugar por turnos, y muestra una sola
 * publicación por tienda a la vez (también rotando entre sus publicaciones).
 * La prueba gratuita no cuenta como Mayor Visibilidad.
 */
export const FEATURED_PLAN_ID = "mayor_visibilidad";
export const FEATURED_ROTATION_MINUTES = 10;
export const FEATURED_SLOTS = 4;
export const FEATURED_TITLE = "Destacados";
export const FEATURED_NOTE = "Ubicación de pago · plan Mayor Visibilidad";

/** Turno de rotación vigente: cambia cada 10 minutos. */
export function rotationSlot(now: Date = new Date()): number {
  return Math.floor(now.getTime() / (FEATURED_ROTATION_MINUTES * 60_000));
}

/**
 * Elige los destacados de un turno: una publicación por tienda (rotando entre
 * las de cada tienda) y el orden de las tiendas también rota. `items` debe venir
 * en un orden estable (por ejemplo, de la más nueva a la más vieja).
 */
export function pickFeatured<T>(
  items: readonly T[],
  storeKey: (item: T) => string | number,
  now: Date = new Date(),
  take: number = FEATURED_SLOTS
): T[] {
  const groups = new Map<string | number, T[]>();
  for (const item of items) {
    const key = storeKey(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  const slot = rotationSlot(now);
  const picks = Array.from(groups.values()).map(
    list => list[slot % list.length]!
  );
  if (!picks.length) return [];
  const shift = slot % picks.length;
  return [...picks.slice(shift), ...picks.slice(0, shift)].slice(0, take);
}
