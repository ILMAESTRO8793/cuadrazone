import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_CATALOG_VERSION } from "@shared/pricing";
import { czMembershipAudit, czPlanSelections, users } from "../drizzle/schema";

let database: MockDb;

vi.mock("./db", () => ({
  getDb: async () => database,
}));

const { getPlanSelection, selectSellerPlan, validatePlanSelectionInput } =
  await import("./services/sellerPlans");

type MockRow = {
  id: number;
  userId: number;
  planId: "normal" | "mayor_visibilidad";
  catalogVersion: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};

class MockDb {
  row: MockRow | undefined;
  audit: unknown[] = [];
  updateAffectedRows = 1;
  ownerExists = true;

  select() {
    const self = this;
    const builder = {
      table: undefined as unknown,
      from(table: unknown) {
        builder.table = table;
        return builder;
      },
      where() {
        return builder;
      },
      for() {
        return builder;
      },
      async limit() {
        if (builder.table === users) return self.ownerExists ? [{ id: 7 }] : [];
        return self.row ? [self.row] : [];
      },
    };
    return builder;
  }

  insert(table: unknown) {
    const self = this;
    return {
      async values(values: any) {
        if (table === czPlanSelections) {
          if (self.row) {
            const error = new Error("Duplicate entry");
            (error as any).code = "ER_DUP_ENTRY";
            throw error;
          }
          self.row = { id: 1, ...values };
        } else if (table === czMembershipAudit) {
          self.audit.push(values);
        }
        return { affectedRows: 1 };
      },
    };
  }

  update(table: unknown) {
    const self = this;
    return {
      set(values: Partial<MockRow>) {
        return {
          async where() {
            if (table === czPlanSelections && self.updateAffectedRows === 1 && self.row)
              self.row = { ...self.row, ...values } as MockRow;
            return { affectedRows: self.updateAffectedRows };
          },
        };
      },
    };
  }

  transaction<T>(fn: (tx: this) => Promise<T>) {
    return fn(this);
  }
}

const input = (overrides: Record<string, unknown> = {}) => ({
  planId: "normal",
  catalogVersion: PLAN_CATALOG_VERSION,
  expectedRevision: 0,
  acknowledgePending: true,
  ...overrides,
});

describe("seller plan preference — memory-only DB mocks", () => {
  beforeEach(() => {
    database = new MockDb();
  });

  it("creates the first preference at revision 1 and audits the derived price", async () => {
    const result = await selectSellerPlan(7, input());

    expect(result).toMatchObject({
      planId: "normal",
      catalogVersion: PLAN_CATALOG_VERSION,
      revision: 1,
    });
    expect(database.audit).toEqual([
      expect.objectContaining({
        userId: 7,
        actorUserId: 7,
        action: "plan_selected",
        metadata: {
          planId: "normal",
          catalogVersion: PLAN_CATALOG_VERSION,
          monthlyCents: 1999,
        },
      }),
    ]);
  });

  it("updates an existing preference with the expected revision", async () => {
    await selectSellerPlan(7, input());
    const result = await selectSellerPlan(
      7,
      input({ planId: "mayor_visibilidad", expectedRevision: 1 })
    );

    expect(result).toMatchObject({ planId: "mayor_visibilidad", revision: 2 });
    expect(database.row?.revision).toBe(2);
    expect(database.audit).toHaveLength(2);
    expect(database.audit[1]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({ monthlyCents: 3999 }),
      })
    );
  });

  it("rejects stale revisions and never reports a failed conditional update as success", async () => {
    await selectSellerPlan(7, input());
    await expect(selectSellerPlan(7, input({ expectedRevision: 0 }))).rejects.toMatchObject({
      code: "CONFLICT",
    });

    database.updateAffectedRows = 0;
    await expect(
      selectSellerPlan(7, input({ expectedRevision: 1, planId: "mayor_visibilidad" }))
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(database.audit).toHaveLength(1);
  });

  it("returns null when no preference exists", async () => {
    await expect(getPlanSelection(7)).resolves.toBeNull();
  });

  it("requires a valid, existing owner before selecting a plan", async () => {
    await expect(selectSellerPlan(0, input())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    database.ownerExists = false;
    await expect(selectSellerPlan(7, input())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(database.row).toBeUndefined();
    expect(database.audit).toHaveLength(0);
  });

  it("rejects stale catalog, unknown IDs, and client-supplied price keys", () => {
    expect(() => validatePlanSelectionInput(input({ catalogVersion: "old" }))).toThrow();
    expect(() => validatePlanSelectionInput(input({ planId: "premium" }))).toThrow();
    expect(() => validatePlanSelectionInput(input({ priceCents: 1999 }))).toThrow();
  });
});
