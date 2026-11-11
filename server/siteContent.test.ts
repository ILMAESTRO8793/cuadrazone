import { describe, expect, it, vi } from "vitest";
import {
  isBannerLive,
  isSafeBannerLink,
  panamaDayOf,
  panamaDayRange,
  saveBannerInput,
} from "@shared/siteContent";

/*
 * Etapa 6 · Portada administrable: enlaces seguros de los banners, sus fechas
 * en hora de Panamá y las categorías ocultas que no se pueden escoger.
 */

describe("enlaces de los banners", () => {
  it("acepta páginas de CuadraZone y direcciones https", () => {
    expect(isSafeBannerLink("")).toBe(true);
    expect(isSafeBannerLink("/eventos")).toBe(true);
    expect(isSafeBannerLink("/mercado?categoria=Hogar")).toBe(true);
    expect(isSafeBannerLink("https://www.cuadrazone.com/autos")).toBe(true);
  });
  it("rechaza otros sitios disfrazados, http y javascript", () => {
    expect(isSafeBannerLink("//malo.com")).toBe(false);
    expect(isSafeBannerLink("/\\malo.com")).toBe(false);
    expect(isSafeBannerLink("http://malo.com")).toBe(false);
    expect(isSafeBannerLink("javascript:alert(1)")).toBe(false);
    expect(isSafeBannerLink("eventos")).toBe(false);
  });
});

describe("fechas de los banners", () => {
  it("un día de Panamá empieza a las 5:00 UTC", () => {
    const { start, end } = panamaDayRange("2026-12-01");
    expect(start.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-02T05:00:00.000Z");
    expect(panamaDayOf(start)).toBe("2026-12-01");
  });

  it("se muestra solo activo, con foto y dentro de sus fechas", () => {
    const base = {
      active: 1,
      imageUrl: "/x.webp",
      startsAt: panamaDayRange("2026-12-01").start,
      endsAt: panamaDayRange("2026-12-24").end,
    };
    expect(isBannerLive(base, new Date("2026-12-01T05:00:00Z"))).toBe(true);
    expect(isBannerLive(base, new Date("2026-12-01T04:59:00Z"))).toBe(false);
    // El 24 de diciembre a las 11:59 p. m. de Panamá todavía se ve.
    expect(isBannerLive(base, new Date("2026-12-25T04:59:00Z"))).toBe(true);
    expect(isBannerLive(base, new Date("2026-12-25T05:00:00Z"))).toBe(false);
    expect(
      isBannerLive(
        { ...base, imageUrl: null },
        new Date("2026-12-05T12:00:00Z")
      )
    ).toBe(false);
    expect(
      isBannerLive({ ...base, active: 0 }, new Date("2026-12-05T12:00:00Z"))
    ).toBe(false);
  });

  it("la fecha final no puede ir antes de la inicial", () => {
    const r = saveBannerInput.safeParse({
      title: "Feria",
      active: true,
      startsOn: "2026-12-10",
      endsOn: "2026-12-01",
    });
    expect(r.success).toBe(false);
  });
});

// ── Categorías con base de datos falsa ──
let rows: Array<{ name: string; active: number; sortOrder: number }> = [];
const fakeDb: any = {
  select: () => {
    const node: any = {
      from: () => node,
      orderBy: () => node,
      then: (ok: any, err: any) => Promise.resolve(rows).then(ok, err),
    };
    return node;
  },
};
vi.mock("./db", () => ({ getDb: async () => fakeDb }));

describe("categorías administrables", () => {
  it("al publicar solo se escogen las activas", async () => {
    rows = [
      { name: "Hogar y cocina", active: 1, sortOrder: 10 },
      { name: "Juguetes", active: 0, sortOrder: 20 },
      { name: "Jardinería", active: 1, sortOrder: 30 },
    ];
    const { activeCatalogCategories, isAllowedProductCategory } = await import(
      "./services/siteContent"
    );
    expect(await activeCatalogCategories()).toEqual([
      "Hogar y cocina",
      "Jardinería",
    ]);
    expect(await isAllowedProductCategory(fakeDb, "Jardinería")).toBe(true);
    expect(await isAllowedProductCategory(fakeDb, "Juguetes")).toBe(false);
    expect(await isAllowedProductCategory(fakeDb, "Inventada")).toBe(false);
  });

  it("un producto que ya tenía una categoría oculta la conserva al editar", async () => {
    const { isAllowedProductCategory } = await import("./services/siteContent");
    expect(await isAllowedProductCategory(fakeDb, "Juguetes", "Juguetes")).toBe(
      true
    );
    expect(
      await isAllowedProductCategory(fakeDb, "Juguetes", "Hogar y cocina")
    ).toBe(false);
    // Las categorías antiguas solo se conservan, no se escogen de nuevo.
    expect(await isAllowedProductCategory(fakeDb, "Hogar")).toBe(false);
    expect(await isAllowedProductCategory(fakeDb, "Hogar", "Hogar")).toBe(true);
  });
});
