import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, safeReturnPath } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions, isSecureRequest } from "./cookies";
import { ENV } from "./env";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  googleOpenId,
  isGoogleConfigured,
  roleForProfile,
} from "./google";
import { sdk } from "./sdk";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

function query(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/** Origen público: PUBLIC_URL si está definido; si no, el host de la petición. */
export function publicOrigin(req: Request) {
  if (ENV.publicUrl) return ENV.publicUrl;
  const protocol = isSecureRequest(req) ? "https" : "http";
  return `${protocol}://${req.get("host")}`;
}

function encodeState(state: { nonce: string; returnTo: string }) {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodeState(raw: string): { nonce: string; returnTo: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (parsed && typeof parsed.nonce === "string") {
      return { nonce: parsed.nonce, returnTo: safeReturnPath(parsed.returnTo) };
    }
  } catch { /* estado malformado */ }
  return null;
}

function sameNonce(a: string, b: string | undefined) {
  if (!b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function loginError(res: Response, code: string) {
  res.redirect(302, `/?login_error=${encodeURIComponent(code)}`);
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/google", (req, res) => {
    if (!isGoogleConfigured()) {
      res.status(503).type("text/plain").send("El inicio de sesión con Google no está configurado.");
      return;
    }
    const nonce = randomBytes(24).toString("base64url");
    const returnTo = safeReturnPath(query(req, "returnTo"));
    res.cookie(OAUTH_STATE_COOKIE, nonce, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isSecureRequest(req),
      maxAge: STATE_MAX_AGE_MS,
    });
    res.set("Cache-Control", "no-store");
    res.redirect(302, buildGoogleAuthorizeUrl(`${publicOrigin(req)}${GOOGLE_CALLBACK_PATH}`, encodeState({ nonce, returnTo })));
  });

  app.get(GOOGLE_CALLBACK_PATH, async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (query(req, "error")) return loginError(res, "cancelado");

    const code = query(req, "code");
    const state = decodeState(query(req, "state") ?? "");
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

    // Protección CSRF: el nonce del estado debe coincidir con la cookie de este navegador.
    if (!code || !state || !sameNonce(state.nonce, expectedNonce)) return loginError(res, "estado");

    try {
      const profile = await exchangeGoogleCode(code, `${publicOrigin(req)}${GOOGLE_CALLBACK_PATH}`);
      if (!profile.emailVerified) return loginError(res, "correo_no_verificado");

      // Si esa persona ya entró antes con su correo (código), usa la misma cuenta.
      let openId = googleOpenId(profile.sub);
      if (!(await db.getUserByOpenId(openId))) {
        const linked = await db.getUserByEmailLogin(profile.email);
        if (linked) openId = linked.openId;
      }
      await db.upsertUser({
        openId,
        name: profile.name,
        email: profile.email,
        loginMethod: "google",
        role: roleForProfile(profile),
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, { name: profile.name ?? "", expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, state.returnTo);
    } catch (error) {
      console.error("[Auth] Google callback failed:", error instanceof Error ? error.message : "unknown error");
      loginError(res, "fallo");
    }
  });
}
