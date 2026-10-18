// Inicio de sesión con Google (OpenID Connect, flujo de código de autorización).
// Documentación: https://developers.google.com/identity/openid-connect/openid-connect
import { ENV } from "./env";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const TIMEOUT_MS = 15_000;

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export function isGoogleConfigured() {
  return Boolean(ENV.googleClientId && ENV.googleClientSecret);
}

export function buildGoogleAuthorizeUrl(redirectUri: string, state: string) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", ENV.googleClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!tokenResponse.ok) throw new Error(`Google token exchange failed (${tokenResponse.status})`);
  const token = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof token.access_token !== "string") throw new Error("Google did not return an access token");

  const infoResponse = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!infoResponse.ok) throw new Error(`Google userinfo failed (${infoResponse.status})`);
  return parseGoogleProfile(await infoResponse.json());
}

export function parseGoogleProfile(data: unknown): GoogleProfile {
  const info = (data ?? {}) as Record<string, unknown>;
  if (typeof info.sub !== "string" || !/^[0-9A-Za-z_-]{1,50}$/.test(info.sub)) {
    throw new Error("Google profile is missing a valid subject");
  }
  if (typeof info.email !== "string" || !info.email.includes("@")) {
    throw new Error("Google profile is missing an email");
  }
  return {
    sub: info.sub,
    email: info.email.trim().toLowerCase(),
    emailVerified: info.email_verified === true || info.email_verified === "true",
    name: typeof info.name === "string" && info.name.trim() ? info.name.trim().slice(0, 200) : null,
  };
}

/** Identificador interno estable: no depende del correo, que puede cambiar. */
export function googleOpenId(sub: string) {
  return `google_${sub}`;
}

/** Rol derivado en cada inicio de sesión desde ADMIN_EMAILS, solo con correo verificado. */
export function roleForProfile(profile: GoogleProfile): "admin" | "user" {
  return profile.emailVerified && ENV.adminEmails.includes(profile.email) ? "admin" : "user";
}
