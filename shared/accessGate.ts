/*
 * Acceso libre: cualquiera puede ver CuadraZone sin cuenta (inicio, comercios,
 * servicios, tiendas, productos, bienes raíces, autos, empleos, eventos…).
 * Solo piden iniciar sesión las páginas personales: la cuenta, el carrito y la
 * compra, pedidos, mensajes, el panel del vendedor, la administración, el
 * despachador y «mis anuncios». Los datos privados siguen protegidos en el
 * servidor por cada consulta, no por esta lista.
 */
import { safeReturnPath } from "./const";

const PRIVATE_PATHS = [
  /^\/(mi-cuenta|mi-carrito|mi-lista|carrito|deseos|favoritos|comprar|checkout|pedidos|mensajes|notificaciones|mis-boletos|mis-citas|despachador|solicitud-vendedor)(\/.*)?$/,
  /^\/(vendedor|admin)(\/.*)?$/,
  /^\/(bienes-raices|autos)\/mis-anuncios\/?$/,
  /^\/empleos\/(mi-cv|mis-postulaciones|mis-vacantes)\/?$/,
];

/** ¿Se puede ver esta ruta sin haber iniciado sesión? */
export function isPublicPath(pathname: string): boolean {
  return !PRIVATE_PATHS.some(pattern => pattern.test(pathname));
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
