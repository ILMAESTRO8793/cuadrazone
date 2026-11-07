/*
 * Acceso con cuenta: para ver CuadraZone hay que iniciar sesión (con correo,
 * celular o Google). Solo quedan abiertas la página de entrada, la ayuda y los
 * documentos legales, que se deben poder leer antes de crear la cuenta.
 */
import { safeReturnPath } from "./const";

const PUBLIC_PATHS = [/^\/entrar\/?$/, /^\/ayuda\/?$/, /^\/legal\/[a-z0-9-]+\/?$/];

/** ¿Se puede ver esta ruta sin haber iniciado sesión? */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(pattern => pattern.test(pathname));
}

/** A dónde mandar a quien llega sin sesión, recordando la página que pedía. */
export function loginRedirectFor(pathWithQuery: string): string {
  const url = new URL(pathWithQuery, "https://cz.invalid");
  const loginError = url.searchParams.get("login_error");
  url.searchParams.delete("login_error");
  const returnTo = safeReturnPath(url.pathname + url.search);
  const params = new URLSearchParams();
  if (returnTo !== "/") params.set("returnTo", returnTo);
  if (loginError) params.set("login_error", loginError);
  const query = params.toString();
  return `/entrar${query ? `?${query}` : ""}`;
}
