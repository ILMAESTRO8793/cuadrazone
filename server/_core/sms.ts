// Envío de SMS para los códigos de acceso.
// SMS_PROVIDER=gateway (por defecto): un celular Android con la app gratuita
//   «SMS Gateway for Android» (sms-gate.app) envía los SMS desde su propia línea.
//   Variables: SMS_GATEWAY_USER y SMS_GATEWAY_PASSWORD (pantalla principal de la app).
// SMS_PROVIDER=twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM.
// Cambiar de proveedor o de celular es solo cambiar estas variables.

const GATEWAY_URL = "https://api.sms-gate.app/3rdparty/v1/messages";
const TIMEOUT_MS = 15_000;

export function smsProvider(): "gateway" | "twilio" {
  return process.env.SMS_PROVIDER === "twilio" ? "twilio" : "gateway";
}

export function isSmsConfigured() {
  if (smsProvider() === "twilio")
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
  return Boolean(process.env.SMS_GATEWAY_USER && process.env.SMS_GATEWAY_PASSWORD);
}

function basic(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

/** Envía un SMS a un número en formato +507XXXXXXXX. Lanza un error si el proveedor lo rechaza. */
export async function sendSms(phone: string, text: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (smsProvider() === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: basic(sid, process.env.TWILIO_AUTH_TOKEN!), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, From: process.env.TWILIO_FROM!, Body: text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Twilio ${response.status}`);
    return;
  }
  const response = await fetchImpl(process.env.SMS_GATEWAY_URL || GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: basic(process.env.SMS_GATEWAY_USER!, process.env.SMS_GATEWAY_PASSWORD!), "Content-Type": "application/json" },
    body: JSON.stringify({ textMessage: { text }, phoneNumbers: [phone] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`SMS Gateway ${response.status}`);
}
