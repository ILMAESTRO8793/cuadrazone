export const COOKIE_NAME = "cz_session";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Cookie de un solo uso que vincula un inicio de sesión con el navegador que lo
// empezó (protección CSRF del flujo OAuth). Solo la escribe y la lee el servidor.
export const OAUTH_STATE_COOKIE = "cz_oauth_state";

/** Únicamente rutas internas explícitas de selección de planes. */
export function safePlanReturnPath(value: unknown): string {
  return typeof value === "string" && /^\/vendedor\/plan(?:\?plan=(normal|mayor_visibilidad))?$/.test(value) ? value : "/";
}

/**
 * Ruta interna segura para volver tras iniciar sesión. Rechaza URLs absolutas,
 * dominios relativos al protocolo (//), barras invertidas y rutas de la API.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 512) return "/";
  if (!/^\/(?![\/\\])[^\s\\]*$/.test(value)) return "/";
  if (value.startsWith("/api/")) return "/";
  return value;
}
