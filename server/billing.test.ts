import { describe, expect, it } from "vitest";
import {
  commissionDeadline,
  nextPanamaMonthStart,
  panamaMonthKey,
  panamaMonthStart,
  paymentClaimInput,
  splitCommission,
} from "@shared/billing";
import { claimAmounts } from "./services/billing";
import { platformPaymentDetails } from "./services/subscriptions";

// Panamá es UTC−5 todo el año: la medianoche del 1 de noviembre es 05:00 UTC.
const pa = (iso: string) => new Date(`${iso}-05:00`);

describe("meses en hora de Panamá", () => {
  it("el mes empieza a la medianoche de Panamá, no de UTC", () => {
    expect(panamaMonthStart(pa("2026-11-07T10:00:00")).toISOString()).toBe(
      "2026-11-01T05:00:00.000Z"
    );
    // 31 de octubre a las 11 p. m. en Panamá ya es 1 de noviembre en UTC, pero sigue siendo octubre.
    expect(panamaMonthKey(pa("2026-10-31T23:00:00"))).toBe("2026-10");
    expect(panamaMonthStart(pa("2026-10-31T23:00:00")).toISOString()).toBe(
      "2026-10-01T05:00:00.000Z"
    );
  });

  it("el mes siguiente cruza el año", () => {
    expect(nextPanamaMonthStart(pa("2026-12-15T12:00:00")).toISOString()).toBe(
      "2027-01-01T05:00:00.000Z"
    );
  });
});

describe("plazo de la comisión mensual", () => {
  const delivered = pa("2026-10-20T12:00:00");

  it("mientras el mes no cierra, se acumula", () => {
    expect(commissionDeadline(delivered, pa("2026-10-31T23:59:00")).stage).toBe(
      "accruing"
    );
  });

  it("al cerrar el mes hay que pagar; a los 7 días, recordatorio; a los 15, se oculta", () => {
    expect(commissionDeadline(delivered, pa("2026-11-01T00:00:00")).stage).toBe(
      "due"
    );
    expect(commissionDeadline(delivered, pa("2026-11-07T23:59:00")).stage).toBe(
      "due"
    );
    expect(commissionDeadline(delivered, pa("2026-11-08T00:00:00")).stage).toBe(
      "reminder"
    );
    expect(commissionDeadline(delivered, pa("2026-11-15T23:59:00")).stage).toBe(
      "reminder"
    );
    expect(commissionDeadline(delivered, pa("2026-11-16T00:00:00")).stage).toBe(
      "overdue"
    );
  });

  it("da la fecha límite y la clave del mes", () => {
    const d = commissionDeadline(delivered, pa("2026-11-02T09:00:00"));
    expect(d.suspendAt.toISOString()).toBe("2026-11-16T05:00:00.000Z");
    expect(d.monthKey).toBe("2026-10");
  });
});

describe("reparto de la comisión pendiente", () => {
  const now = pa("2026-11-07T10:00:00");

  it("separa los meses cerrados de lo que se acumula este mes", () => {
    const split = splitCommission(
      [
        { commissionCents: 400, deliveredAt: pa("2026-09-30T20:00:00") },
        { commissionCents: 250, deliveredAt: pa("2026-10-31T23:00:00") },
        { commissionCents: 100, deliveredAt: pa("2026-11-02T08:00:00") },
      ],
      now
    );
    expect(split.dueCents).toBe(650);
    expect(split.dueCount).toBe(2);
    expect(split.accruingCents).toBe(100);
    expect(split.cutoff.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    // El plazo lo marca la deuda más antigua (septiembre): ya pasó de 15 días.
    expect(split.deadline?.monthKey).toBe("2026-09");
    expect(split.deadline?.stage).toBe("overdue");
  });

  it("sin meses cerrados no hay plazo", () => {
    const split = splitCommission(
      [{ commissionCents: 100, deliveredAt: pa("2026-11-02T08:00:00") }],
      now
    );
    expect(split.dueCents).toBe(0);
    expect(split.deadline).toBeNull();
  });
});

describe("montos del aviso «Ya pagué»", () => {
  it("la mensualidad sale del precio del plan por los meses", () => {
    expect(
      claimAmounts({ concept: "subscription", planId: "normal", months: 2 }, 0)
    ).toEqual({
      subscriptionCents: 3998,
      commissionCents: 0,
      amountCents: 3998,
    });
  });

  it("la comisión es la de los meses cerrados, calculada en el servidor", () => {
    expect(claimAmounts({ concept: "commission" }, 650)).toEqual({
      subscriptionCents: 0,
      commissionCents: 650,
      amountCents: 650,
    });
    expect(
      claimAmounts(
        { concept: "both", planId: "mayor_visibilidad", months: 1 },
        650
      ).amountCents
    ).toBe(3999 + 650);
  });

  it("no acepta pagar comisión si no hay nada vencido", () => {
    expect(() => claimAmounts({ concept: "commission" }, 0)).toThrow(
      /No tienes comisión/
    );
  });

  it("el formulario pide plan y meses para la mensualidad, y no acepta campos de monto", () => {
    const base = { method: "yappy", reference: "ABC123", paidOn: "2026-11-05" };
    expect(
      paymentClaimInput.safeParse({ ...base, concept: "subscription" }).success
    ).toBe(false);
    expect(
      paymentClaimInput.safeParse({
        ...base,
        concept: "subscription",
        planId: "normal",
        months: 1,
      }).success
    ).toBe(true);
    expect(
      paymentClaimInput.safeParse({ ...base, concept: "commission" }).success
    ).toBe(true);
    expect(
      paymentClaimInput.safeParse({
        ...base,
        concept: "commission",
        amountCents: 1,
      }).success
    ).toBe(false);
    expect(
      paymentClaimInput.safeParse({
        ...base,
        concept: "commission",
        method: "efectivo",
      }).success
    ).toBe(false);
  });
});

describe("datos de pago de CuadraZone", () => {
  it("solo muestra lo que está completo", () => {
    expect(platformPaymentDetails({})).toEqual({
      yappy: null,
      bank: null,
      cardUrl: null,
      whatsapp: null,
    });
    const details = platformPaymentDetails({
      PAYMENT_YAPPY: "6000-0000",
      PAYMENT_YAPPY_NAME: "CuadraZone",
      PAYMENT_BANK_NAME: "Banco General",
      PAYMENT_BANK_ACCOUNT: "04-00-00-000000-0",
      PAYMENT_BANK_HOLDER: "Salem Pierre",
      PAYMENT_BANK_ACCOUNT_TYPE: "Ahorros",
      PAYMENT_CARD_URL: "https://checkout.tilopay.com/pago/cuadrazone",
      PAYMENT_CONTACT: "+507 6000-0000",
    });
    expect(details.yappy).toEqual({ number: "6000-0000", name: "CuadraZone" });
    expect(details.bank).toEqual({
      bank: "Banco General",
      account: "04-00-00-000000-0",
      holder: "Salem Pierre",
      accountType: "Ahorros",
    });
    expect(details.cardUrl).toBe(
      "https://checkout.tilopay.com/pago/cuadrazone"
    );
    expect(details.whatsapp).toBe("50760000000");
  });

  it("no muestra una cuenta bancaria a medias", () => {
    expect(
      platformPaymentDetails({
        PAYMENT_BANK_NAME: "Banco General",
        PAYMENT_BANK_ACCOUNT: "123",
      }).bank
    ).toBeNull();
  });

  it("el enlace de tarjeta tiene que ser https y sin credenciales", () => {
    expect(
      platformPaymentDetails({ PAYMENT_CARD_URL: "http://pago.example.com" })
        .cardUrl
    ).toBeNull();
    expect(
      platformPaymentDetails({
        PAYMENT_CARD_URL: "https://user:pass@pago.example.com",
      }).cardUrl
    ).toBeNull();
    expect(
      platformPaymentDetails({ PAYMENT_CARD_URL: "javascript:alert(1)" })
        .cardUrl
    ).toBeNull();
  });
});
