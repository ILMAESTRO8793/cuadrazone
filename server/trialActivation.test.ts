import { describe, expect, it, vi } from "vitest";
import { TRIAL_PLAN_ID } from "@shared/pricing";

/*
 * Aprobado = activo al instante: una tienda aprobada sin su prueba gratuita
 * debe recibir sus 3 meses gratis, no quedar inactiva por «no haber pagado».
 */
let setValues: any;
let whereClause: any;

vi.mock("./db", () => ({
  getDb: async () => ({
    update: () => ({
      set: (values: any) => {
        setValues = values;
        return {
          where: async (clause: any) => {
            whereClause = clause;
            return [{ affectedRows: 2 }];
          },
        };
      },
    }),
  }),
}));

describe("prueba gratis al aprobar", () => {
  it("activa con 3 meses gratis las tiendas aprobadas que no tenían plan", async () => {
    const { startMissingTrials } = await import("./services/subscriptions");
    const now = new Date("2026-11-08T12:00:00Z");
    const count = await startMissingTrials(now);
    expect(count).toBe(2);
    expect(setValues.subscriptionStatus).toBe("active");
    expect(setValues.subscriptionPlanId).toBe(TRIAL_PLAN_ID);
    expect(setValues.holdReason).toBeNull();
    const ends = new Date(setValues.trialEndsAt);
    expect(ends.toISOString().slice(0, 10)).toBe("2027-02-08");
    expect(setValues.subscriptionEndsAt).toEqual(setValues.trialEndsAt);
    // Solo toca solicitudes aprobadas que nunca empezaron su plan.
    expect(whereClause).toBeTruthy();
  });
});
