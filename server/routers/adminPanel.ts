import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  adminReports,
  listReviewsForModeration,
  moderateContent,
  moderateReview,
  moderationKinds,
  searchContent,
  searchSellers,
  suspendSeller,
  unsuspendSeller,
} from "../services/adminPanel";
import {
  adminListClaims,
  adminResolveClaim,
  claimForOrder,
  openClaim,
  respondClaim,
  withdrawClaim,
} from "../services/claims";

function csrf(ctx: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}
const q = z.object({ q: z.string().max(120).default("") }).strict();

/** Etapa 6 · Reclamos: comprador y vendedor. */
export const claimsRouter = router({
  forOrder: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }).strict())
    .query(({ ctx, input }) => claimForOrder(ctx.user as any, input.orderId)),
  open: protectedProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return openClaim(ctx.user as any, input);
    }),
  respond: protectedProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return respondClaim(ctx.user as any, input);
    }),
  withdraw: protectedProcedure
    .input(z.object({ claimId: z.number().int().positive() }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return withdrawClaim(ctx.user as any, input.claimId);
    }),
});

/** Etapa 6 · Panel del administrador. */
export const adminPanelRouter = router({
  claims: adminProcedure
    .input(z.object({ filter: z.enum(["pending", "all"]) }).strict())
    .query(({ input }) => adminListClaims(input.filter)),
  resolveClaim: adminProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return adminResolveClaim(ctx.user as any, input);
    }),
  content: adminProcedure
    .input(
      z
        .object({
          kind: z.enum(moderationKinds),
          q: z.string().max(120).default(""),
        })
        .strict()
    )
    .query(({ input }) => searchContent(input.kind, input.q)),
  moderateContent: adminProcedure
    .input(
      z
        .object({
          kind: z.enum(moderationKinds),
          id: z.number().int().positive(),
          hide: z.boolean(),
          reason: z.string().max(300).default(""),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return moderateContent(
        ctx.user as any,
        input.kind,
        input.id,
        input.hide,
        input.reason
      );
    }),
  reviews: adminProcedure
    .input(q)
    .query(({ input }) => listReviewsForModeration(input.q)),
  moderateReview: adminProcedure
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
      return moderateReview(
        ctx.user as any,
        input.id,
        input.hide,
        input.reason
      );
    }),
  sellers: adminProcedure.input(q).query(({ input }) => searchSellers(input.q)),
  suspend: adminProcedure
    .input(
      z
        .object({
          applicationId: z.number().int().positive(),
          reason: z.string().max(300),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return suspendSeller(ctx.user as any, input.applicationId, input.reason);
    }),
  unsuspend: adminProcedure
    .input(
      z
        .object({
          applicationId: z.number().int().positive(),
          note: z.string().max(300).default(""),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return unsuspendSeller(ctx.user as any, input.applicationId, input.note);
    }),
  reports: adminProcedure.query(() => adminReports()),
});
