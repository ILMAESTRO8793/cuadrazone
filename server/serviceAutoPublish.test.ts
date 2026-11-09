import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Un servicio nuevo debe salir publicado si la tienda ya puede publicar.
 * Antes quedaba en borrador y no aparecía en la sección Servicios.
 */
let storeRow: { store: any; app: any };
let inserted: any;

function chain(result: unknown) {
  const node: any = {
    from: () => node,
    innerJoin: () => node,
    where: () => node,
    limit: async () => result,
  };
  return node;
}

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => chain([storeRow]),
    insert: () => ({
      values: async (values: any) => {
        inserted = values;
        return [{ insertId: 7 }];
      },
    }),
    update: () => ({ set: () => ({ where: async () => [{ affectedRows: 1 }] }) }),
  }),
}));

const input = {
  title: "Clases de inglés conversacional",
  description: "Clases en línea para adultos, nivel básico a avanzado.",
  serviceType: "a_domicilio",
  categoryId: "hogar-y-construccion",
  specialtyId: null,
  priceType: "por_hora",
  priceCents: 1500,
  durationMinutes: 60,
  modalities: ["en_linea"],
  coverageProvinces: [],
  schedule: "",
  images: [],
};

const user = { id: 3 } as any;

describe("publicar un servicio nuevo", () => {
  beforeEach(() => {
    inserted = undefined;
  });

  it("sale publicado si la tienda está aprobada y el plan activo", async () => {
    storeRow = { store: { id: 11, storeKind: "servicios" }, app: { status: "approved", subscriptionStatus: "active" } };
    const { saveServiceInput } = await import("@shared/services");
    const parsed = saveServiceInput.safeParse(input);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    const { saveService } = await import("./services/serviceListings");
    const result = await saveService(user, input);
    expect(result).toEqual({ id: 7, published: true });
    expect(inserted.status).toBe("published");
    expect(inserted.publishedAt).toBeInstanceOf(Date);
  });

  it("queda en borrador si la tienda todavía no está aprobada", async () => {
    storeRow = { store: { id: 11, storeKind: "servicios" }, app: { status: "pending", subscriptionStatus: "none" } };
    const { saveService } = await import("./services/serviceListings");
    const result = await saveService(user, input);
    expect(result).toEqual({ id: 7, published: false });
    expect(inserted.status).toBeUndefined();
  });
});
