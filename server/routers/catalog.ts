import { liveBanners } from "../services/siteContent";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { czProducts } from "../../drizzle/catalog-schema";
import { misplacedListing } from "@shared/commerceGuard";
import { assertProductPublishQuota } from "../services/planLimits";
import {
  featuredStores,
  listPublicStores,
  suggestStores,
} from "../services/storeDirectory";
import { storeDirectoryInput } from "@shared/storeDirectory";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  categories,
  homeCollections,
  getMyStore,
  getPublicProduct,
  getPublicStore,
  listMyProducts,
  featuredProducts,
  listPublicProducts,
  saveProduct,
  saveStore,
  setStatus,
  suggest,
  toCatalogTRPCError,
} from "../services/catalog";
import {
  listPublicInput,
  saveProductInput,
  saveStoreInput,
  setStatusInput,
  slugInput,
  suggestInput,
} from "@shared/marketplace";

/** Rechaza lo que tiene su propia sección y dice dónde registrarlo. */
function rejectMisplaced(product: {
  title: string;
  description?: string | null;
  category?: string | null;
}) {
  const misplaced = misplacedListing(product);
  if (misplaced)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: misplaced.message,
    });
}

const service = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    throw toCatalogTRPCError(error);
  }
};

export const catalogRouter = router({
  stores: publicProcedure
    .input(storeDirectoryInput)
    .query(({ input }) => service(() => listPublicStores(input))),
  storeSuggest: publicProcedure
    .input(suggestInput)
    .query(({ input }) => service(() => suggestStores(input.q))),
  home: publicProcedure.query(() => service(() => homeCollections())),
  list: publicProcedure
    .input(listPublicInput)
    .query(({ input }) => service(() => listPublicProducts(input))),
  /** Mayor Visibilidad: franja de productos destacados. */
  featured: publicProcedure
    .input(listPublicInput)
    .query(({ input }) => service(() => featuredProducts(input))),
  /** Mayor Visibilidad: franja de tiendas destacadas. */
  featuredStores: publicProcedure
    .input(storeDirectoryInput)
    .query(({ input }) => service(() => featuredStores(input))),
  detail: publicProcedure
    .input(slugInput)
    .query(({ input }) => service(() => getPublicProduct(input.slug))),
  store: publicProcedure
    .input(slugInput)
    .query(({ input }) => service(() => getPublicStore(input.slug))),
  suggest: publicProcedure
    .input(suggestInput)
    .query(({ input }) => service(() => suggest(input.q))),
  categories: publicProcedure.query(() => categories()),
  banners: publicProcedure.query(() => liveBanners()),

  myStore: protectedProcedure.query(({ ctx }) =>
    service(() => getMyStore(ctx.user.id))
  ),
  saveStore: protectedProcedure
    .input(saveStoreInput)
    .mutation(({ ctx, input }) => service(() => saveStore(ctx.user.id, input))),
  myProducts: protectedProcedure.query(({ ctx }) =>
    service(() => listMyProducts(ctx.user.id))
  ),
  saveProduct: protectedProcedure
    .input(saveProductInput)
    .mutation(({ ctx, input }) => {
      // Comercios no acepta inmuebles, autos, vacantes ni restaurantes.
      rejectMisplaced(input);
      return service(() => saveProduct(ctx.user.id, input));
    }),
  setStatus: protectedProcedure
    .input(setStatusInput)
    .mutation(async ({ ctx, input }) => {
      // Límite de productos del plan (pymes 99, mediana 300, grande sin límite).
      if (input.status === "published") {
        const db = await getDb();
        if (db) {
          const [product] = await db
            .select({
              title: czProducts.title,
              description: czProducts.description,
              category: czProducts.category,
            })
            .from(czProducts)
            .where(
              and(
                eq(czProducts.id, input.id),
                eq(czProducts.ownerUserId, ctx.user.id)
              )
            )
            .limit(1);
          if (product) rejectMisplaced(product);
          await assertProductPublishQuota(db, ctx.user.id, input.id);
        }
      }
      return service(() =>
        setStatus(ctx.user.id, input.id, input.expectedRevision, input.status)
      );
    }),
});
