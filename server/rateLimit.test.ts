import { afterEach, describe, expect, it } from "vitest";
import { SPAM_PRONE, hit, rateLimits, resetRateLimits, trpcPaths } from "./_core/rateLimit";

function fakeReq(method: string, path: string, opts: { ip?: string; cookie?: string } = {}) {
  return { method, path, ip: opts.ip ?? "1.2.3.4", headers: opts.cookie ? { cookie: opts.cookie } : {}, socket: {} } as any;
}

function run(req: any) {
  let status = 200;
  let passed = false;
  const res = {
    set() { return res; },
    status(code: number) { status = code; return res; },
    json() { return res; },
  } as any;
  const chain = rateLimits();
  const step = (i: number) => {
    if (i === chain.length) { passed = true; return; }
    chain[i](req, res, () => step(i + 1));
  };
  step(0);
  return { passed, status };
}

describe("límites de peticiones", () => {
  afterEach(() => resetRateLimits());

  it("cuenta por ventana y deja pasar de nuevo cuando vence", () => {
    const now = 1_000_000;
    expect(hit("k", 2, 1000, now)).toBe(0);
    expect(hit("k", 2, 1000, now)).toBe(0);
    expect(hit("k", 2, 1000, now)).toBeGreaterThan(0);
    expect(hit("k", 2, 1000, now + 1001)).toBe(0);
  });

  it("lee los procedimientos de una petición tRPC en lote", () => {
    expect(trpcPaths(fakeReq("POST", "/api/trpc/commerce.sendMessage,auth.me"))).toEqual(["commerce.sendMessage", "auth.me"]);
    expect(trpcPaths(fakeReq("GET", "/mercado"))).toEqual([]);
  });

  it("mensajes y preguntas: máximo 30 por hora por persona", () => {
    expect(SPAM_PRONE.has("commerce.sendMessage")).toBe(true);
    const req = () => fakeReq("POST", "/api/trpc/commerce.sendMessage", { cookie: "cz_session=abc" });
    for (let i = 0; i < 30; i++) expect(run(req()).passed).toBe(true);
    expect(run(req()).status).toBe(429);
    // Otra persona no queda bloqueada.
    expect(run(fakeReq("POST", "/api/trpc/commerce.sendMessage", { cookie: "cz_session=otra" })).passed).toBe(true);
  });

  it("leer un CV en PDF: máximo 10 por hora", () => {
    for (let i = 0; i < 10; i++) expect(run(fakeReq("POST", "/api/resume/import")).passed).toBe(true);
    expect(run(fakeReq("POST", "/api/resume/import")).status).toBe(429);
  });

  it("las páginas y las fotos no cuentan", () => {
    for (let i = 0; i < 400; i++) expect(run(fakeReq("GET", "/mercado")).passed).toBe(true);
  });
});
