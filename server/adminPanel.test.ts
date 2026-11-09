import { beforeEach, describe, expect, it, vi } from "vitest";
import { canAdminResolve, isClaimOverdue } from "@shared/claims";
import { czClaims, czOrders } from "../drizzle/commerce-schema";
import { czServices, czStores } from "../drizzle/catalog-schema";
import { czApplications } from "../drizzle/schema";

/*
 * Etapa 6 · Panel del administrador: reclamos (48 horas), suspensión que un
 * pago no levanta y moderación que impide volver a publicar.
 */
const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-09T15:00:00Z");

describe("plazo de 48 horas del vendedor", () => {
  const open = {
    status: "open" as const,
    respondBy: new Date(now.getTime() + HOUR),
  };
  it("el administrador espera mientras el vendedor está en plazo", () => {
    expect(isClaimOverdue(open, now)).toBe(false);
    expect(canAdminResolve(open, now)).toBe(false);
  });
  it("decide si el vendedor respondió o si se le venció el plazo", () => {
    expect(canAdminResolve({ ...open, status: "answered" }, now)).toBe(true);
    const late = {
      status: "open" as const,
      respondBy: new Date(now.getTime() - HOUR),
    };
    expect(isClaimOverdue(late, now)).toBe(true);
    expect(canAdminResolve(late, now)).toBe(true);
    expect(canAdminResolve({ ...late, status: "resolved" }, now)).toBe(false);
  });
});

// ── Base de datos falsa ──
let state: {
  order?: any;
  sellerUserId?: number | null;
  claim?: any;
  app?: any;
  service?: any;
  inserted: Array<{ table: unknown; values: any }>;
  updated: Array<{ table: unknown; values: any }>;
};
function chain(resolve: (node: any) => unknown) {
  const node: any = {};
  for (const m of [
    "from",
    "innerJoin",
    "leftJoin",
    "where",
    "limit",
    "orderBy",
    "for",
    "groupBy",
  ])
    node[m] = (...args: unknown[]) => {
      if (m === "from") node.table = args[0];
      return node;
    };
  node.then = (ok: any, err: any) =>
    Promise.resolve()
      .then(() => resolve(node))
      .then(ok, err);
  return node;
}
const fakeDb: any = {
  select: () =>
    chain(node => {
      if (node.table === czOrders)
        return state.order
          ? [{ order: state.order, sellerUserId: state.sellerUserId }]
          : [];
      if (node.table === czClaims) return state.claim ? [state.claim] : [];
      if (node.table === czApplications) return state.app ? [state.app] : [];
      if (node.table === czServices)
        return state.service ? [state.service] : [];
      if (node.table === czStores) return [];
      return [];
    }),
  insert: (table: unknown) => ({
    values: async (values: any) => {
      state.inserted.push({ table, values });
      return [{ insertId: 9 }];
    },
  }),
  update: (table: unknown) => ({
    set: (values: any) => ({
      where: async () => {
        state.updated.push({ table, values });
        return [{ affectedRows: 1 }];
      },
    }),
  }),
  transaction: (fn: (tx: any) => unknown) => fn(fakeDb),
};
vi.mock("./db", () => ({ getDb: async () => fakeDb }));
vi.mock("./services/email", () => ({
  queueEmail: vi.fn(async () => true),
  queueAdminEmail: vi.fn(async () => undefined),
  recipientFor: vi.fn(async () => null),
}));
vi.mock("./services/commissions", async importOriginal => ({
  ...(await importOriginal<any>()),
  hasOverdueCommission: vi.fn(async () => false),
}));

const buyer = { id: 50 } as any;
const seller = { id: 7 } as any;
const admin = { id: 1, role: "admin" } as any;
const claimInput = {
  orderId: 3,
  reason: "damaged",
  description: "La taza llegó rota en dos pedazos y sin empaque.",
};

beforeEach(() => {
  state = {
    order: {
      id: 3,
      number: "CZ-0003",
      userId: 50,
      storeId: 4,
      status: "delivered",
      createdAt: new Date(now.getTime() - 5 * 24 * HOUR),
    },
    sellerUserId: 7,
    inserted: [],
    updated: [],
  };
});

describe("abrir un reclamo", () => {
  it("el comprador abre el reclamo y el vendedor queda con 48 horas", async () => {
    const { openClaim } = await import("./services/claims");
    await openClaim(buyer, claimInput, now);
    const claim = state.inserted.find(i => i.table === czClaims)!.values;
    expect(claim).toMatchObject({
      orderId: 3,
      buyerUserId: 50,
      sellerUserId: 7,
      reason: "damaged",
    });
    expect(claim.respondBy.getTime() - now.getTime()).toBe(48 * HOUR);
  });

  it("nadie más puede reclamar ese pedido", async () => {
    const { openClaim } = await import("./services/claims");
    await expect(openClaim(seller, claimInput, now)).rejects.toThrow(
      /no existe/
    );
  });

  it("un pedido pendiente o muy viejo no se puede reclamar", async () => {
    const { openClaim } = await import("./services/claims");
    state.order.status = "pending";
    await expect(openClaim(buyer, claimInput, now)).rejects.toThrow(
      /confirmado, enviado o entregado/
    );
    state.order.status = "delivered";
    state.order.createdAt = new Date(now.getTime() - 90 * 24 * HOUR);
    await expect(openClaim(buyer, claimInput, now)).rejects.toThrow(/60 días/);
  });
});

describe("decidir un reclamo", () => {
  it("no se decide mientras el vendedor tiene plazo y sin respuesta", async () => {
    state.claim = {
      id: 9,
      orderId: 3,
      buyerUserId: 50,
      sellerUserId: 7,
      status: "open",
      respondBy: new Date(now.getTime() + 10 * HOUR),
    };
    const { adminResolveClaim } = await import("./services/claims");
    await expect(
      adminResolveClaim(
        admin,
        { claimId: 9, resolution: "buyer_favor", note: "Reembolsar la taza" },
        now
      )
    ).rejects.toThrow(/todavía tiene plazo/);
    state.claim.status = "answered";
    await expect(
      adminResolveClaim(
        admin,
        { claimId: 9, resolution: "buyer_favor", note: "Reembolsar la taza" },
        now
      )
    ).resolves.toMatchObject({ resolution: "buyer_favor" });
  });

  it("solo el vendedor del pedido responde", async () => {
    state.claim = {
      id: 9,
      orderId: 3,
      buyerUserId: 50,
      sellerUserId: 7,
      status: "open",
      respondBy: new Date(now.getTime() + 10 * HOUR),
    };
    const { respondClaim } = await import("./services/claims");
    await expect(
      respondClaim(
        buyer,
        { claimId: 9, response: "Yo no soy el vendedor" },
        now
      )
    ).rejects.toThrow(/no existe/);
    await expect(
      respondClaim(
        seller,
        { claimId: 9, response: "Te envío otra taza mañana" },
        now
      )
    ).resolves.toEqual({ status: "answered" });
  });
});

describe("suspender vendedores", () => {
  it("un pago extiende el período pero la tienda suspendida sigue oculta", async () => {
    state.app = {
      id: 12,
      userId: 7,
      status: "approved",
      subscriptionStatus: "past_due",
      holdReason: "suspended",
      subscriptionEndsAt: new Date(now.getTime() + 10 * 24 * HOUR),
    };
    const { recordSubscriptionPaymentTx } = await import(
      "./services/subscriptions"
    );
    const result = await recordSubscriptionPaymentTx(
      fakeDb,
      1,
      {
        applicationId: 12,
        planId: "normal",
        months: 1,
        amountCents: 1999,
        method: "yappy",
        reference: "ABC123",
        paidOn: "2026-11-09",
        note: "",
      },
      now
    );
    expect(result.status).toBe("past_due");
    const set = state.updated.find(u => u.table === czApplications)!.values;
    expect(set).toMatchObject({
      subscriptionStatus: "past_due",
      holdReason: "suspended",
    });
  });

  it("al levantar la suspensión vuelve a mostrarse si su período sigue pagado", async () => {
    state.app = {
      id: 12,
      userId: 7,
      status: "approved",
      subscriptionStatus: "past_due",
      holdReason: "suspended",
      subscriptionEndsAt: new Date(now.getTime() + 10 * 24 * HOUR),
    };
    const { unsuspendSeller } = await import("./services/adminPanel");
    await expect(unsuspendSeller(admin, 12, "", now)).resolves.toEqual({
      status: "active",
    });
    state.updated = [];
    state.app.subscriptionEndsAt = new Date(now.getTime() - HOUR);
    await expect(unsuspendSeller(admin, 12, "", now)).resolves.toEqual({
      status: "past_due",
    });
  });
});

describe("moderación", () => {
  it("un servicio oculto por un administrador no se puede volver a publicar", async () => {
    state.service = {
      id: 5,
      userId: 7,
      status: "paused",
      revision: 2,
      moderatedAt: new Date(),
      moderationReason: "Fotos engañosas",
    };
    const { setServiceStatus } = await import("./services/serviceListings");
    await expect(setServiceStatus(seller, 5, "published")).rejects.toThrow(
      /Fotos engañosas/
    );
  });
});
