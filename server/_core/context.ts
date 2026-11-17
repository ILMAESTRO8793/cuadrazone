import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME, SESSION_MS, SESSION_RENEW_AFTER_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const auth = await sdk.authenticate(opts.req);
    user = auth.user;
    // Sesión de 90 días que se renueva con el uso (las de admin no: vencen a las 12 h).
    const issuedMs = (auth.session.iat ?? 0) * 1000;
    if (user.role !== "admin" && Date.now() - issuedMs > SESSION_RENEW_AFTER_MS) {
      const token = await sdk.createSessionToken(user.openId, { name: auth.session.name, expiresInMs: SESSION_MS });
      opts.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(opts.req), maxAge: SESSION_MS });
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
