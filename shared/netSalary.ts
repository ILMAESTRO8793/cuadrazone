/**
 * Salario neto en Panamá (cálculo aproximado para el empleado).
 *
 * - Seguro Social (CSS): 9.75% del salario.
 * - Seguro Educativo: 1.25% del salario.
 * - Impuesto sobre la renta (ISR), tabla anual:
 *   hasta US$11,000 no paga; de US$11,000 a US$50,000 paga 15% del excedente;
 *   más de US$50,000 paga US$5,850 más 25% del excedente.
 *   La renta anual se calcula con 13 salarios (incluye el décimo tercer mes) y
 *   el impuesto se reparte en esos 13 pagos.
 */
export const CSS_RATE = 0.0975;
export const EDUCATION_RATE = 0.0125;
export const ISR_FREE_UP_TO = 11_000_00;
export const ISR_SECOND_BRACKET_FROM = 50_000_00;
export const ISR_SECOND_BRACKET_BASE = 5_850_00;

/** Impuesto sobre la renta de un año, en centavos. */
export function annualIncomeTaxCents(annualCents: number): number {
  if (annualCents <= ISR_FREE_UP_TO) return 0;
  if (annualCents <= ISR_SECOND_BRACKET_FROM)
    return Math.round((annualCents - ISR_FREE_UP_TO) * 0.15);
  return Math.round(
    ISR_SECOND_BRACKET_BASE + (annualCents - ISR_SECOND_BRACKET_FROM) * 0.25
  );
}

export type NetSalary = {
  grossCents: number;
  cssCents: number;
  educationCents: number;
  incomeTaxCents: number;
  deductionsCents: number;
  netCents: number;
  /** Lo que llega cada quincena (la mitad del neto del mes). */
  netQuincenaCents: number;
};

/** Descuentos y neto de un salario bruto mensual (en centavos). */
export function netSalary(grossMonthlyCents: number): NetSalary {
  const gross = Math.max(0, Math.round(grossMonthlyCents));
  const cssCents = Math.round(gross * CSS_RATE);
  const educationCents = Math.round(gross * EDUCATION_RATE);
  const incomeTaxCents = Math.round(annualIncomeTaxCents(gross * 13) / 13);
  const deductionsCents = cssCents + educationCents + incomeTaxCents;
  const netCents = gross - deductionsCents;
  return {
    grossCents: gross,
    cssCents,
    educationCents,
    incomeTaxCents,
    deductionsCents,
    netCents,
    netQuincenaCents: Math.round(netCents / 2),
  };
}

/** Pasa un sueldo al mes; por hora o por proyecto no se puede calcular. */
export function monthlyCents(
  amountCents: number,
  period: "mes" | "quincena" | "hora" | "proyecto"
): number | null {
  if (period === "mes") return amountCents;
  if (period === "quincena") return amountCents * 2;
  return null;
}
