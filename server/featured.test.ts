import { describe, expect, it, vi } from "vitest";
import {
  FEATURED_ROTATION_MINUTES,
  FEATURED_SLOTS,
  pickFeatured,
  rotationSlot,
} from "@shared/featured";

/*
 * Etapa 5 · Plan Mayor Visibilidad: franja «Destacados» con rotación.
 */
const minute = 60_000;
const at = (slot: number) =>
  new Date(slot * FEATURED_ROTATION_MINUTES * minute);

describe("rotación de destacados", () => {
  const items = [
    { id: 1, store: "a" },
    { id: 2, store: "a" },
    { id: 3, store: "b" },
    { id: 4, store: "c" },
  ];

  it("muestra una sola publicación por tienda", () => {
    const picked = pickFeatured(items, i => i.store, at(0));
    expect(picked.map(i => i.store).sort()).toEqual(["a", "b", "c"]);
  });

  it("cada tienda ocupa el primer lugar por turnos", () => {
    const firsts = [0, 1, 2].map(
      slot => pickFeatured(items, i => i.store, at(slot))[0]!.store
    );
    expect(new Set(firsts)).toEqual(new Set(["a", "b", "c"]));
  });

  it("rota también entre las publicaciones de una misma tienda", () => {
    const fromA = [0, 1].map(
      slot =>
        pickFeatured(items, i => i.store, at(slot)).find(i => i.store === "a")!
          .id
    );
    expect(new Set(fromA)).toEqual(new Set([1, 2]));
  });

  it("el turno cambia cada 10 minutos y se limita a 4 lugares", () => {
    expect(rotationSlot(new Date(9 * minute))).toBe(0);
    expect(rotationSlot(new Date(10 * minute))).toBe(1);
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: i,
      store: `s${i}`,
    }));
    expect(pickFeatured(many, i => i.store, at(3))).toHaveLength(
      FEATURED_SLOTS
    );
    expect(pickFeatured([], () => "x")).toEqual([]);
  });
});

// La lista de Servicios devuelve la franja con los mismos filtros.
function chain(result: unknown) {
  const node: any = {};
  for (const m of ["from", "innerJoin", "where", "orderBy", "limit"])
    node[m] = () => node;
  node.then = (ok: any, err: any) => Promise.resolve(result).then(ok, err);
  return node;
}
const row = (
  id: number,
  storeSlug: string,
  planId: string,
  province = "Panamá"
) => ({
  service: {
    id,
    slug: `s-${id}`,
    status: "published",
    title: `Servicio ${id}`,
    description: "Descripción del servicio",
    serviceType: "a_domicilio",
    categoryId: "hogar-y-construccion",
    priceType: "fijo",
    priceCents: 1000,
    modalities: ["en_local"],
    coverageProvinces: [],
    images: [],
    updatedAt: new Date(),
  },
  store: { name: storeSlug, slug: storeSlug, province, city: "Ciudad" },
  phone: null,
  planId,
});
let rows: any[] = [];
vi.mock("./db", () => ({ getDb: async () => ({ select: () => chain(rows) }) }));

describe("franja de Servicios", () => {
  it("solo incluye Mayor Visibilidad pagado (no la prueba ni el plan Normal) y respeta los filtros", async () => {
    rows = [
      row(1, "pagado", "mayor_visibilidad"),
      row(2, "normal", "normal"),
      row(3, "prueba", "prueba"),
      row(4, "pagado-colon", "mayor_visibilidad", "Colón"),
    ];
    const { publicServices } = await import("./services/serviceListings");
    const all = await publicServices({ page: 1 } as any);
    expect(all.items).toHaveLength(4);
    expect(all.featured.map(s => s.id).sort()).toEqual([1, 4]);
    const panama = await publicServices({ page: 1, province: "Panamá" } as any);
    expect(panama.featured.map(s => s.id)).toEqual([1]);
  });
});
