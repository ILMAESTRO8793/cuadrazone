import { safeReturnPath } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Inicia sesión con Google. El servidor genera el nonce anti-CSRF y redirige a
 * Google; al volver, regresa a la página actual. Llamar desde un evento, no
 * durante el render.
 */
export const startLogin = () => {
  const returnTo = safeReturnPath(window.location.pathname + window.location.search);
  window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
};
