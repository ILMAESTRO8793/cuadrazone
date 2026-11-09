import { describe, expect, it, vi } from "vitest";
import {
  REPORT_MONTHS,
  monthLabel,
  monthOverMonth,
  monthsAgoStart,
  summarizeSales,
} from "@shared/sellerDashboard";

/*
 * Etapa 6 · Panel del vendedor: reporte de ventas por mes (hora de Panamá).
 */
const now = new Date("2026-11-20T15:00:00Z");

describe("reporte de ventas", () => {
  it("muestra siempre los últimos 6 meses, del más viejo al actual", () => {
    const sales = summarizeSales([], [], now);
    expect(sales).toHaveLength(REPORT_MONTHS);
    expect(sales.map(m => m.month)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(monthLabel("2026-11")).toMatch(/nov/i);
  });

  it("suma pedidos entregados y boletos pagados en su mes de Panamá, con la comisión", () => {
    const sales = summarizeSales(
      [
        // 1 de noviembre a las 3:00 UTC = 31 de octubre en Panamá.
        {
          deliveredAt: "2026-11-01T03:00:00Z",
          subtotalCents: 1000,
          commissionCents: 80,
        },
        {
          deliveredAt: "2026-11-05T15:00:00Z",
          subtotalCents: 2500,
          commissionCents: 200,
        },
        { deliveredAt: null, subtotalCents: 9999, commissionCents: 0 },
        // Fuera del período: no cuenta.
        {
          deliveredAt: "2025-01-05T15:00:00Z",
          subtotalCents: 7777,
          commissionCents: 0,
        },
      ],
      [
        {
          paidAt: "2026-11-10T15:00:00Z",
          totalCents: 3000,
          quantity: 2,
          commissionCents: 240,
        },
      ],
      now
    );
    const oct = sales.find(m => m.month === "2026-10")!;
    const nov = sales.find(m => m.month === "2026-11")!;
    expect(oct).toMatchObject({
      productsCents: 1000,
      orders: 1,
      commissionCents: 80,
    });
    expect(nov).toMatchObject({
      productsCents: 2500,
      orders: 1,
      ticketsCents: 3000,
      tickets: 2,
      commissionCents: 440,
    });
  });

  it("compara este mes con el anterior", () => {
    const base = summarizeSales(
      [
        {
          deliveredAt: "2026-10-10T15:00:00Z",
          subtotalCents: 1000,
          commissionCents: 0,
        },
        {
          deliveredAt: "2026-11-10T15:00:00Z",
          subtotalCents: 1500,
          commissionCents: 0,
        },
      ],
      [],
      now
    );
    expect(monthOverMonth(base)).toBe(50);
    expect(monthOverMonth(summarizeSales([], [], now))).toBeNull();
  });

  it("el período empieza el primer día del mes de Panamá de hace 5 meses", () => {
    expect(monthsAgoStart(now, 5).toISOString()).toBe(
      "2026-06-01T05:00:00.000Z"
    );
  });
});

// Sin tienda no hay datos de nadie más.
vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => {
      const node: any = {};
      for (const m of ["from", "innerJoin", "where", "limit"])
        node[m] = () => node;
      node.then = (ok: any) => Promise.resolve([]).then(ok);
      return node;
    },
  }),
}));

describe("panel sin tienda", () => {
  it("devuelve que no hay tienda en lugar de datos", async () => {
    const { sellerDashboard } = await import("./services/sellerDashboard");
    await expect(sellerDashboard({ id: 77 } as any, now)).resolves.toEqual({
      hasStore: false,
    });
  });
});
