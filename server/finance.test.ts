import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCE_SETTINGS,
  financeSettingsInput,
  naturalPersonIsrCents,
  splitProfit,
} from "@shared/finance";

describe("ISR de personas naturales (Panamá)", () => {
  it("exenta hasta US$11 000", () => {
    expect(naturalPersonIsrCents(11_000_00)).toBe(0);
  });
  it("15 % del excedente entre 11 000 y 50 000", () => {
    expect(naturalPersonIsrCents(21_000_00)).toBe(1_500_00);
    expect(naturalPersonIsrCents(50_000_00)).toBe(5_850_00);
  });
  it("US$5 850 + 25 % sobre 50 000", () => {
    expect(naturalPersonIsrCents(60_000_00)).toBe(8_350_00);
  });
});

describe("reparto entre socios", () => {
  it("resta gastos, deja 10 % de caja y reparte 50/50", () => {
    const r = splitProfit(30_000_00, 10_000_00, DEFAULT_FINANCE_SETTINGS, 12);
    expect(r.profitCents).toBe(20_000_00);
    expect(r.reserveCents).toBe(2_000_00);
    expect(r.distributableCents).toBe(18_000_00);
    expect(r.partners.map(p => p.grossCents)).toEqual([9_000_00, 9_000_00]);
    // 9 000 al año queda exento.
    expect(r.partners.every(p => p.taxCents === 0)).toBe(true);
  });
  it("con pérdida no reparte nada", () => {
    const r = splitProfit(1_000_00, 3_000_00, DEFAULT_FINANCE_SETTINGS, 12);
    expect(r.profitCents).toBe(-2_000_00);
    expect(r.distributableCents).toBe(0);
    expect(r.partners.every(p => p.grossCents === 0)).toBe(true);
  });
  it("separa el ITBMS cuando los cobros lo incluyen", () => {
    const r = splitProfit(107_00, 0, { ...DEFAULT_FINANCE_SETTINGS, itbmsIncluded: true }, 12);
    expect(r.itbmsCents).toBe(7_00);
    expect(r.netIncomeCents).toBe(100_00);
  });
  it("como S.A.: 25 % ISR y 10 % de dividendos", () => {
    const r = splitProfit(100_000_00, 0, { ...DEFAULT_FINANCE_SETTINGS, entity: "sociedad_anonima" }, 12);
    expect(r.corporateIsrCents).toBe(25_000_00);
    expect(r.reserveCents).toBe(7_500_00);
    expect(r.partners[0]!.grossCents).toBe(33_750_00);
    expect(r.partners[0]!.taxCents).toBe(3_375_00);
  });
  it("anualiza el ISR de un solo mes", () => {
    // 2 000/mes → 24 000/año → ISR 1 950/año → 162.50/mes
    const r = splitProfit(4_444_44 + 1, 0, { ...DEFAULT_FINANCE_SETTINGS, reservePct: 10 }, 1);
    expect(r.partners[0]!.grossCents).toBe(2_000_00);
    expect(r.partners[0]!.taxCents).toBe(162_50);
  });
  it("las acciones deben sumar 100 %", () => {
    expect(
      financeSettingsInput.safeParse({
        ...DEFAULT_FINANCE_SETTINGS,
        partners: [{ name: "A", sharePct: 60 }, { name: "B", sharePct: 30 }],
      }).success
    ).toBe(false);
  });
});
