export function usd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
export function publicCatalogInput(search: string) {
  const p = new URLSearchParams(search);
  const finite = (name: string, scale = 1) => {
    const raw = p.get(name);
    if (!raw?.trim()) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0
      ? Math.round(value * scale)
      : undefined;
  };
  const kind = p.get("kind");
  const sort = p.get("sort");
  return {
    q: p.get("q")?.trim().slice(0, 100) || undefined,
    kind: kind === "product" || kind === "book" ? kind : undefined,
    category: p.get("category")?.slice(0, 100) || undefined,
    province: p.get("province")?.slice(0, 60) || undefined,
    minPriceCents: finite("min", 100),
    maxPriceCents: finite("max", 100),
    minRating: p.get("rating")
      ? Math.min(5, Number(p.get("rating")) || 0)
      : undefined,
    sort:
      sort === "price_asc" || sort === "price_desc" || sort === "popular"
        ? sort
        : "newest",
    limit: 24,
  } as const;
}
export function failureText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación. Inténtalo otra vez.";
}
