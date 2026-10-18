import {
  storeDirectoryQuery,
  storeDirectoryInput,
} from "@shared/storeDirectory";
import { listPublicStores } from "./storeDirectory";
import type { PublicSnapshot } from "../../client/src/contexts/PublicCatalogContext";
import { publicCatalogInput } from "../../client/src/lib/liveCatalog";
import { listPublicInput } from "@shared/marketplace";
import {
  getPublicProduct,
  homeCollections,
  getPublicStore,
  listPublicProducts,
} from "./catalog";
export async function loadPublicSnapshot(url: string): Promise<PublicSnapshot> {
  const parsed = new URL(url, "https://route-parser.invalid");
  const snapshot: PublicSnapshot = { url: parsed.pathname + parsed.search };
  try {
    if (parsed.pathname === "/tiendas") {
      const input = storeDirectoryInput.safeParse(
        storeDirectoryQuery(parsed.search)
      );
      if (!input.success)
        snapshot.badRequest =
          input.error.issues[0]?.message ?? "Filtros no válidos";
      else snapshot.directory = await listPublicStores(input.data);
    } else if (parsed.pathname === "/mercado") {
      snapshot.catalog = await listPublicProducts(
        listPublicInput.parse(publicCatalogInput(parsed.search))
      );
      if (parsed.searchParams.get("q"))
        snapshot.directory = await listPublicStores(
          storeDirectoryInput.parse({
            q: parsed.searchParams.get("q"),
            province: parsed.searchParams.get("province") || undefined,
            limit: 6,
          })
        );
    } else if (parsed.pathname === "/") {
      snapshot.home = await homeCollections();
      snapshot.catalog = { items: snapshot.home.newest, nextCursor: null };
    } else if (/^\/articulo\/[^/]+$/.test(parsed.pathname))
      snapshot.product = await getPublicProduct(
        decodeURIComponent(parsed.pathname.split("/")[2])
      );
    else if (/^\/tiendas\/[^/]+$/.test(parsed.pathname))
      snapshot.store = await getPublicStore(
        decodeURIComponent(parsed.pathname.split("/")[2])
      );
  } catch {
    snapshot.failed = true;
  }
  return snapshot;
}
export function serializePublicSnapshot(snapshot: PublicSnapshot): string {
  return JSON.stringify(snapshot)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
