import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { applyDispatcherInput } from "@shared/dispatch";
import { pointInput } from "@shared/location";
import {
  adminDispatchers,
  adminMarkDispatcherPaid,
  adminSetDispatcherStatus,
  applyDispatcher,
  availableJobs,
  deliverJob,
  dispatchForOrder,
  myDispatcher,
  myEarnings,
  myJobs,
  pingPosition,
  releaseJob,
  takeJob,
} from "../services/dispatch";

const orderId = z.object({ orderId: z.number().int().positive() }).strict();

function requireHeader(ctx: { req: { headers: Record<string, unknown> } }) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}

/** Despachadores: pedidos disponibles, ruta en vivo, foto y ganancias. */
export const dispatchRouter = router({
  me: protectedProcedure.query(({ ctx }) => myDispatcher(ctx.user.id)),
  register: protectedProcedure
    .input(applyDispatcherInput)
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return applyDispatcher(ctx.user.id, input);
    }),
  available: protectedProcedure.query(({ ctx }) => availableJobs(ctx.user.id)),
  mine: protectedProcedure.query(({ ctx }) => myJobs(ctx.user.id)),
  earnings: protectedProcedure.query(({ ctx }) => myEarnings(ctx.user.id)),
  take: protectedProcedure.input(orderId).mutation(({ ctx, input }) => {
    requireHeader(ctx);
    return takeJob(ctx.user.id, input.orderId);
  }),
  release: protectedProcedure.input(orderId).mutation(({ ctx, input }) => {
    requireHeader(ctx);
    return releaseJob(ctx.user.id, input.orderId);
  }),
  ping: protectedProcedure
    .input(
      z
        .object({ orderId: z.number().int().positive(), point: pointInput })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return pingPosition(ctx.user.id, input.orderId, input.point);
    }),
  deliver: protectedProcedure.input(orderId).mutation(({ ctx, input }) => {
    requireHeader(ctx);
    return deliverJob(ctx.user.id, input.orderId);
  }),
  forOrder: protectedProcedure
    .input(orderId)
    .query(({ ctx, input }) => dispatchForOrder(ctx.user.id, input.orderId)),
  adminList: adminProcedure.query(() => adminDispatchers()),
  adminSetStatus: adminProcedure
    .input(
      z
        .object({
          userId: z.number().int().positive(),
          status: z.enum(["approved", "suspended", "pending"]),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return adminSetDispatcherStatus(ctx.user.id, input.userId, input.status);
    }),
  adminMarkPaid: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }).strict())
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return adminMarkDispatcherPaid(input.userId);
    }),
});
