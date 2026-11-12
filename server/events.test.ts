import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  czEvents,
  czEventTicketTypes,
  czTicketOrders,
  czTickets,
} from "../drizzle/catalog-schema";
import { czApplications as czApps } from "../drizzle/schema";
import { isTicketCode, parseTicketScan, ticketQrPayload } from "@shared/events";

/*
 * Etapa 4 · eventos y boletos. Base de datos falsa en memoria: las consultas
 * se responden según la tabla y las actualizaciones condicionales se simulan
 * como en MySQL (solo una gana).
 */
const dialect = new MySqlDialect();
const paramsOf = (value: any) => dialect.sqlToQuery(value).params as unknown[];

type Handlers = {
  select: (table: unknown) => unknown;
  update?: (table: unknown, set: any, where: any) => unknown;
  insert?: (table: unknown, values: any) => unknown;
};
let handlers: Handlers;

function chain(resolve: (node: any) => unknown) {
  const node: any = {};
  for (const method of [
    "from",
    "innerJoin",
    "leftJoin",
    "where",
    "limit",
    "orderBy",
    "for",
    "groupBy",
  ])
    node[method] = (...args: unknown[]) => {
      if (method === "from") node.table = args[0];
      return node;
    };
  node.then = (ok: any, err: any) =>
    Promise.resolve()
      .then(() => resolve(node))
      .then(ok, err);
  return node;
}

const fakeDb: any = {
  select: () => chain(node => handlers.select(node.table)),
  selectDistinct: () => chain(node => handlers.select(node.table)),
  update: (table: unknown) => ({
    set: (values: any) => ({
      where: (cond: any) =>
        Promise.resolve().then(
          () => handlers.update?.(table, values, cond) ?? [{ affectedRows: 1 }]
        ),
    }),
  }),
  insert: (table: unknown) => ({
    values: (values: any) =>
      Promise.resolve().then(
        () => handlers.insert?.(table, values) ?? [{ insertId: 1 }]
      ),
  }),
  delete: () => ({ where: async () => [{ affectedRows: 1 }] }),
  transaction: (fn: (tx: any) => unknown) => fn(fakeDb),
};

vi.mock("./db", () => ({ getDb: async () => fakeDb }));
vi.mock("./services/email", () => ({
  queueEmail: vi.fn(async () => true),
  recipientFor: vi.fn(async () => null),
}));

const buyer = { id: 50 } as any;
const organizer = { id: 7 } as any;
const now = new Date("2026-11-09T15:00:00Z");
const event = {
  id: 1,
  userId: 7,
  storeId: 3,
  slug: "concierto-1",
  title: "Concierto de alabanza",
  status: "published",
  startsAt: new Date("2026-12-20T00:30:00Z"),
  venueName: "Auditorio",
};
const approvedApp = {
  status: "approved",
  subscriptionStatus: "active",
  trialEndsAt: null,
};

/** Tipo de entrada con aforo y un contador «taken» como en la tabla. */
function seatTable(type: {
  id: number;
  name: string;
  priceCents: number;
  capacity: number;
  taken: number;
}) {
  const orders: any[] = [];
  const tickets: any[] = [];
  handlers = {
    select: table => {
      if (table === czEventTicketTypes)
        return [{ type: { ...type }, event, app: approvedApp }];
      if (table === czTicketOrders) return [{ n: 0 }];
      return [];
    },
    update: (table, set) => {
      if (table !== czEventTicketTypes) return [{ affectedRows: 1 }];
      const n = Number(paramsOf(set.taken)[0]);
      if (type.taken + n > type.capacity) return [{ affectedRows: 0 }];
      type.taken += n;
      return [{ affectedRows: 1 }];
    },
    insert: (table, values) => {
      if (table === czTicketOrders) {
        orders.push(values);
        return [{ insertId: orders.length }];
      }
      if (table === czTickets) tickets.push(...values);
      return [{ insertId: 1 }];
    },
  };
  return { type, orders, tickets };
}

const reserve = (quantity: number, ticketTypeId = 10) => ({
  ticketTypeId,
  quantity,
  buyerName: "Ana Pérez",
  buyerPhone: "+507 6123-4567",
});

describe("reservar boletos", () => {
  it("nunca vende más que el aforo, aunque dos personas reserven a la vez", async () => {
    const state = seatTable({
      id: 10,
      name: "General",
      priceCents: 1500,
      capacity: 5,
      taken: 0,
    });
    const { reserveTickets } = await import("./services/events");
    const results = await Promise.allSettled([
      reserveTickets(buyer, reserve(3), now),
      reserveTickets({ id: 51 } as any, reserve(3), now),
    ]);
    const ok = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(
      r => r.status === "rejected"
    ) as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]!.reason.message)).toMatch(/quedan|agotaron/);
    expect(state.type.taken).toBe(3);
    expect(state.orders).toHaveLength(1);
    // De pago: queda apartado 48 h, sin boletos todavía.
    expect(state.orders[0].status).toBe("reserved");
    expect(state.orders[0].totalCents).toBe(4500);
    expect(new Date(state.orders[0].expiresAt).getTime() - now.getTime()).toBe(
      48 * 3600 * 1000
    );
    expect(state.tickets).toHaveLength(0);
  });

  it("rechaza cuando ya no queda aforo", async () => {
    const state = seatTable({
      id: 10,
      name: "VIP",
      priceCents: 5000,
      capacity: 2,
      taken: 2,
    });
    const { reserveTickets } = await import("./services/events");
    await expect(reserveTickets(buyer, reserve(1), now)).rejects.toThrow(
      /agotaron/
    );
    expect(state.orders).toHaveLength(0);
  });

  it("un evento gratis entrega los boletos al instante con códigos únicos", async () => {
    const state = seatTable({
      id: 10,
      name: "Entrada libre",
      priceCents: 0,
      capacity: 100,
      taken: 0,
    });
    const { reserveTickets } = await import("./services/events");
    const result = await reserveTickets(buyer, reserve(4), now);
    expect(result.status).toBe("paid");
    expect(state.orders[0].status).toBe("paid");
    expect(state.orders[0].expiresAt).toBeNull();
    expect(state.tickets).toHaveLength(4);
    const codes = state.tickets.map(t => t.code);
    expect(new Set(codes).size).toBe(4);
    for (const code of codes) {
      expect(isTicketCode(code)).toBe(true);
      expect(parseTicketScan(ticketQrPayload(code))).toBe(code);
    }
    expect(state.tickets.every(t => t.holderUserId === buyer.id)).toBe(true);
  });

  it("no deja reservar el propio evento", async () => {
    seatTable({
      id: 10,
      name: "General",
      priceCents: 0,
      capacity: 10,
      taken: 0,
    });
    const { reserveTickets } = await import("./services/events");
    await expect(reserveTickets(organizer, reserve(1), now)).rejects.toThrow(
      /propio evento/
    );
  });
});

describe("escanear en la entrada", () => {
  let ticket: {
    id: number;
    eventId: number;
    status: string;
    usedAt: Date | null;
  };
  beforeEach(() => {
    ticket = { id: 99, eventId: 1, status: "valid", usedAt: null };
    handlers = {
      select: table => {
        if (table === czEvents) return [event];
        if (table === czTickets)
          return [
            {
              ticket: { ...ticket },
              typeName: "General",
              holderName: "Ana Pérez",
            },
          ];
        return [];
      },
      update: table => {
        if (table !== czTickets) return [{ affectedRows: 1 }];
        if (ticket.status !== "valid") return [{ affectedRows: 0 }];
        ticket.status = "used";
        ticket.usedAt = now;
        return [{ affectedRows: 1 }];
      },
    };
  });

  it("el primer escaneo pasa y el segundo se rechaza", async () => {
    const { validateTicket } = await import("./services/events");
    const code = "ABCDEFGHJKLMNPQRSTUV";
    const first = await validateTicket(
      organizer,
      1,
      ticketQrPayload(code),
      now
    );
    expect(first).toMatchObject({ ok: true, holderName: "Ana Pérez" });
    const second = await validateTicket(organizer, 1, code, now);
    expect(second.ok).toBe(false);
    expect(second).toMatchObject({ reason: "Este boleto ya se usó" });
  });

  it("dos escaneos simultáneos del mismo boleto: solo uno pasa", async () => {
    const { validateTicket } = await import("./services/events");
    const code = "ABCDEFGHJKLMNPQRSTUV";
    const results = await Promise.all([
      validateTicket(organizer, 1, code, now),
      validateTicket(organizer, 1, code, now),
    ]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
  });

  it("rechaza códigos que no son boletos y boletos de otro evento", async () => {
    const { validateTicket } = await import("./services/events");
    expect(await validateTicket(organizer, 1, "hola", now)).toMatchObject({
      ok: false,
    });
    ticket.eventId = 2;
    expect(
      await validateTicket(organizer, 1, "ABCDEFGHJKLMNPQRSTUV", now)
    ).toMatchObject({
      ok: false,
      reason: "Este boleto es de otro evento",
    });
  });
});

describe("comisión de boletos", () => {
  it("0% durante la prueba gratis; después 10% Normal y 5% Mayor Visibilidad", async () => {
    const { ticketCommission } = await import("./services/events");
    const trialEnds = new Date("2027-01-01T00:00:00Z");
    expect(ticketCommission(4500, trialEnds, now)).toEqual({ bps: 0, cents: 0 });
    expect(
      ticketCommission(4500, trialEnds, new Date("2027-02-01T00:00:00Z"), "normal")
    ).toEqual({ bps: 1000, cents: 450 });
    expect(
      ticketCommission(1999, null, now, "mayor_visibilidad")
    ).toEqual({ bps: 500, cents: 100 });
  });

  it("al marcar pagado fija la comisión y entrega los boletos", async () => {
    let saved: any;
    const tickets: any[] = [];
    const order = {
      id: 5,
      eventId: 1,
      ticketTypeId: 10,
      buyerUserId: 50,
      quantity: 2,
      totalCents: 3000,
      status: "reserved",
    };
    handlers = {
      select: table => {
        if (table === czTicketOrders) return [{ order, event }];
        if (table === czApps)
          return [{ trialEndsAt: new Date("2026-01-01T00:00:00Z"), planId: "normal" }];
        return [];
      },
      update: (table, set) => {
        if (table === czTicketOrders) saved = set;
        return [{ affectedRows: 1 }];
      },
      insert: (table, values) => {
        if (table === czTickets) tickets.push(...values);
        return [{ insertId: 1 }];
      },
    };
    const { markOrderPaid } = await import("./services/events");
    const result = await markOrderPaid(organizer, 5, now);
    expect(result).toEqual({ status: "paid", commissionCents: 300 });
    expect(saved).toMatchObject({
      status: "paid",
      commissionBps: 1000,
      commissionCents: 300,
      expiresAt: null,
    });
    expect(tickets).toHaveLength(2);
  });

  it("solo el organizador puede marcar pagado", async () => {
    handlers = {
      select: table =>
        table === czTicketOrders
          ? [{ order: { id: 5, status: "reserved", buyerUserId: 50 }, event }]
          : [],
    };
    const { markOrderPaid } = await import("./services/events");
    await expect(markOrderPaid(buyer, 5, now)).rejects.toThrow(/no existe/);
  });
});
