import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Las librerías cambian poco: van en un archivo aparte para que el
        // teléfono lo conserve en caché entre versiones.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Las del QR se cargan aparte, solo en boletos y escáner.
          if (/[\/]node_modules[\/](jsqr|qrcode|dijkstrajs|pngjs)[\/]/.test(id))
            return undefined;
          // Todas las demás juntas: separarlas en varios archivos crea
          // dependencias cruzadas que rompen React al cargar.
          return "vendor";
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
