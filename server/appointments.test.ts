import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  czAppointmentBlocks,
  czAppointments,
  czServiceAvailability,
  czServices,
} from "../drizzle/catalog-schema";
import {
  blocksFor,
  buildSlots,
  panamaDateAt,
  saveAvailabilityInput,
  timeLabel,
} from "@shared/appointments";

/*
 * Etapa 4 · citas. Horas libres en hora de Panamá y reservas sin solaparse.
 * Base de datos falsa en memoria con la clave única (tienda, bloque de 15 min).
 */

// Lunes 16 de noviembre de 2026, de 8:00 a 10:00 (hora de Panamá).
const MONDAY = "2026-11-16";
const mondayMorning = [{ weekday: 1, startMinute: 8 * 60, endMinute: 10 * 60 }];
const sunday = new Date("2026-11-15T15:00:00Z");
const at = (minute: number) => panamaDateAt(MONDAY, minute);

describe("horas libres", () => {
  it("ofrece horas dentro del horario, en hora de Panamá", () => {
    const days = buildSlots({
      windows: mondayMorning,
      durationMinutes: 60,
      busy: [],
      now: sunday,
      days: 3,
    });
    expect(days).toHaveLength(1);
    expect(days[0]!.day).toBe(MONDAY);
    // 8:00, 8:30 y 9:00; la de 9:30 no cabe antes del cierre de las 10:00.
    expect(days[0]!.slots).toEqual([
      "2026-11-16T13:00:00.000Z",
      "2026-11-16T13:30:00.000Z",
      "2026-11-16T14:00:00.000Z",
    ]);
    expect(timeLabel(days[0]!.slots[0]!)).toMatch(/^8:00/);
  });

  it("no ofrece horas que chocan con otra cita", () => {
    const days = buildSlots({
      windows: mondayMorning,
      durationMinutes: 60,
      busy: [{ start: at(9 * 60), end: at(9 * 60 + 30) }],
      now: sunday,
      days: 3,
    });
    expect(days[0]!.slots).toEqual([at(8 * 60).toISOString()]);
  });

  it("pide al menos una hora de anticipación", () => {
    const now = at(7 * 60 + 30);
    const days = buildSlots({
      windows: mondayMorning,
      durationMinutes: 30,
      busy: [],
      now,
      days: 1,
    });
    expect(days[0]!.slots[0]).toBe(at(8 * 60 + 30).toISOString());
  });

  it("una cita de 50 minutos ocupa cuatro bloques de 15", () => {
    expect(blocksFor(at(8 * 60), 50).map(d => d.toISOString())).toEqual([
      at(480).toISOString(),
      at(495).toISOString(),
      at(510).toISOString(),
      at(525).toISOString(),
    ]);
  });

  it("rechaza horarios que se cruzan o que no van de 15 en 15", () => {
    expect(
      saveAvailabilityInput.safeParse({
        windows: [
          { weekday: 1, start: "08:00", end: "12:00" },
          { weekday: 1, start: "11:00", end: "14:00" },
        ],
      }).success
    ).toBe(false);
    expect(
      saveAvailabilityInput.safeParse({
        windows: [{ weekday: 1, start: "08:10", end: "12:00" }],
      }).success
    ).toBe(false);
    expect(
      saveAvailabilityInput.safeParse({
        windows: [{ weekday: 2, start: "12:00", end: "08:00" }],
      }).success
    ).toBe(false);
    const ok = saveAvailabilityInput.safeParse({
      windows: [
        { weekday: 1, start: "08:00", end: "12:00" },
        { weekday: 1, start: "14:00", end: "18:00" },
      ],
    });
    expect(ok.success && ok.data.windows).toEqual([
      { weekday: 1, startMinute: 480, endMinute: 720 },
      { weekday: 1, startMinute: 840, endMinute: 1080 },
    ]);
  });
});

// ───────────── Reservas con base de datos falsa ─────────────

type State = {
  appointments: any[];
  blocks: Map<string, number>;
  services: Record<number, any>;
  lookupId?: number;
};
let state: State;
let nextId = 0;

function chain(fields: any, resolve: (node: any) => unknown) {
  const node: any = { fields };
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

function select(node: any) {
  if (node.table === czServices) return [state.services[1]];
  if (node.table === czServiceAvailability) return mondayMorning;
  if (node.table === czAppointments) {
    if (node.fields && "n" in node.fields) return [{ n: 0 }];
    if (node.fields && "start" in node.fields)
      return state.appointments
        .filter(a => a.status === "confirmed")
        .map(a => ({ start: a.startsAt, end: a.endsAt }));
    return state.appointments.filter(a => a.id === state.lookupId);
  }
  return [];
}

const fakeDb: any = {
  select: (fields?: any) => chain(fields, select),
  insert: (table: unknown) => ({
    values: async (values: any) => {
      await Promise.resolve();
      if (table === czAppointments) {
        const id = ++nextId;
        state.appointments.push({ ...values, id, status: "confirmed" });
        return [{ insertId: id }];
      }
      if (table === czAppointmentBlocks) {
        for (const b of values) {
          const key = `${b.storeId}:${b.blockStart.toISOString()}`;
          if (state.blocks.has(key))
            throw Object.assign(new Error("Duplicate entry"), {
              code: "ER_DUP_ENTRY",
              errno: 1062,
            });
        }
        for (const b of values)
          state.blocks.set(
            `${b.storeId}:${b.blockStart.toISOString()}`,
            b.appointmentId
          );
      }
      return [{ insertId: 1 }];
    },
  }),
  update: (table: unknown) => ({
    set: (values: any) => ({
      where: async () => {
        if (table === czAppointments) {
          const a = state.appointments.find(x => x.id === state.lookupId);
          if (!a || a.status !== "confirmed") return [{ affectedRows: 0 }];
          Object.assign(a, values);
        }
        return [{ affectedRows: 1 }];
      },
    }),
  }),
  delete: (table: unknown) => ({
    where: async () => {
      if (table === czAppointmentBlocks)
        for (const [k, v] of state.blocks)
          if (v === state.lookupId) state.blocks.delete(k);
      return [{ affectedRows: 1 }];
    },
  }),
  // Como en MySQL: si algo falla dentro, se deshace solo lo que insertó esta transacción.
  transaction: async (fn: (tx: any) => unknown) => {
    const mine: number[] = [];
    const tx = {
      ...fakeDb,
      insert: (table: unknown) => ({
        values: async (values: any) => {
          const result = await fakeDb.insert(table).values(values);
          if (table === czAppointments) mine.push(result[0].insertId);
          return result;
        },
      }),
    };
    try {
      return await fn(tx);
    } catch (error) {
      state.appointments = state.appointments.filter(a => !mine.includes(a.id));
      throw error;
    }
  },
};

vi.mock("./db", () => ({ getDb: async () => fakeDb }));
vi.mock("./services/email", () => ({
  queueEmail: vi.fn(async () => true),
  recipientFor: vi.fn(async () => null),
}));

const service = (id: number, durationMinutes: number) => ({
  service: {
    id,
    title: `Servicio ${id}`,
    durationMinutes,
    priceType: "fijo",
    priceCents: 2000,
  },
  store: { id: 4, userId: 9, name: "Barbería La Roca" },
  app: { status: "approved", subscriptionStatus: "active" },
});
const booking = (start: Date, serviceId = 1) => ({
  serviceId,
  startsAt: start.toISOString(),
  clientName: "María Gómez",
  clientPhone: "+507 6123-4567",
});

describe("reservar citas", () => {
  beforeEach(() => {
    state = {
      appointments: [],
      blocks: new Map(),
      services: { 1: service(1, 60) },
    };
  });

  it("dos personas eligen la misma hora a la vez: solo una la obtiene", async () => {
    const { bookAppointment } = await import("./services/appointments");
    const results = await Promise.allSettled([
      bookAppointment({ id: 20 } as any, booking(at(480)), sunday),
      bookAppointment({ id: 21 } as any, booking(at(480)), sunday),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      r => r.status === "rejected"
    ) as PromiseRejectedResult;
    expect(rejected.reason.message).toMatch(/acaba de reservar/);
    expect(state.appointments).toHaveLength(1);
    expect(state.blocks.size).toBe(4);
  });

  it("citas de distinta duración que se cruzan tampoco pasan", async () => {
    const { bookAppointment } = await import("./services/appointments");
    // 8:00–9:00 y 8:30–9:30 en la misma tienda.
    const results = await Promise.allSettled([
      bookAppointment({ id: 20 } as any, booking(at(480)), sunday),
      bookAppointment({ id: 21 } as any, booking(at(510)), sunday),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(state.appointments).toHaveLength(1);
  });

  it("rechaza una hora fuera del horario o ya ocupada", async () => {
    const { bookAppointment } = await import("./services/appointments");
    await expect(
      bookAppointment({ id: 20 } as any, booking(at(7 * 60)), sunday)
    ).rejects.toThrow(/no está disponible/);
    await bookAppointment({ id: 20 } as any, booking(at(480)), sunday);
    await expect(
      bookAppointment({ id: 21 } as any, booking(at(480)), sunday)
    ).rejects.toThrow(/no está disponible/);
  });

  it("el proveedor no reserva en su propia tienda", async () => {
    const { bookAppointment } = await import("./services/appointments");
    await expect(
      bookAppointment({ id: 9 } as any, booking(at(480)), sunday)
    ).rejects.toThrow(/propia tienda/);
  });

  it("al cancelar, la hora queda libre otra vez; nadie más puede cancelarla", async () => {
    const { bookAppointment, cancelAppointment } = await import(
      "./services/appointments"
    );
    const { id } = await bookAppointment(
      { id: 20 } as any,
      booking(at(480)),
      sunday
    );
    state.lookupId = id;
    await expect(
      cancelAppointment({ id: 33 } as any, id, "", sunday)
    ).rejects.toThrow(/no existe/);
    // Ya empezada, el cliente no puede cancelar.
    await expect(
      cancelAppointment({ id: 20 } as any, id, "", at(485))
    ).rejects.toThrow(/ya empezó/);
    await cancelAppointment({ id: 20 } as any, id, "", sunday);
    expect(state.appointments[0].status).toBe("cancelled");
    expect(state.blocks.size).toBe(0);
    await expect(
      bookAppointment({ id: 21 } as any, booking(at(480)), sunday)
    ).resolves.toMatchObject({ startsAt: at(480).toISOString() });
  });
});
