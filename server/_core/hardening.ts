/*
 * Etapa 7 · Calidad y entrega: cabeceras de seguridad, robots.txt y sitemap.xml.
 *
 * El sitio pide iniciar sesión para casi todo, así que a los buscadores solo se
 * les ofrecen las páginas abiertas: la entrada, la ayuda y los documentos
 * legales. robots.txt y sitemap.xml se sirven antes del control de acceso.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { legalDocs } from "../../client/src/data/legal";

/**
 * - HSTS: el navegador solo usa HTTPS para cuadrazone.com durante un año.
 * - nosniff: un archivo subido no se puede ejecutar como otra cosa.
 * - frame-ancestors / X-Frame-Options: nadie puede meter CuadraZone dentro de
 *   otra página para engañar clics (el visor de documentos propio sí puede).
 * - Referrer-Policy: otros sitios no ven las rutas internas de quien navega.
 * - Permissions-Policy: solo la cámara (escáner de boletos) y solo aquí.
 * No se fija una Content-Security-Policy completa: el inicio con Google, las
 * fotos externas y el estado inicial en línea la romperían sin pruebas en vivo.
 */
export const securityHeaders: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy":
    "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

export function applySecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  res.set(securityHeaders);
  next();
}

/** Páginas que un buscador puede ver sin cuenta. */
export function publicPagePaths() {
  return ["/entrar", "/ayuda", ...Object.keys(legalDocs).map(t => `/legal/${t}`)];
}

export function robotsTxt(origin: string) {
  const lines = [
    "User-agent: *",
    ...publicPagePaths().map(p => `Allow: ${p}$`),
    "Allow: /assets/",
    "Disallow: /",
  ];
  if (origin) lines.push("", `Sitemap: ${origin}/sitemap.xml`);
  return lines.join("\n") + "\n";
}

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sitemapXml(origin: string) {
  const urls = publicPagePaths()
    .map(p => `  <url><loc>${xml(origin + p)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function originOf(req: Request) {
  const configured = (process.env.PUBLIC_URL ?? "").replace(/\/+$/, "");
  return configured || `${req.protocol}://${req.get("host")}`;
}

export function registerHardening(app: Express) {
  app.use(applySecurityHeaders);
  app.get("/robots.txt", (req, res) => {
    res
      .type("text/plain")
      .set("Cache-Control", "public, max-age=3600")
      .send(robotsTxt(originOf(req)));
  });
  app.get("/sitemap.xml", (req, res) => {
    res
      .type("application/xml")
      .set("Cache-Control", "public, max-age=3600")
      .send(sitemapXml(originOf(req)));
  });
}

/** Archivos con huella en el nombre (index-7RpEIJEb.js): no cambian nunca. */
export function isFingerprintedAsset(filePath: string) {
  return /[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)$/.test(
    filePath
  );
}
