import { z } from "zod";

export const STORE_LINK_MAX = 300;

/**
 * Convierte lo que escribe el vendedor en un enlace seguro, o null si no sirve.
 * Acepta «https://mitienda.com», «mitienda.com», «@polytalk» (Instagram) e
 * «instagram.com/polytalk». Solo devuelve direcciones https.
 */
export function normalizeStoreLink(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;
  const handle = /^@([A-Za-z0-9._]{1,30})$/.exec(text);
  if (handle) return `https://instagram.com/${handle[1]}`;
  if (/^http:\/\//i.test(text)) text = text.replace(/^http:/i, "https:");
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
  const out = url.toString();
  return out.length <= STORE_LINK_MAX ? out : null;
}

/** Nombre corto para mostrar: «instagram.com/polytalk» o «polytalk.com». */
export function storeLinkLabel(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return u.hostname.replace(/^www\./, "") + path;
  } catch {
    return url;
  }
}

export const saveStoreLinkInput = z
  .object({
    url: z
      .string()
      .trim()
      .max(STORE_LINK_MAX)
      .refine(v => v === "" || normalizeStoreLink(v) !== null, {
        message:
          "Escribe una dirección válida, p. ej. https://tunegocio.com o @tuinstagram",
      }),
  })
  .strict();
export type SaveStoreLinkInput = z.infer<typeof saveStoreLinkInput>;
