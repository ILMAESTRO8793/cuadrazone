import { listPublicStores, suggestStores } from "../services/storeDirectory";
import { storeDirectoryInput } from "@shared/storeDirectory";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  categories,
  homeCollections,
  getMyStore,
  getPublicProduct,
  getPublicStore,
  listMyProducts,
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
    .mutation(({ ctx, input }) =>
      service(() => saveProduct(ctx.user.id, input))
    ),
  setStatus: protectedProcedure
    .input(setStatusInput)
    .mutation(({ ctx, input }) =>
      service(() =>
        setStatus(ctx.user.id, input.id, input.expectedRevision, input.status)
      )
    ),
});
