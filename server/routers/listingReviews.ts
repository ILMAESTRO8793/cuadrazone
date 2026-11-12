import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";
import { listingRef, saveListingReviewInput } from "@shared/listingReviews";
import {
  adminListListingReviews,
  adminModerateListingReview,
  listListingReviews,
  listingReviewEligibility,
  recordListingContact,
  saveListingReview,
} from "../services/listingReviews";

function csrf(ctx: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}

/** Reseñas de servicios, bienes raíces, autos y empleos. */
export const listingReviewsRouter = router({
  list: publicProcedure
    .input(listingRef)
    .query(({ input }) => listListingReviews(input.kind, input.listingId)),
  eligibility: protectedProcedure
    .input(listingRef)
    .query(({ ctx, input }) =>
      listingReviewEligibility(ctx.user as any, input.kind, input.listingId)
    ),
  save: protectedProcedure
    .input(saveListingReviewInput)
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return saveListingReview(ctx.user as any, input);
    }),
  contact: protectedProcedure
    .input(
      z
        .object({
          kind: z.enum(["inmueble", "auto"]),
          listingId: z.number().int().positive(),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return recordListingContact(ctx.user as any, input.kind, input.listingId);
    }),
  adminList: adminProcedure
    .input(z.object({ q: z.string().max(120).default("") }).strict())
    .query(({ input }) => adminListListingReviews(input.q)),
  adminModerate: adminProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          hide: z.boolean(),
          reason: z.string().max(300).default(""),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return adminModerateListingReview(input.id, input.hide, input.reason);
    }),
});
