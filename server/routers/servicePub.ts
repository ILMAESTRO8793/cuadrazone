import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { adminProductsFor, adminSetFeatured, publicFeaturedPicks,
  adminServicesFor,
  adminSetServiceFeatured,
  publicFeaturedServices,
} from "../services/featuredPicks";
import {
  recordServicePubPaymentInput,
  requestServicePubInput,
} from "@shared/servicePub";
import {
  adminCancelServicePub,
  adminListServicePub,
  adminRecordServicePubPayment,
  cancelServicePub,
  myServicePub,
  requestServicePub,
} from "../services/servicePub";

function csrf(ctx: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}

/** Service Pub: publicidad personalizada a US$10 al mes. */
export const servicePubRouter = router({
  mine: protectedProcedure.query(({ ctx }) => myServicePub(ctx.user as any)),
  request: protectedProcedure
    .input(requestServicePubInput)
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return requestServicePub(ctx.user as any, input.message);
    }),
  cancel: protectedProcedure.mutation(({ ctx }) => {
    csrf(ctx);
    return cancelServicePub(ctx.user as any);
  }),
  adminList: adminProcedure.query(() => adminListServicePub()),
  adminRecordPayment: adminProcedure
    .input(recordServicePubPaymentInput)
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return adminRecordServicePubPayment(ctx.user.id, input);
    }),
  adminCancel: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return adminCancelServicePub(input.userId);
    }),
  /** «Destacados» de /mercado: solo lo que el administrador activó. */
  featured: publicProcedure.query(() => publicFeaturedPicks()),
  featuredServices: publicProcedure.query(() => publicFeaturedServices()),
  adminServices: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }).strict())
    .query(({ input }) => adminServicesFor(input.userId)),
  adminSetServiceFeatured: adminProcedure
    .input(z.object({ serviceId: z.number().int().positive(), on: z.boolean() }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return adminSetServiceFeatured(ctx.user.id, input.serviceId, input.on);
    }),
  adminProducts: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }).strict())
    .query(({ input }) => adminProductsFor(input.userId)),
  adminSetFeatured: adminProcedure
    .input(z.object({ productId: z.number().int().positive(), on: z.boolean() }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return adminSetFeatured(ctx.user.id, input.productId, input.on);
    }),
});
