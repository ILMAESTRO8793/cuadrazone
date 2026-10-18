import {
  categories,
  listings,
  provinces,
  type ListingKind,
  listingSearchText,
  normalizeSearch,
} from "@/data/catalog";
export type CatalogFilters = {
  q: string;
  kind: ListingKind | "todos";
  category: string;
  province: string;
  maxPrice: number;
  minRating: number;
  sort: "relevancia" | "precio-menor" | "precio-mayor";
};
export function parseCatalogFilters(
  search: string,
  initialKind?: ListingKind
): CatalogFilters {
  const params = new URLSearchParams(search);
  const kind = params.get("tipo") || initialKind || "todos";
  const category = params.get("categoria") || "todas";
  const province = params.get("provincia") || "todas";
  const price = Number(params.get("max") || 100);
  const rating = Number(params.get("rating") || 0);
  const sort = params.get("sort") || "relevancia";
  return {
    q: params.get("q") || "",
    kind: ["todos", "producto", "libro", "evento", "servicio"].includes(kind)
      ? (kind as CatalogFilters["kind"])
      : "todos",
    category: categories.includes(category) ? category : "todas",
    province: provinces.includes(province) ? province : "todas",
    maxPrice: Number.isFinite(price) && price >= 0 ? price : 100,
    minRating: [0, 4, 4.5].includes(rating) ? rating : 0,
    sort: ["relevancia", "precio-menor", "precio-mayor"].includes(sort)
      ? (sort as CatalogFilters["sort"])
      : "relevancia",
  };
}
export function serializeCatalogFilters(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  params.set("tipo", filters.kind);
  params.set("categoria", filters.category);
  params.set("provincia", filters.province);
  params.set("max", String(filters.maxPrice));
  params.set("rating", String(filters.minRating));
  params.set("sort", filters.sort);
  return params.toString();
}
export function filterCatalog(filters: CatalogFilters) {
  const term = normalizeSearch(filters.q.trim());
  const results = listings.filter(
    item =>
      (!term || listingSearchText(item).includes(term)) &&
      (filters.kind === "todos" || item.kind === filters.kind) &&
      (filters.category === "todas" || item.category === filters.category) &&
      (filters.province === "todas" || item.province === filters.province) &&
      item.price <= filters.maxPrice &&
      item.rating >= filters.minRating
  );
  return results.sort((a, b) =>
    filters.sort === "precio-menor"
      ? a.price - b.price
      : filters.sort === "precio-mayor"
        ? b.price - a.price
        : b.rating - a.rating
  );
}
