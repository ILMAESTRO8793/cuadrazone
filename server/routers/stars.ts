import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { verificationStars } from "@shared/stars";
import { reviewKinds } from "@shared/listingReviews";
import {
  adminStoreStars,
  setStoreStar,
  starsForListing,
  starsForSlugs,
} from "../services/storeStars";

const slug = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9-]+$/);

/** Estrellas de verificación (logros) de tiendas y anunciantes. */
export const starsRouter = router({
  forStores: publicProcedure
    .input(z.object({ slugs: z.array(slug).max(60) }).strict())
    .query(({ input }) => starsForSlugs(input.slugs)),
  forListing: publicProcedure
    .input(
      z
        .object({
          kind: z.enum(reviewKinds),
          listingId: z.number().int().positive(),
        })
        .strict()
    )
    .query(({ input }) => starsForListing(input.kind, input.listingId)),
  adminForStore: adminProcedure
    .input(z.object({ storeId: z.number().int().positive() }).strict())
    .query(({ input }) => adminStoreStars(input.storeId)),
  set: adminProcedure
    .input(
      z
        .object({
          storeId: z.number().int().positive(),
          star: z.enum(verificationStars),
          awarded: z.boolean(),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      if (ctx.req.headers["x-cz-request"] !== "1")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Falta la cabecera x-cz-request: 1",
        });
      return setStoreStar(ctx.user.id, input);
    }),
});
