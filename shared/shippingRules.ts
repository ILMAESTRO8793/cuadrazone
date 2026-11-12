/*
 * Reglas de entrega de los comercios (12 de noviembre de 2026):
 * - Compra mínima de US$10 por tienda.
 * - Envío gratis si el vendedor y el comprador están en la misma provincia.
 * - En provincias distintas, el comprador paga el envío y lo acuerda directo
 *   con el vendedor; CuadraZone no lo cobra.
 * Servicios, autos y las demás secciones no tienen envío.
 */
export const MIN_ORDER_CENTS = 1000;
export const MIN_ORDER_LABEL = "US$10";

export type ShippingDeal = "free" | "coordinate";

const norm = (p: string) =>
  p.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** «free»: misma provincia. «coordinate»: el comprador lo acuerda y paga con el vendedor. */
export function shippingDeal(
  storeProvince: string,
  buyerProvince: string
): ShippingDeal {
  return storeProvince && norm(storeProvince) === norm(buyerProvince)
    ? "free"
    : "coordinate";
}

export function shippingDealLabel(
  storeProvince: string,
  buyerProvince: string
) {
  return shippingDeal(storeProvince, buyerProvince) === "free"
    ? `Envío gratis dentro de ${storeProvince}`
    : `Envío desde ${storeProvince}: lo acuerdas y pagas directo con el vendedor`;
}

/** ¿El pedido de una tienda llega al mínimo? */
export function meetsMinimum(subtotalCents: number) {
  return subtotalCents >= MIN_ORDER_CENTS;
}
