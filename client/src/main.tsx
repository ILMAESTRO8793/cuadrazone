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
