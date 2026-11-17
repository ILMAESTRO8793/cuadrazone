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
    expect(securityHeaders["Permissions-Policy"]).toContain(
      "geolocation=(self)"
    );
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
    // El sitemap debe quedar permitido aunque todo lo demás esté bloqueado.
    expect(robots).toContain("Allow: /sitemap.xml$\n");
    expect(robots.indexOf("Allow: /sitemap.xml$")).toBeLessThan(
      robots.indexOf("Disallow: /\n")
    );
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

describe("CSP (solo informe) e index.html", () => {
  it("HSTS incluye subdominios", async () => {
    const { securityHeaders } = await import("./_core/hardening");
    expect(securityHeaders["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
  });

  it("solo permite los scripts en línea de la página, por su huella", async () => {
    const { contentSecurityPolicy, inlineScriptHashesOf } = await import("./_core/hardening");
    const { readFileSync } = await import("node:fs");
    const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
    const hashes = inlineScriptHashesOf(html);
    expect(hashes).toHaveLength(1);
    expect(hashes[0]).toMatch(/^'sha256-[A-Za-z0-9+/=]{44}'$/);
    // Los datos JSON y los scripts externos no cuentan.
    expect(inlineScriptHashesOf('<script type="application/json">{}</script><script src="/a.js"></script>')).toEqual([]);
    const csp = contentSecurityPolicy(hashes);
    expect(csp).toContain(`script-src 'self' ${hashes[0]}`);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
