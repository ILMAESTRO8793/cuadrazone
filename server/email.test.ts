import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, isEmailConfigured, queueEmail, renderEmail, retryDelayMs, sendViaBrevo, siteLink } from "./services/email";
import { applicationReceived, orderPlacedBuyer, orderStatusChanged } from "./services/emailMessages";

afterEach(() => vi.unstubAllEnvs());

describe("correos automáticos", () => {
  it("solo se activan con clave de Brevo y remitente", () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "avisos@cuadrazone.com");
    expect(isEmailConfigured()).toBe(false);
    vi.stubEnv("BREVO_API_KEY", "xkeysib-prueba");
    expect(isEmailConfigured()).toBe(true);
    vi.stubEnv("EMAIL_FROM", "sin-arroba");
    expect(isEmailConfigured()).toBe(false);
  });
  it("sin configuración no encola nada", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const tx = { insert: vi.fn() };
    expect(await queueEmail(tx, "k", { email: "a@b.com", name: null }, applicationReceived())).toBe(false);
    expect(tx.insert).not.toHaveBeenCalled();
  });
  it("escapa el texto y solo enlaza a rutas de CuadraZone", () => {
    vi.stubEnv("PUBLIC_URL", "https://cuadrazone.com");
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
    expect(siteLink("/pedidos/5")).toBe("https://cuadrazone.com/pedidos/5");
    expect(siteLink("https://malo.com")).toBe("https://cuadrazone.com/");
    expect(siteLink("//malo.com")).toBe("https://cuadrazone.com/");
    const out = renderEmail({ subject: "S", title: "<b>Hola</b>", paragraphs: ["Tienda <img src=x>"], details: [["Total", "US$5.00"]], cta: { label: "Ver", path: "/pedidos/1" } });
    expect(out.html).not.toContain("<img src=x>");
    expect(out.html).toContain("&lt;b&gt;Hola&lt;/b&gt;");
    expect(out.html).toContain('href="https://cuadrazone.com/pedidos/1"');
    expect(out.text).toContain("Total: US$5.00");
    expect(out.text).toContain("Ver: https://cuadrazone.com/pedidos/1");
  });
  it("arma los textos de pedidos con los datos de pago", () => {
    const yappy = orderPlacedBuyer("CZ-1", "Artesanías", 3000, { method: "yappy", yappyPhone: "+50761234567", yappyDirectory: "Artesanias" }, 7);
    expect(yappy.paragraphs.join(" ")).toContain("+50761234567");
    expect(yappy.details).toContainEqual(["Total", "US$30.00"]);
    expect(orderStatusChanged("CZ-1", "shipped", 7)?.subject).toBe("Pedido CZ-1: enviado");
    expect(orderStatusChanged("CZ-1", "pending", 7)).toBeNull();
  });
  it("reintenta con espera creciente", () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([60_000, 120_000, 240_000, 480_000]);
    expect(retryDelayMs(20)).toBe(3_600_000);
  });
  it("envía a Brevo con el formato de su API y reporta errores", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-prueba");
    vi.stubEnv("EMAIL_FROM", "avisos@cuadrazone.com");
    vi.stubEnv("EMAIL_FROM_NAME", "CuadraZone");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    await sendViaBrevo({ toEmail: "a@b.com", toName: "Ana", subject: "Hola", html: "<p>Hola</p>", textBody: "Hola" }, fetchMock as any);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("xkeysib-prueba");
    expect(JSON.parse(init.body)).toMatchObject({ sender: { email: "avisos@cuadrazone.com", name: "CuadraZone" }, to: [{ email: "a@b.com", name: "Ana" }], subject: "Hola", htmlContent: "<p>Hola</p>", textContent: "Hola" });
    const failing = vi.fn().mockResolvedValue(new Response("clave inválida", { status: 401 }));
    await expect(sendViaBrevo({ toEmail: "a@b.com", toName: null, subject: "x", html: "x", textBody: "x" }, failing as any)).rejects.toThrow("Brevo 401");
  });
});
