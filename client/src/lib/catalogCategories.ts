import { catalogCategories } from "@shared/marketplace";
import { trpc } from "@/lib/trpc";

/**
 * Categorías de productos activas (las administra CuadraZone desde /admin/portada).
 * Mientras cargan se usan las de siempre para que los formularios no queden vacíos.
 */
export function useCatalogCategories(): string[] {
  const query = trpc.catalog.categories.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return query.data ?? [...catalogCategories];
}

/** Opciones de un selector: las activas más la que ya tenía la publicación. */
export function withCurrent(list: string[], current: string) {
  return current && !list.includes(current) ? [current, ...list] : list;
}
