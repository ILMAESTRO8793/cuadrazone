/** Formatos y etiquetas del Dashboard CuadraZone. */
export const money = (cents: number, decimals = true) =>
  `US$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;

/** US$1.2K, US$34K: para ejes y fichas compactas. */
export const moneyShort = (cents: number) => {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `US$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `US$${Math.round(v / 1000)}K`;
  if (Math.abs(v) >= 1000) return `US$${(v / 1000).toFixed(1)}K`;
  return `US$${Math.round(v)}`;
};

export const int = (n: number) => n.toLocaleString("es-PA");

export const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export const shortMonth = (month: string) =>
  new Intl.DateTimeFormat("es-PA", { month: "short", timeZone: "UTC" })
    .format(new Date(`${month}-15T12:00:00Z`))
    .replace(".", "");

export const dateLabel = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-PA", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "America/Panama",
      }).format(new Date(iso))
    : "—";

/** Variación contra el período anterior; null si no hay base para comparar. */
export const delta = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

export const waLink = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
};

export const deliveryLabels: Record<string, string> = {
  shipping: "Envío a provincias",
  pickup: "Retiro en tienda",
  home: "Entrega a domicilio",
};
export const paymentLabels: Record<string, string> = {
  yappy: "Yappy",
  transfer: "Transferencia",
  transferencia: "Transferencia",
  cod: "Efectivo al recibir",
  efectivo: "Efectivo",
  card_link: "Link de pago con tarjeta",
  card_on_delivery: "Tarjeta al recibir",
  tarjeta: "Tarjeta",
  otro: "Otro",
};
export const storeStatusLabels: Record<string, string> = {
  active: "Activa",
  past_due: "Oculta por pago",
  cancelled: "Desactivada",
  suspended: "Suspendida",
  not_started: "Sin activar",
};

/** Colores de las series (validados para daltonismo sobre fondo claro). */
export const SERIES = {
  suscripciones: "#5b7a1e",
  comisiones: "#d9a400",
  anuncios: "#2a74b8",
  gastos: "#c0583a",
} as const;
