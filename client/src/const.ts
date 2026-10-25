import { safeReturnPath } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Lleva a la página de entrada (Google, correo o celular) y luego vuelve a la
 * página actual. Llamar desde un evento, no durante el render.
 */
export const startLogin = () => {
  const returnTo = safeReturnPath(window.location.pathname + window.location.search);
  window.location.href = `/entrar?returnTo=${encodeURIComponent(returnTo)}`;
};
