/*
 * Etapa 6 · Panel del vendedor: reglas compartidas del resumen y los reportes.
 * Los meses se cuentan en hora de Panamá, igual que el cobro de comisiones.
 */
import { panamaMonthKey, panamaMonthStart } from "./billing";

/** Meses que muestra el reporte de ventas. */
export const REPORT_MONTHS = 6;
/** Existencias desde las que se avisa «poco inventario». */
export const LOW_STOCK_THRESHOLD = 3;
/** Días que cuenta «lo más vendido». */
export const TOP_PRODUCTS_DAYS = 90;

export type MonthSales = {
  /** «2026-11» */
  month: string;
  productsCents: number;
  orders: number;
  ticketsCents: number;
  tickets: number;
  commissionCents: number;
};

/** «2026-11» → «nov. 2026» */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PA", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, 15)));
}

/** Primer día (UTC) del mes de Panamá de hace `back` meses. */
export function monthsAgoStart(now: Date, back: number): Date {
  let start = panamaMonthStart(now);
  for (let i = 0; i < back; i++)
    start = panamaMonthStart(new Date(start.getTime() - 1));
  return start;
}

/**
 * Ventas por mes: pedidos entregados (sin el envío) y boletos pagados, con la
 * comisión de cada mes. Siempre devuelve los últimos REPORT_MONTHS meses, del
 * más viejo al actual, aunque alguno quede en cero.
 */
export function summarizeSales(
  orders: ReadonlyArray<{
    deliveredAt: Date | string | null;
    subtotalCents: number;
    commissionCents: number;
  }>,
  tickets: ReadonlyArray<{
    paidAt: Date | string | null;
    totalCents: number;
    quantity: number;
    commissionCents: number;
  }>,
  now: Date,
  months = REPORT_MONTHS
): MonthSales[] {
  const out = new Map<string, MonthSales>();
  for (let back = months - 1; back >= 0; back--) {
    const key = panamaMonthKey(monthsAgoStart(now, back));
    out.set(key, {
      month: key,
      productsCents: 0,
      orders: 0,
      ticketsCents: 0,
      tickets: 0,
      commissionCents: 0,
    });
  }
  for (const o of orders) {
    if (!o.deliveredAt) continue;
    const row = out.get(panamaMonthKey(new Date(o.deliveredAt)));
    if (!row) continue;
    row.productsCents += o.subtotalCents;
    row.orders += 1;
    row.commissionCents += o.commissionCents;
  }
  for (const t of tickets) {
    if (!t.paidAt) continue;
    const row = out.get(panamaMonthKey(new Date(t.paidAt)));
    if (!row) continue;
    row.ticketsCents += t.totalCents;
    row.tickets += t.quantity;
    row.commissionCents += t.commissionCents;
  }
  return Array.from(out.values());
}

/** Cambio porcentual de este mes contra el anterior; null si el anterior fue cero. */
export function monthOverMonth(sales: MonthSales[]): number | null {
  const current = sales[sales.length - 1];
  const previous = sales[sales.length - 2];
  if (!current || !previous) return null;
  const before = previous.productsCents + previous.ticketsCents;
  const after = current.productsCents + current.ticketsCents;
  if (before === 0) return null;
  return Math.round(((after - before) / before) * 100);
}
