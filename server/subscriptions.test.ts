import { describe, expect, it } from "vitest";
import { addMonths, computePeriod, expectedAmountCents, validatePaymentInput, type RecordPaymentInput } from "./services/subscriptions";

const today = new Date("2026-10-20T15:00:00Z");
const base: RecordPaymentInput = {
  applicationId: 1, planId: "normal", months: 1, amountCents: 1999,
  method: "yappy", reference: "YP-123456", paidOn: "2026-10-20", note: "",
};

describe("períodos de suscripción", () => {
  it("suma meses de calendario sin desbordar fin de mes", () => {
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T10:00:00Z"), 1).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addMonths(new Date("2026-10-20T15:00:00Z"), 3).toISOString()).toBe("2027-01-20T15:00:00.000Z");
    expect(addMonths(new Date("2026-12-15T00:00:00Z"), 12).toISOString()).toBe("2027-12-15T00:00:00.000Z");
  });
  it("empieza hoy si nunca pagó o ya venció", () => {
    for (const current of [
      { status: "not_started", endsAt: null },
      { status: "past_due", endsAt: new Date("2026-09-01T00:00:00Z") },
      { status: "active", endsAt: new Date("2026-10-01T00:00:00Z") },
      { status: "cancelled", endsAt: new Date("2026-12-01T00:00:00Z") },
    ]) {
      const period = computePeriod(current, today, 1);
      expect(period.start.toISOString()).toBe(today.toISOString());
      expect(period.end.toISOString()).toBe("2026-11-20T15:00:00.000Z");
    }
  });
  it("continúa desde el vencimiento vigente para no perder días pagados", () => {
    const period = computePeriod({ status: "active", endsAt: new Date("2026-11-05T12:00:00Z") }, today, 2);
    expect(period.start.toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(period.end.toISOString()).toBe("2027-01-05T12:00:00.000Z");
  });
});

describe("validación del pago", () => {
  it("calcula el monto por plan y meses", () => {
    expect(expectedAmountCents("normal", 1)).toBe(1999);
    expect(expectedAmountCents("mayor_visibilidad", 3)).toBe(11997);
  });
  it("acepta un pago correcto y limpia la referencia", () => {
    expect(validatePaymentInput({ ...base, reference: "  YP-1  " }, today).reference).toBe("YP-1");
    expect(validatePaymentInput({ ...base, method: "efectivo", reference: "" }, today).method).toBe("efectivo");
  });
  it("rechaza montos, meses, fechas y referencias inválidas", () => {
    const bad: Array<[Partial<RecordPaymentInput>, RegExp]> = [
      [{ amountCents: 2000 }, /US\$19\.99/],
      [{ planId: "mayor_visibilidad" }, /US\$39\.99/],
      [{ months: 0 }, /meses/],
      [{ months: 13, amountCents: 1999 * 13 }, /meses/],
      [{ reference: "" }, /comprobante/],
      [{ paidOn: "2026-02-30" }, /Fecha/],
      [{ paidOn: "20-10-2026" }, /Fecha/],
      [{ paidOn: "2026-10-25" }, /futura/],
      [{ paidOn: "2026-05-01" }, /120 días/],
    ];
    for (const [patch, message] of bad) {
      expect(() => validatePaymentInput({ ...base, ...patch }, today)).toThrow(message);
    }
  });
});

import { commissionBpsAt, commissionCents, commissionPercentLabel, isInTrial, subscriptionPlanName } from "../shared/pricing";

describe("comisión por venta", () => {
  it("cobra 8% mientras dura la prueba y 5% después, aunque pague por adelantado", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    expect(commissionBpsAt(new Date("2027-01-22T12:00:00Z"), now)).toBe(800);
    expect(commissionBpsAt("2027-01-22T12:00:00.000Z", now)).toBe(800);
    expect(commissionBpsAt(new Date("2026-10-22T11:59:59Z"), now)).toBe(500);
    expect(commissionBpsAt(null, now)).toBe(500);
    expect(commissionBpsAt("no es fecha", now)).toBe(500);
    expect(isInTrial(new Date("2027-01-01T00:00:00Z"), now)).toBe(true);
    expect(commissionPercentLabel(800)).toBe("8%");
  });
  it("calcula sobre el subtotal y redondea al centavo", () => {
    expect(commissionCents(2500, 800)).toBe(200);
    expect(commissionCents(2500, 500)).toBe(125);
    expect(commissionCents(1999, 500)).toBe(100); // 99.95 → 100
    expect(commissionCents(1, 800)).toBe(0);
    expect(commissionCents(0, 800)).toBe(0);
    expect(() => commissionCents(-1, 500)).toThrow();
    expect(() => commissionCents(100, 20000)).toThrow();
  });
  it("nombra los planes vigentes, incluida la prueba", () => {
    expect(subscriptionPlanName("prueba")).toBe("Prueba gratis (3 meses)");
    expect(subscriptionPlanName("normal")).toBe("Normal");
    expect(subscriptionPlanName("desconocido")).toBe("Sin plan");
  });
});

import { saveStoreInput, storeAcceptsYappy } from "../shared/marketplace";

describe("Yappy del vendedor", () => {
  const base = { name: "Tienda", description: "", province: "Panamá", city: "Colón" };
  it("acepta celular de Panamá o vacío y rechaza otros formatos", () => {
    expect(saveStoreInput.parse({ ...base }).yappyPhone).toBe("");
    expect(saveStoreInput.parse({ ...base, yappyPhone: "+50761234567" }).yappyPhone).toBe("+50761234567");
    for (const bad of ["61234567", "+5076123456", "+50661234567", "+507 6123-4567"]) {
      expect(saveStoreInput.safeParse({ ...base, yappyPhone: bad }).success).toBe(false);
    }
  });
  it("solo recibe Yappy si registró celular o directorio", () => {
    expect(storeAcceptsYappy({ yappyPhone: null, yappyDirectory: null })).toBe(false);
    expect(storeAcceptsYappy({ yappyPhone: "+50761234567", yappyDirectory: null })).toBe(true);
    expect(storeAcceptsYappy({ yappyPhone: null, yappyDirectory: "Mi Tienda" })).toBe(true);
  });
});

import { isAllowedCardLink } from "../shared/marketplace";
import { paymentStatusFor } from "../shared/commerce";

describe("pago con tarjeta", () => {
  it("solo acepta links https de plataformas de pago conocidas", () => {
    for (const ok of [
      "https://tilopay.com/pagar/abc",
      "https://app.tilopay.com/link/123",
      "https://checkout.paguelofacil.com/LK-123",
      "https://www.paypal.com/ncp/payment/XYZ",
      "https://paypal.me/mitienda/25",
    ]) expect(isAllowedCardLink(ok)).toBe(true);
    for (const bad of [
      "http://tilopay.com/pagar",
      "https://tilopay.com.ladron.com/pagar",
      "https://falsotilopay.com/pagar",
      "https://usuario:clave@tilopay.com/pagar",
      "https://tilopay.com:8443/pagar",
      "javascript:alert(1)",
      "https://bit.ly/abc",
      "no es un link",
    ]) expect(isAllowedCardLink(bad)).toBe(false);
  });
  it("tarjeta al recibir queda pendiente como el efectivo; el link espera el pago", () => {
    expect(paymentStatusFor("card_on_delivery")).toBe("pending");
    expect(paymentStatusFor("card_link")).toBe("awaiting_payment");
  });
});
