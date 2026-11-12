import { describe, expect, it } from "vitest";
import {
  extendServicePub,
  servicePubDisplayStatus,
  SERVICE_PUB_MONTHLY_CENTS,
} from "@shared/servicePub";
import { saveShowcaseInput } from "@shared/showcase";
import { saveBannerInput } from "@shared/siteContent";

describe("Service Pub", () => {
  it("cuesta US$10 al mes", () => {
    expect(SERVICE_PUB_MONTHLY_CENTS).toBe(1000);
  });
  it("suma meses desde hoy si ya venció", () => {
    const now = new Date("2026-11-11T15:00:00Z");
    expect(extendServicePub(null, 1, now).toISOString().slice(0, 10)).toBe(
      "2026-12-11"
    );
    expect(
      extendServicePub(new Date("2026-10-01T00:00:00Z"), 2, now)
        .toISOString()
        .slice(0, 10)
    ).toBe("2027-01-11");
  });
  it("suma desde el vencimiento vigente", () => {
    const now = new Date("2026-11-11T15:00:00Z");
    expect(
      extendServicePub(new Date("2026-12-20T00:00:00Z"), 1, now)
        .toISOString()
        .slice(0, 10)
    ).toBe("2027-01-20");
  });
  it("no se pasa del último día del mes", () => {
    const now = new Date("2026-01-31T15:00:00Z");
    expect(extendServicePub(null, 1, now).toISOString().slice(0, 10)).toBe(
      "2026-02-28"
    );
  });
  it("un activo vencido se muestra como vencido", () => {
    const now = new Date("2026-11-11T15:00:00Z");
    expect(servicePubDisplayStatus("active", "2026-11-01T00:00:00Z", now)).toBe(
      "expired"
    );
    expect(servicePubDisplayStatus("active", "2026-12-01T00:00:00Z", now)).toBe(
      "active"
    );
  });
});

describe("fotos escogidas de CuadraZone", () => {
  const banner = { title: "Tortas", active: true };
  it("acepta fotos del catálogo y rechaza otras rutas", () => {
    expect(
      saveBannerInput.safeParse({
        ...banner,
        imageUrl: "/media/catalog/products/3/a.jpg",
      }).success
    ).toBe(true);
    expect(
      saveBannerInput.safeParse({
        ...banner,
        imageUrl: "/media/catalog/../secret",
      }).success
    ).toBe(false);
    expect(
      saveBannerInput.safeParse({
        ...banner,
        imageUrl: "https://otro.com/x.jpg",
      }).success
    ).toBe(false);
    expect(
      saveShowcaseInput.safeParse({
        section: "comercios",
        zone: "producto",
        title: "Torta",
        active: true,
        mediaUrl: "/media/private/x.jpg",
      }).success
    ).toBe(false);
  });
});
