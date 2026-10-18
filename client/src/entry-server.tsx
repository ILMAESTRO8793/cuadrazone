import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./lib/trpc";
import App from "./App";
import type { PublicSnapshot } from "./contexts/PublicCatalogContext";
import { getPageMeta } from "./lib/pageMeta";
export function renderPage(url: string, snapshot: PublicSnapshot = {}) {
  const parsed = new URL(url, "https://route-parser.invalid");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  });
  const client = trpc.createClient({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });
  const html = renderToString(
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Router ssrPath={parsed.pathname} ssrSearch={parsed.search}>
          <App snapshot={snapshot} />
        </Router>
      </QueryClientProvider>
    </trpc.Provider>
  );
  queryClient.clear();
  return { html, meta: getPageMeta(url, snapshot) };
}
