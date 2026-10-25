// Correos automáticos de CuadraZone.
// Railway no permite SMTP en el plan Hobby, así que se envía por la API HTTPS de
// Brevo (300 correos diarios en su plan gratis). Cada correo se guarda en
// cz_email_outbox dentro de la misma transacción del evento que lo origina y
// startEmailWorker() lo envía después, con reintentos. Sin configuración, no se
// encola nada y el sitio funciona igual.
import { and, asc, eq, lte, lt } from "drizzle-orm";
import { czEmailOutbox, czMembershipProfiles, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "../db";

/** Se puede apuntar a un servidor de pruebas con BREVO_API_URL. */
const brevoUrl = () => process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email";
const MAX_ATTEMPTS = 5;
const BATCH = 20;

export function emailSettings() {
  return {
    apiKey: process.env.BREVO_API_KEY ?? "",
    fromEmail: (process.env.EMAIL_FROM ?? "").trim(),
    fromName: (process.env.EMAIL_FROM_NAME ?? "CuadraZone").trim() || "CuadraZone",
  };
}

export function isEmailConfigured() {
  const s = emailSettings();
  return Boolean(s.apiKey && s.fromEmail.includes("@"));
}

// ───────────────────────── Plantilla ─────────────────────────

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Enlace absoluto al sitio. Solo rutas internas. */
export function siteLink(path: string) {
  const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return `${ENV.publicUrl || ""}${safe}`;
}

export type EmailContent = {
  subject: string;
  title: string;
  /** Párrafos de texto plano; se escapan al armar el HTML. */
  paragraphs: string[];
  /** Filas «etiqueta: valor» destacadas (montos, número de pedido…). */
  details?: Array<[string, string]>;
  cta?: { label: string; path: string };
};

export function renderEmail(content: EmailContent): { subject: string; html: string; text: string } {
  const details = (content.details ?? [])
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#4A5568;font-size:14px">${escapeHtml(k)}</td><td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right">${escapeHtml(v)}</td></tr>`)
    .join("");
  const cta = content.cta
    ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(siteLink(content.cta.path))}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#8A6420;color:#FFFFFF;font-weight:700;text-decoration:none">${escapeHtml(content.cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F3F6F5;font-family:Arial,Helvetica,sans-serif;color:#0B1F3B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6F5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #DCE3E1">
<tr><td style="background:#0B1F3B;padding:18px 24px;font-size:22px;font-weight:700;color:#FFFFFF">Cuadra<span style="color:#E2B866">Zone</span></td></tr>
<tr><td style="padding:28px 24px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(content.title)}</h1>
${content.paragraphs.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${escapeHtml(p)}</p>`).join("")}
${details ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;border-top:1px solid #E3E8E6;border-bottom:1px solid #E3E8E6">${details}</table>` : ""}
${cta}
</td></tr>
<tr><td style="padding:16px 24px;background:#F8FAF9;font-size:12px;line-height:1.5;color:#4A5568">Recibes este correo por tu cuenta en CuadraZone, el marketplace con valores cristianos de Panamá. Nunca te pediremos contraseñas ni datos de tarjeta por correo.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    content.title,
    "",
    ...content.paragraphs,
    ...(content.details?.length ? ["", ...content.details.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(content.cta ? ["", `${content.cta.label}: ${siteLink(content.cta.path)}`] : []),
    "",
    "— CuadraZone",
  ].join("\n");
  return { subject: content.subject, html, text };
}

// ───────────────────────── Cola ─────────────────────────

export type Recipient = { email: string; name: string | null };

/** Correo y nombre de un usuario: el correo verificado del perfil o el de su cuenta de Google. */
export async function recipientFor(tx: any, userId: number): Promise<Recipient | null> {
  const rows = await tx
    .select({ email: users.email, name: users.name, profileEmail: czMembershipProfiles.email, verified: czMembershipProfiles.emailVerifiedAt, displayName: czMembershipProfiles.displayName })
    .from(users)
    .leftJoin(czMembershipProfiles, eq(czMembershipProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const email = (row.verified && row.profileEmail) || row.email;
  if (!email || !String(email).includes("@")) return null;
  return { email: String(email), name: row.displayName || row.name || null };
}

/**
 * Encola un correo dentro de la transacción del evento. Si la clave ya existe no
 * hace nada, así un reintento del evento no duplica el aviso.
 */
export async function queueEmail(tx: any, dedupeKey: string, to: Recipient | null, content: EmailContent) {
  if (!to || !isEmailConfigured()) return false;
  const rendered = renderEmail(content);
  await tx
    .insert(czEmailOutbox)
    .values({
      dedupeKey: dedupeKey.slice(0, 191),
      toEmail: to.email.slice(0, 320),
      toName: to.name?.slice(0, 200) ?? null,
      subject: rendered.subject.slice(0, 300),
      html: rendered.html,
      textBody: rendered.text,
    })
    .onDuplicateKeyUpdate({ set: { dedupeKey: dedupeKey.slice(0, 191) } });
  return true;
}

/** Encola el mismo aviso para cada administrador de ADMIN_EMAILS. */
export async function queueAdminEmail(tx: any, dedupeKey: string, content: EmailContent) {
  for (const email of ENV.adminEmails) await queueEmail(tx, `${dedupeKey}:${email}`, { email, name: null }, content);
}

// ───────────────────────── Envío ─────────────────────────

export async function sendViaBrevo(message: { toEmail: string; toName: string | null; subject: string; html: string; textBody: string }, fetchImpl: typeof fetch = fetch) {
  const s = emailSettings();
  const response = await fetchImpl(brevoUrl(), {
    method: "POST",
    headers: { "api-key": s.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: s.fromEmail, name: s.fromName },
      to: [{ email: message.toEmail, ...(message.toName ? { name: message.toName } : {}) }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.textBody,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`Brevo ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

/** Espera antes del siguiente intento: 1, 2, 4, 8 minutos… */
export function retryDelayMs(attempts: number) {
  return Math.min(60, 2 ** Math.max(0, attempts - 1)) * 60_000;
}

/** Envía los correos pendientes. Devuelve cuántos salieron. */
export async function processEmailOutbox(now = new Date(), send = sendViaBrevo): Promise<number> {
  if (!isEmailConfigured()) return 0;
  const db = await getDb();
  if (!db) return 0;
  const pending = await db
    .select()
    .from(czEmailOutbox)
    .where(and(eq(czEmailOutbox.status, "pending"), lte(czEmailOutbox.sendAfter, now), lt(czEmailOutbox.attempts, MAX_ATTEMPTS)))
    .orderBy(asc(czEmailOutbox.id))
    .limit(BATCH);
  let sent = 0;
  for (const message of pending) {
    // Reclama el correo antes de enviarlo para que dos procesos no lo manden dos veces.
    const claimed: any = await db
      .update(czEmailOutbox)
      .set({ attempts: message.attempts + 1, sendAfter: new Date(now.getTime() + retryDelayMs(message.attempts + 1)) })
      .where(and(eq(czEmailOutbox.id, message.id), eq(czEmailOutbox.attempts, message.attempts), eq(czEmailOutbox.status, "pending")));
    const header = Array.isArray(claimed) ? claimed[0] : claimed;
    if (Number(header?.affectedRows ?? 0) !== 1) continue;
    try {
      await send(message);
      await db.update(czEmailOutbox).set({ status: "sent", sentAt: new Date(), lastError: null }).where(eq(czEmailOutbox.id, message.id));
      sent++;
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await db
        .update(czEmailOutbox)
        .set({ lastError: reason, ...(message.attempts + 1 >= MAX_ATTEMPTS ? { status: "failed" as const } : {}) })
        .where(eq(czEmailOutbox.id, message.id));
      console.error(`[Correo] No se pudo enviar #${message.id}: ${reason}`);
    }
  }
  return sent;
}

/** Revisa la bandeja cada 30 segundos (una sola instancia en Railway). */
export function startEmailWorker(intervalMs = 30_000) {
  if (!isEmailConfigured()) {
    console.log("[Correo] Sin BREVO_API_KEY o EMAIL_FROM: los correos automáticos están apagados");
    return null;
  }
  const run = () => processEmailOutbox().catch(error => console.error("[Correo] Error:", error instanceof Error ? error.message : error));
  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}
