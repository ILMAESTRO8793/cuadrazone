import { describe, expect, it } from "vitest";
import { reminderKey, reminderStage } from "./services/subscriptions";
import { renderEmail } from "./services/email";
import { trialEndingSoon } from "./services/emailMessages";

/*
 * Etapa 5 · Aviso de fin de la prueba gratis: 15, 7 y 1 día antes.
 */
const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-09T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * DAY);

describe("avisos antes de que termine el período", () => {
  it("prueba gratis: avisa a los 15, 7 y 1 día", () => {
    expect(reminderStage(inDays(20), now, true)).toBeNull();
    expect(reminderStage(inDays(15), now, true)).toBe(15);
    expect(reminderStage(inDays(10), now, true)).toBe(15);
    expect(reminderStage(inDays(7), now, true)).toBe(7);
    expect(reminderStage(inDays(3), now, true)).toBe(7);
    expect(reminderStage(inDays(1), now, true)).toBe(1);
    expect(
      reminderStage(new Date(now.getTime() + 2 * 3600 * 1000), now, true)
    ).toBe(1);
  });

  it("mensualidad pagada: avisa a los 7 y 1 día", () => {
    expect(reminderStage(inDays(15), now, false)).toBeNull();
    expect(reminderStage(inDays(6), now, false)).toBe(7);
    expect(reminderStage(inDays(1), now, false)).toBe(1);
  });

  it("cada aviso tiene su propia clave; el de 7 días conserva la anterior", () => {
    expect(reminderKey(5, "2026-12-01", 7)).toBe("sub-reminder:5:2026-12-01");
    expect(reminderKey(5, "2026-12-01", 15)).toBe(
      "sub-reminder:5:2026-12-01:15"
    );
    expect(reminderKey(5, "2026-12-01", 1)).toBe("sub-reminder:5:2026-12-01:1");
  });

  it("el correo dice cuándo termina, el plan elegido y que la comisión baja a 5%", () => {
    const email = renderEmail(
      trialEndingSoon(inDays(7), 7, "Mayor Visibilidad", "US$39.99")
    );
    expect(email.subject).toBe("Tus 3 meses gratis terminan en 7 días");
    expect(email.text).toContain("Mayor Visibilidad (US$39.99 al mes)");
    expect(email.text).toContain("baja de 8% a 5%");
    expect(
      renderEmail(trialEndingSoon(inDays(1), 1, "Normal", "US$19.99")).subject
    ).toBe("Mañana terminan tus 3 meses gratis");
  });
});
