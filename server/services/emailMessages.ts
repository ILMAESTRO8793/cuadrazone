// Textos de los correos automáticos. Solo arman el contenido; email.ts lo envía.
import type { EmailContent } from "./email";

const usd = (cents: number) => `US$${(cents / 100).toFixed(2)}`;
const day = (date: Date) =>
  date.toLocaleDateString("es-PA", {
    timeZone: "America/Panama",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const applicationReceived = (): EmailContent => ({
  subject: "Recibimos tu solicitud de vendedor",
  title: "¡Gracias! Recibimos tu solicitud",
  paragraphs: [
    "Tu solicitud para vender en CuadraZone quedó en revisión.",
    "En un plazo de 1 a 3 días te daremos respuesta para confirmarte si fue aprobada o rechazada. Te avisaremos por este mismo correo.",
  ],
  cta: { label: "Ver el estado de mi solicitud", path: "/vendedor" },
});

export const newApplicationForAdmin = (
  name: string,
  church: string
): EmailContent => ({
  subject: `Nueva solicitud de vendedor: ${name}`,
  title: "Hay una nueva solicitud para revisar",
  paragraphs: [
    "Un vendedor envió su solicitud. Recuerda verificar su teléfono antes de aprobarla.",
  ],
  details: [
    ["Solicitante", name],
    ["Iglesia", church || "No indicó"],
  ],
  cta: { label: "Revisar solicitudes", path: "/admin/verificaciones" },
});

export const applicationApproved = (
  trialEndsAt: Date | null
): EmailContent => ({
  subject: "¡Tu tienda en CuadraZone fue aprobada!",
  title: "¡Bienvenido a CuadraZone!",
  paragraphs: [
    "Revisamos tu solicitud y fue aprobada. Tu tienda ya está activa.",
    ...(trialEndsAt
      ? [
          `Tienes 3 meses gratis, hasta el ${day(trialEndsAt)}. Prepara tu tienda y publica tus productos o servicios.`,
        ]
      : []),
  ],
  cta: { label: "Preparar mi tienda", path: "/vendedor/tienda" },
});

export const applicationRejected = (reason: string): EmailContent => ({
  subject: "Sobre tu solicitud de vendedor en CuadraZone",
  title: "Tu solicitud no fue aprobada",
  paragraphs: [
    "Revisamos tu solicitud y por ahora no fue aprobada.",
    ...(reason ? [`Motivo: ${reason}`] : []),
    "Puedes corregir lo indicado y enviarla de nuevo.",
  ],
  cta: { label: "Revisar mi solicitud", path: "/solicitud-vendedor" },
});

export type PaymentInstructions = {
  method: string;
  yappyPhone?: string | null;
  yappyDirectory?: string | null;
  cardLink?: string | null;
};

function paymentLines(p: PaymentInstructions): string[] {
  switch (p.method) {
    case "yappy":
      return [
        `Paga por Yappy a ${[p.yappyPhone, p.yappyDirectory && `Directorio: ${p.yappyDirectory}`].filter(Boolean).join(" · ")}, y escribe tu número de pedido en el mensaje.`,
      ];
    case "card_link":
      return [
        `Paga con tarjeta en el link de pago del vendedor${p.cardLink ? `: ${p.cardLink}` : ""}. Escribe tu número de pedido si te lo pide.`,
      ];
    case "card_on_delivery":
      return [
        "Pagarás con tarjeta en el datáfono del vendedor al retirar o recibir tu pedido.",
      ];
    case "transfer":
      return [
        "Coordina la transferencia con el vendedor por la mensajería del pedido.",
      ];
    default:
      return ["Pagarás en efectivo al recibir tu pedido."];
  }
}

export const orderPlacedBuyer = (
  number: string,
  store: string,
  totalCents: number,
  payment: PaymentInstructions,
  orderId: number
): EmailContent => ({
  subject: `Tu pedido ${number} en ${store}`,
  title: "Registramos tu pedido",
  paragraphs: [
    "Le pagas directo al vendedor. Cuando confirme tu pedido te avisaremos.",
    ...paymentLines(payment),
  ],
  details: [
    ["Pedido", number],
    ["Tienda", store],
    ["Total", usd(totalCents)],
  ],
  cta: { label: "Ver mi pedido", path: `/pedidos/${orderId}` },
});

export const orderPlacedSeller = (
  number: string,
  totalCents: number,
  methodLabel: string,
  orderId: number
): EmailContent => ({
  subject: `Nuevo pedido ${number}`,
  title: "Tienes un nuevo pedido",
  paragraphs: [
    "Revisa el pedido y confírmalo cuando recibas el pago o acuerdes la entrega.",
  ],
  details: [
    ["Pedido", number],
    ["Total", usd(totalCents)],
    ["Pago", methodLabel],
  ],
  cta: { label: "Ver el pedido", path: `/pedidos/${orderId}` },
});

const statusText: Record<string, [string, string]> = {
  confirmed: ["confirmado", "El vendedor confirmó tu pedido."],
  shipped: ["enviado", "Tu pedido va en camino."],
  delivered: [
    "entregado",
    "Tu pedido fue marcado como entregado. Si ya lo recibiste, puedes dejar una reseña.",
  ],
  cancelled: ["cancelado", "El pedido fue cancelado."],
};

export const orderStatusChanged = (
  number: string,
  status: string,
  orderId: number
): EmailContent | null => {
  const text = statusText[status];
  if (!text) return null;
  return {
    subject: `Pedido ${number}: ${text[0]}`,
    title: `Tu pedido fue ${text[0]}`,
    paragraphs: [text[1]],
    details: [["Pedido", number]],
    cta: { label: "Ver el pedido", path: `/pedidos/${orderId}` },
  };
};

export const subscriptionPaymentReceipt = (
  planName: string,
  months: number,
  amountCents: number,
  endsAt: Date
): EmailContent => ({
  subject: "Recibimos el pago de tu mensualidad",
  title: "¡Gracias! Registramos tu pago",
  paragraphs: [`Tu tienda queda activa hasta el ${day(endsAt)}.`],
  details: [
    ["Plan", planName],
    ["Meses", String(months)],
    ["Monto", usd(amountCents)],
  ],
  cta: { label: "Ver mi tienda", path: "/vendedor" },
});

export const commissionPaymentReceipt = (
  amountCents: number,
  orderCount: number
): EmailContent => ({
  subject: "Recibimos el pago de tu comisión",
  title: "¡Gracias! Registramos tu pago de comisión",
  paragraphs: ["Tu comisión pendiente quedó saldada."],
  details: [
    ["Monto", usd(amountCents)],
    ["Pedidos", String(orderCount)],
  ],
  cta: { label: "Ver mi tienda", path: "/vendedor" },
});

export const commissionStatement = (
  amountCents: number,
  orderCount: number,
  suspendAt: Date
): EmailContent => ({
  subject: "Tu comisión del mes en CuadraZone",
  title: "Cerró el mes: este es tu estado de cuenta",
  paragraphs: [
    `La comisión de tus ventas entregadas el mes pasado es de ${usd(amountCents)}.`,
    `Págala antes del ${day(suspendAt)} por Yappy, transferencia o tarjeta, y avísanos con el botón «Ya pagué» en Mi tienda. Si no se paga a tiempo, tu tienda se ocultará hasta que se pague.`,
  ],
  details: [
    ["Comisión", usd(amountCents)],
    ["Pedidos", String(orderCount)],
    ["Fecha límite", day(suspendAt)],
  ],
  cta: { label: "Pagar mi comisión", path: "/vendedor" },
});

export const commissionReminder = (
  amountCents: number,
  suspendAt: Date
): EmailContent => ({
  subject: "Recordatorio: tu comisión está pendiente",
  title: "Tu comisión sigue pendiente",
  paragraphs: [
    `Todavía no hemos recibido el pago de tu comisión de ${usd(amountCents)}.`,
    `Para que tu tienda siga visible, págala antes del ${day(suspendAt)} y avísanos con «Ya pagué» en Mi tienda.`,
  ],
  cta: { label: "Pagar mi comisión", path: "/vendedor" },
});

export const commissionSuspended = (amountCents: number): EmailContent => ({
  subject: "Tu tienda en CuadraZone quedó oculta por la comisión",
  title: "Tu tienda está oculta",
  paragraphs: [
    `Pasó la fecha límite y la comisión de ${usd(amountCents)} sigue sin pagarse, así que tus publicaciones ya no se muestran.`,
    "Paga la comisión y avísanos con «Ya pagué» en Mi tienda: la volvemos a mostrar en cuanto confirmemos el pago.",
  ],
  cta: { label: "Pagar mi comisión", path: "/vendedor" },
});

export const paymentClaimForAdmin = (
  seller: string,
  concept: string,
  amountCents: number,
  method: string
): EmailContent => ({
  subject: `Pago por revisar: ${seller}`,
  title: "Un vendedor avisó que pagó",
  paragraphs: [
    "Revisa el comprobante y confirma que el dinero llegó antes de aprobarlo.",
  ],
  details: [
    ["Vendedor", seller],
    ["Concepto", concept],
    ["Monto", usd(amountCents)],
    ["Método", method],
  ],
  cta: { label: "Revisar pagos", path: "/admin/suscripciones" },
});

export const paymentClaimRejected = (
  amountCents: number,
  reason: string
): EmailContent => ({
  subject: "No pudimos confirmar tu pago",
  title: "Revisa tu aviso de pago",
  paragraphs: [
    `No pudimos confirmar tu pago de ${usd(amountCents)}.`,
    `Motivo: ${reason}`,
    "Revisa los datos y vuelve a avisarnos con «Ya pagué» en Mi tienda.",
  ],
  cta: { label: "Ir a Mi tienda", path: "/vendedor" },
});

export const subscriptionEndingSoon = (
  endsAt: Date,
  inTrial: boolean,
  monthlyLabel: string
): EmailContent => ({
  subject: inTrial
    ? "Tus 3 meses gratis terminan pronto"
    : "Tu mensualidad vence pronto",
  title: inTrial
    ? "Tu prueba gratis está por terminar"
    : "Tu mensualidad está por vencer",
  paragraphs: [
    `Tu tienda está activa hasta el ${day(endsAt)}.`,
    `Para que no se oculte, paga tu mensualidad (${monthlyLabel}) antes de esa fecha. En Mi tienda verás cómo pagar.`,
  ],
  cta: { label: "Cómo pagar", path: "/vendedor" },
});

export const subscriptionExpired = (): EmailContent => ({
  subject: "Tu tienda en CuadraZone quedó oculta",
  title: "Tu suscripción venció",
  paragraphs: [
    "Terminó el período pagado de tu tienda, así que tus publicaciones ya no se muestran.",
    "Paga tu mensualidad y la volvemos a activar en cuanto confirmemos el pago.",
  ],
  cta: { label: "Cómo pagar", path: "/vendedor" },
});

/** Aviso de fin de la prueba gratis (15, 7 y 1 día antes). */
export const trialEndingSoon = (
  endsAt: Date,
  daysLeft: number,
  planName: string,
  monthlyLabel: string
): EmailContent => ({
  subject:
    daysLeft <= 1
      ? "Mañana terminan tus 3 meses gratis"
      : `Tus 3 meses gratis terminan en ${daysLeft} días`,
  title:
    daysLeft <= 1
      ? "Tu prueba gratis termina mañana"
      : "Tu prueba gratis está por terminar",
  paragraphs: [
    `Tus 3 meses gratis en CuadraZone terminan el ${day(endsAt)}.`,
    `Desde esa fecha empieza la mensualidad del plan ${planName} (${monthlyLabel} al mes) y la comisión por venta baja de 8% a 5%.`,
    "Para que tu tienda siga visible, paga tu primera mensualidad antes de esa fecha. En Mi tienda verás cómo pagar y puedes cambiar de plan si lo prefieres.",
  ],
  details: [
    ["Fin de la prueba", day(endsAt)],
    ["Plan elegido", planName],
    ["Mensualidad", monthlyLabel],
  ],
  cta: { label: "Cómo pagar", path: "/vendedor" },
});
