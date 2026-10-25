import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCode, hashCode, maskDestination, normalizeEmail, normalizePanamaMobile } from "./services/authCodes";
import { isSmsConfigured, sendSms } from "./_core/sms";
import { emailOpenId, phoneOpenId } from "./_core/codeAuth";

afterEach(() => vi.unstubAllEnvs());
const SECRET = "prueba-secreta-de-al-menos-treinta-y-dos-caracteres";

describe("entrada con código", () => {
  it("acepta solo celulares de Panamá y los deja en formato +507", () => {
    for (const ok of ["6123-4567", "61234567", "+507 6123 4567", "50761234567", "(507) 6123-4567"]) expect(normalizePanamaMobile(ok)).toBe("+50761234567");
    for (const bad of ["2123-4567", "6123456", "+1 305 555 1234", "+50661234567", "", null]) expect(normalizePanamaMobile(bad)).toBeNull();
  });
  it("normaliza correos de cualquier proveedor", () => {
    expect(normalizeEmail("  Ana.Perez@Hotmail.com ")).toBe("ana.perez@hotmail.com");
    for (const bad of ["ana", "ana@", "@hotmail.com", "a b@c.com", "ana@hotmail"]) expect(normalizeEmail(bad)).toBeNull();
  });
  it("oculta el destino al mostrarlo", () => {
    expect(maskDestination("phone", "+50761234567")).toBe("+507 ••••-4567");
    expect(maskDestination("email", "ana@hotmail.com")).toBe("an•••@hotmail.com");
  });
  it("genera códigos de 6 dígitos y guarda solo su huella", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
    const h = hashCode("+50761234567", "123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("123456");
    expect(hashCode("+50761234567", "123456")).toBe(h);
    expect(hashCode("+50761234568", "123456")).not.toBe(h);
    vi.stubEnv("SESSION_SECRET", "corto");
    expect(() => hashCode("+50761234567", "123456")).toThrow();
  });
  it("identifica las cuentas sin exponer el correo", () => {
    expect(emailOpenId("ana@hotmail.com")).toMatch(/^email_[0-9a-f]{40}$/);
    expect(emailOpenId("ana@hotmail.com")).not.toContain("ana");
    expect(phoneOpenId("+50761234567")).toBe("phone_+50761234567");
    expect(emailOpenId("ana@hotmail.com").length).toBeLessThanOrEqual(64);
  });
});

describe("envío de SMS", () => {
  it("usa el celular Android (SMS Gateway) por defecto", async () => {
    vi.stubEnv("SMS_PROVIDER", "");
    vi.stubEnv("SMS_GATEWAY_USER", "usuario");
    vi.stubEnv("SMS_GATEWAY_PASSWORD", "clave");
    expect(isSmsConfigured()).toBe(true);
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
    await sendSms("+50761234567", "Hola", fetchMock as any);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.sms-gate.app/3rdparty/v1/messages");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("usuario:clave").toString("base64")}`);
    expect(JSON.parse(init.body)).toEqual({ textMessage: { text: "Hola" }, phoneNumbers: ["+50761234567"] });
  });
  it("puede cambiar a Twilio solo con variables", async () => {
    vi.stubEnv("SMS_PROVIDER", "twilio");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
    vi.stubEnv("TWILIO_FROM", "+15005550006");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    await sendSms("+50761234567", "Hola", fetchMock as any);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(String(init.body)).toBe("To=%2B50761234567&From=%2B15005550006&Body=Hola");
    const failing = vi.fn().mockResolvedValue(new Response("", { status: 400 }));
    await expect(sendSms("+50761234567", "x", failing as any)).rejects.toThrow("Twilio 400");
  });
  it("sin credenciales queda apagado", () => {
    vi.stubEnv("SMS_PROVIDER", "");
    vi.stubEnv("SMS_GATEWAY_USER", "");
    expect(isSmsConfigured()).toBe(false);
  });
});
