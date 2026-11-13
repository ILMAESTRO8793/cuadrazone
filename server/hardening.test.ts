import { describe, expect, it } from "vitest";
import {
  isFingerprintedAsset,
  publicPagePaths,
  robotsTxt,
  securityHeaders,
  sitemapXml,
} from "./_core/hardening";
import { isPublicPath } from "@shared/accessGate";

/* Etapa 7 · Cabeceras de seguridad, robots.txt, sitemap.xml y caché. */

describe("cabeceras de seguridad", () => {
  it("obliga HTTPS, evita que otra página incruste el sitio y no filtra rutas", () => {
    expect(securityHeaders["Strict-Transport-Security"]).toMatch(
      /max-age=31536000/
    );
    expect(securityHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(securityHeaders["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(securityHeaders["Content-Security-Policy"]).toContain(
      "frame-ancestors 'self'"
    );
    expect(securityHeaders["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
  });
  it("solo permite la cámara (escáner de boletos)", () => {
    expect(securityHeaders["Permissions-Policy"]).toContain("camera=(self)");
    expect(securityHeaders["Permissions-Policy"]).toContain("geolocation=(self)");
  });
});

describe("buscadores", () => {
  it("solo se ofrecen páginas que se ven sin cuenta", () => {
    const paths = publicPagePaths();
    expect(paths).toContain("/entrar");
    expect(paths).toContain("/legal/privacidad");
    for (const p of paths) expect(isPublicPath(p)).toBe(true);
  });
  it("robots.txt bloquea lo privado y apunta al sitemap", () => {
    const robots = robotsTxt("https://www.cuadrazone.com");
    expect(robots).toContain("Allow: /entrar$");
    expect(robots).toContain("Disallow: /\n");
    expect(robots).toContain("Sitemap: https://www.cuadrazone.com/sitemap.xml");
  });
  it("el sitemap lista direcciones completas", () => {
    const xml = sitemapXml("https://www.cuadrazone.com");
    expect(xml).toContain("<loc>https://www.cuadrazone.com/ayuda</loc>");
    expect(xml).not.toContain("/mercado");
  });
});

describe("caché de archivos", () => {
  it("solo los archivos con huella se guardan un año", () => {
    expect(
      isFingerprintedAsset("/app/dist/public/assets/index-CChhluxg.js")
    ).toBe(true);
    expect(
      isFingerprintedAsset("C:\\dist\\public\\assets\\vendor-react-BNvPm4AX.js")
    ).toBe(true);
    expect(
      isFingerprintedAsset("/app/dist/public/assets/logo-cuadrazone.png")
    ).toBe(false);
    expect(isFingerprintedAsset("/app/dist/public/assets/favicon.png")).toBe(
      false
    );
    expect(isFingerprintedAsset("/app/dist/public/index.html")).toBe(false);
  });
});
