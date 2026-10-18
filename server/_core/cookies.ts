import type { CookieOptions, Request } from "express";

/** HTTPS detrás del proxy de Railway, o petición directa segura. */
export function isSecureRequest(req: Request): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (req.secure || req.protocol === "https") return true;
  const forwarded = req.headers?.["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return typeof proto === "string" && proto.split(",")[0]?.trim() === "https";
}

/**
 * Cookie de sesión del propio dominio: httpOnly, SameSite=Lax (protege contra
 * envíos entre sitios y permite el regreso desde Google) y Secure en HTTPS.
 */
export function getSessionCookieOptions(req: Request): CookieOptions {
  return { httpOnly: true, path: "/", sameSite: "lax", secure: isSecureRequest(req) };
}
