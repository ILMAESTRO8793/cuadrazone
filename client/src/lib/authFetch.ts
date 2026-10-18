// Cabecera anti-CSRF exigida por las rutas mutables del servidor. La sesión viaja
// en la cookie httpOnly del propio dominio.
export function getAuthHeaders(): Record<string, string> {
  return { "x-cz-request": "1" };
}
export function authFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(getAuthHeaders())) headers.set(key, value);
  return fetch(url, { ...init, headers, credentials: "include" });
}
