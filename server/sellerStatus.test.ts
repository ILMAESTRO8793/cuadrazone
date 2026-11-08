import { describe, expect, it } from "vitest";
import { sellerStatus } from "../shared/membership";

const now = new Date("2026-11-05T15:00:00Z");
const base = {
  status: "approved" as const,
  storeStatus: "active" as const,
  subscriptionStatus: "active",
  subscriptionEndsAt: "2027-02-05T15:00:00Z",
  trialEndsAt: "2027-02-05T15:00:00Z",
};

describe("estado del vendedor", () => {
  it("en la prueba gratis muestra la fecha de vencimiento y nada pendiente", () => {
    const s = sellerStatus(base, now);
    expect(s.inTrial).toBe(true);
    expect(s.label).toBe(
      "Aprobado · prueba gratis hasta el 5 de febrero de 2027"
    );
    expect(s.notice).toMatch(/vence el 5 de febrero de 2027/);
    expect(s.notice).toMatch(/no pagas mensualidad, solo la comisión/);
    expect(s.label).not.toMatch(/pendiente/);
  });
  it("pagado y activo muestra hasta cuándo", () => {
    const s = sellerStatus(
      {
        ...base,
        trialEndsAt: "2026-10-01T00:00:00Z",
        subscriptionEndsAt: "2026-12-05T15:00:00Z",
      },
      now
    );
    expect(s.inTrial).toBe(false);
    expect(s.label).toBe(
      "Aprobado · tienda activa hasta el 5 de diciembre de 2026"
    );
  });
  it("solo dice pago pendiente cuando venció", () => {
    expect(
      sellerStatus(
        {
          ...base,
          storeStatus: "awaiting_payment",
          subscriptionStatus: "expired",
        },
        now
      ).label
    ).toBe("Aprobado · pago pendiente");
  });
  it("las solicitudes no aprobadas muestran su estado", () => {
    expect(
      sellerStatus({ ...base, status: "pending", storeStatus: "inactive" }, now)
        .label
    ).toBe("Pendiente de revisión");
  });
});
