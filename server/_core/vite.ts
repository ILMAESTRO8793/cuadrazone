import {
  loadPublicSnapshot,
  serializePublicSnapshot,
} from "../services/publicSnapshot";
import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { renderPage } from "../../client/src/entry-server";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
export function applyPageMetadata(
  template: string,
  meta: {
    title: string;
    description: string;
    private: boolean;
    status: number;
  },
  preview = process.env.NODE_ENV !== "production"
) {
  return template
    .replaceAll("{{CZ_ORIGIN}}", escapeHtml((process.env.PUBLIC_URL ?? "").replace(/\/+$/, "")))
    .replaceAll("{{CZ_TITLE}}", escapeHtml(meta.title))
    .replaceAll("{{CZ_DESCRIPTION}}", escapeHtml(meta.description))
    .replace(
      "<!--cz-robots-->",
      meta.private || meta.status !== 200 || preview
        ? '<meta name="robots" content="noindex,nofollow" />'
        : ""
    );
}
export async function renderDocument(template: string, url: string) {
  const snapshot = await loadPublicSnapshot(url);
  const { html, meta } = renderPage(url, snapshot);
  const page = applyPageMetadata(template, meta)
    .replace("<!--app-html-->", html)
    .replace(
      "</body>",
      `<script type="application/json" id="cz-public-data">${serializePublicSnapshot(snapshot)}</script></body>`
    );
  return { page, status: meta.status, private: meta.private };
}
function missingAsset(url: string) {
  return /\.(?:js|css|png|jpe?g|webp|svg|ico|woff2?|json)$/i.test(
    url.split("?")[0]
  );
}
export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) {
      res.status(404).json({ error: "Endpoint no encontrado" });
      return;
    }
    if (missingAsset(req.originalUrl)) {
      res.status(404).end();
      return;
    }
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        'src="/src/main.tsx"',
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const {
        page,
        status,
        private: isPrivate,
      } = await renderDocument(template, req.originalUrl);
      const transformed = await vite.transformIndexHtml(req.originalUrl, page);
      res
        .status(status)
        .set({
          "Content-Type": "text/html",
          "Cache-Control": isPrivate ? "private, no-store" : "no-store",
        })
        .end(transformed);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}
export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath))
    throw new Error(`Missing built frontend: ${distPath}`);
  app.use(express.static(distPath, { index: false }));
  app.use("*", async (req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) {
      res.status(404).json({ error: "Endpoint no encontrado" });
      return;
    }
    if (missingAsset(req.originalUrl)) {
      res.status(404).end();
      return;
    }
    try {
      const template = fs.readFileSync(
        path.resolve(distPath, "index.html"),
        "utf-8"
      );
      const {
        page,
        status,
        private: isPrivate,
      } = await renderDocument(template, req.originalUrl);
      res
        .status(status)
        .set({
          "Content-Type": "text/html",
          "Cache-Control": isPrivate ? "private, no-store" : "no-store",
        })
        .send(page);
    } catch (error) {
      next(error);
    }
  });
}
