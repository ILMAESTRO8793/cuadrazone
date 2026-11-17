/**
 * Instagram en el CV: la persona escribe solo su usuario y guardamos el enlace
 * completo (https://www.instagram.com/usuario). También acepta «@usuario» o el
 * enlace pegado entero.
 */
export const INSTAGRAM_BASE = "https://www.instagram.com/";

/** Deja solo el usuario: sin @, sin el enlace y sin letras que Instagram no usa. */
export function instagramUserFrom(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]!
    .replace(/[^A-Za-z0-9._]/g, "")
    .slice(0, 30);
}

/** Enlace completo a partir de lo que escribió la persona ("" si está vacío). */
export function instagramUrlFrom(value: string): string {
  const user = instagramUserFrom(value);
  return user ? `${INSTAGRAM_BASE}${user}` : "";
}
