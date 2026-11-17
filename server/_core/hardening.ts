/*
 * Etapa 7 · Calidad y entrega: cabeceras de seguridad, robots.txt y sitemap.xml.
 *
 * El sitio pide iniciar sesión para casi todo, así que a los buscadores solo se
 * les ofrecen las páginas abiertas: la entrada, la ayuda y los documentos
 * legales. robots.txt y sitemap.xml se sirven antes del control de acceso.
 */
import { createHash } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
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
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy":
    "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

// ───────────── Content-Security-Policy (por ahora solo informa) ─────────────

let inlineScriptHashes: string[] = [];

/** Huellas sha256 de los <script> en línea de la página (se calculan al arrancar). */
export function inlineScriptHashesOf(html: string): string[] {
  const hashes: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!m[1]!.trim()) continue;
    hashes.push(`'sha256-${createHash("sha256").update(m[1]!).digest("base64")}'`);
  }
  return hashes;
}

export function setInlineScriptHashes(hashes: string[]) {
  inlineScriptHashes = hashes;
}

/**
 * Lista de lo que la página puede cargar. Incluye el traductor de Google (solo
 * se usa si eligen inglés), las teselas del mapa (imágenes https) y el visor de
 * documentos (blob:). Se publica como «Report-Only»: el navegador no bloquea
 * nada y avisa a /api/csp-report de lo que bloquearía, para activarla después
 * sin romper nada.
 */
export function contentSecurityPolicy(hashes = inlineScriptHashes) {
  const google = "https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://www.gstatic.com";
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")} ${google}`.replace(/\s+/g, " "),
    "style-src 'self' 'unsafe-inline' https://www.gstatic.com https://translate.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://translate.googleapis.com https://translate-pa.googleapis.com",
    "media-src 'self' blob:",
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self' https://accounts.google.com",
    "report-uri /api/csp-report",
  ].join("; ");
}

export function applySecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  res.set(securityHeaders);
  if (process.env.NODE_ENV === "production")
    res.set("Content-Security-Policy-Report-Only", contentSecurityPolicy());
  next();
}

/** Páginas que un buscador puede ver sin cuenta. */
export function publicPagePaths() {
  return [
    "/entrar",
    "/ayuda",
    ...Object.keys(legalDocs).map(t => `/legal/${t}`),
  ];
}

export function robotsTxt(origin: string) {
  const lines = [
    "User-agent: *",
    ...publicPagePaths().map(p => `Allow: ${p}$`),
    "Allow: /assets/",
    // Sin esto, «Disallow: /» también bloqueaba el sitemap en Google Search Console.
    "Allow: /sitemap.xml$",
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
  // Avisos del navegador sobre lo que la CSP bloquearía (se anotan en el registro).
  app.post(
    "/api/csp-report",
    express.json({ limit: "8kb", type: ["application/csp-report", "application/json", "application/reports+json"] }),
    (req, res) => {
      const r = (req.body?.["csp-report"] ?? req.body ?? {}) as Record<string, unknown>;
      const page = String(r["document-uri"] ?? "").replace(/^https?:\/\/[^/]+/, "").slice(0, 120);
      console.warn(
        `[CSP] ${String(r["violated-directive"] ?? r["effective-directive"] ?? "?").slice(0, 60)} bloquearía ${String(r["blocked-uri"] ?? "?").slice(0, 160)} en ${page}`
      );
      res.status(204).end();
    }
  );
  // La plantilla sin procesar no se sirve: /index.html es la portada.
  app.get("/index.html", (_req, res) => res.redirect(301, "/"));
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
