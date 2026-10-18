import "dotenv/config";
import { registerCatalogImageRoutes } from "../services/catalogImages";
import { registerDocumentRoutes } from "../services/privateDocuments";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerMediaRoutes } from "../storage";
import { runMigrations } from "./migrate";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  // Crea o actualiza las tablas al arrancar (local y producción).
  if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") await runMigrations();
  const app = express();
  // Railway (y la mayoría de hostings) entregan HTTPS a través de un proxy.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  registerMediaRoutes(app);
  registerDocumentRoutes(app);
  registerCatalogImageRoutes(app);
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  registerOAuthRoutes(app);
  // tRPC API
  app.use("/api/trpc", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
