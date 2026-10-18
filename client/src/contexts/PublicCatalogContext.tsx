import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
type Outputs = inferRouterOutputs<AppRouter>;
export type RealProduct = Outputs["catalog"]["list"]["items"][number];
export type PublicSnapshot = {
  url?: string;
  directory?: Outputs["catalog"]["stores"];
  badRequest?: string;
  catalog?: Outputs["catalog"]["list"];
  home?: Outputs["catalog"]["home"];
  product?: Outputs["catalog"]["detail"];
  store?: Outputs["catalog"]["store"];
  failed?: boolean;
};
const PublicContext = createContext<{
  snapshot: PublicSnapshot;
  mounted: boolean;
}>({ snapshot: {}, mounted: false });
export function PublicCatalogProvider({
  children,
  snapshot = {},
}: {
  children: ReactNode;
  snapshot?: PublicSnapshot;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <PublicContext.Provider value={{ snapshot, mounted }}>
      {children}
    </PublicContext.Provider>
  );
}
export function usePublicCatalog() {
  return useContext(PublicContext);
}

export function snapshotMatches(
  snapshot: PublicSnapshot,
  url: string
): boolean {
  if (!snapshot.url) return false;
  const a = new URL(snapshot.url, "https://route-parser.invalid");
  const b = new URL(url, "https://route-parser.invalid");
  a.searchParams.sort();
  b.searchParams.sort();
  return (
    a.pathname === b.pathname &&
    a.searchParams.toString() === b.searchParams.toString()
  );
}
