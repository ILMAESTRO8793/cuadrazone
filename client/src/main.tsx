import { trpc } from "@/lib/trpc";
import { getAuthHeaders } from "@/lib/authFetch";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { hydrateRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import "./features/commerce/commerce.css";
import "./features/catalog/seller-catalog.css";
import "./styles/type-floor.css";
import "./styles/redesign.css";
import type { PublicSnapshot } from "./contexts/PublicCatalogContext";
let snapshot: PublicSnapshot = {};
try {
  snapshot = JSON.parse(
    document.getElementById("cz-public-data")?.textContent || "{}"
  );
} catch {
  /* El cliente puede volver a cargar el catálogo público. */
}
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers: getAuthHeaders,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});
hydrateRoot(
  document.getElementById("root")!,
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App snapshot={snapshot} />
    </QueryClientProvider>
  </trpc.Provider>
);

/*
 * Actualización automática: la app de Android/iPhone puede quedar congelada en
 * segundo plano con una versión vieja. Al volver a la pantalla (y cada 5
 * minutos) se compara la versión publicada con la cargada y, si cambió, se
 * recarga la página.
 */
(() => {
  const mine = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  const current = mine ? new URL(mine.src, location.href).pathname : "";
  if (!current) return; // en desarrollo no hay huella
  let checking = false;
  async function check() {
    if (checking || document.visibilityState !== "visible") return;
    checking = true;
    try {
      const r = await fetch("/api/version", { cache: "no-store", credentials: "omit" });
      const data = (await r.json()) as { version?: string };
      if (data.version && data.version !== current) location.reload();
    } catch {
      /* sin conexión: se intenta la próxima vez */
    } finally {
      checking = false;
    }
  }
  document.addEventListener("visibilitychange", () => void check());
  window.addEventListener("focus", () => void check());
  window.setInterval(() => void check(), 5 * 60_000);
})();
