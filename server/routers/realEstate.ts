import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { propertyFiltersInput } from "@shared/realEstate";
import { sellerPlanIds } from "@shared/pricing";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  adminAdvertiserPlans,
  adminRecordAdvertiserPayment,
  deleteProperty,
  myProperties,
  publicProperties,
  publicProperty,
  saveProperty,
  setPropertyStatus,
} from "../services/realEstate";

function csrf(ctx: { req: { headers: Record<string, string | string[] | undefined> } }) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Falta la cabecera x-cz-request: 1" });
}

const idInput = z.object({ id: z.number().int().positive() }).strict();

export const realEstateRouter = router({
  list: publicProcedure.input(propertyFiltersInput).query(({ input }) => publicProperties(input)),
  detail: publicProcedure.input(z.object({ slug: z.string().min(1).max(160) }).strict()).query(({ input }) => publicProperty(input.slug)),
  mine: protectedProcedure.query(({ ctx }) => myProperties(ctx.user as any)),
  // La validación completa (campos según el tipo) la hace el servicio con savePropertyInput.
  save: protectedProcedure.input(z.record(z.string(), z.unknown())).mutation(({ ctx, input }) => {
    csrf(ctx);
    return saveProperty(ctx.user as any, input);
  }),
  setStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["published", "paused", "closed", "draft"]) }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return setPropertyStatus(ctx.user as any, input.id, input.status);
    }),
  remove: protectedProcedure.input(idInput).mutation(({ ctx, input }) => {
    csrf(ctx);
    return deleteProperty(ctx.user as any, input.id);
  }),
  advertiserPlans: adminProcedure.query(() => adminAdvertiserPlans()),
  recordAdvertiserPayment: adminProcedure
    .input(
      z.object({
        account: z.string().trim().min(5).max(320),
        planId: z.enum(sellerPlanIds),
        months: z.number().int().min(1).max(12),
        amountCents: z.number().int().positive(),
        method: z.enum(["yappy", "transferencia", "efectivo", "otro"]),
        reference: z.string().max(120),
        paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string().max(500),
      }).strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return adminRecordAdvertiserPayment(ctx.user as any, input);
    }),
});
