import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eventFiltersInput, eventStatuses } from "@shared/events";
import { protectedProcedure, router } from "../_core/trpc";
import {
  cancelOrder,
  eventAttendance,
  eventOrders,
  markOrderPaid,
  myEvents,
  myTickets,
  publicEvent,
  publicEvents,
  reserveTickets,
  saveEvent,
  setEventStatus,
  validateTicket,
} from "../services/events";

function csrf(ctx: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}
const id = z.object({ id: z.number().int().positive() }).strict();

// Todo el sitio exige cuenta, así que también la lista pública usa protectedProcedure.
export const eventsRouter = router({
  list: protectedProcedure
    .input(eventFiltersInput)
    .query(({ input }) => publicEvents(input)),
  detail: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(180) }).strict())
    .query(({ input }) => publicEvent(input.slug)),
  reserve: protectedProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return reserveTickets(ctx.user as any, input);
    }),
  myTickets: protectedProcedure.query(({ ctx }) => myTickets(ctx.user as any)),
  /** El comprador cancela su reserva sin pagar, o el organizador cualquiera. */
  cancelOrder: protectedProcedure.input(id).mutation(({ ctx, input }) => {
    csrf(ctx);
    return cancelOrder(ctx.user as any, input.id);
  }),

  // Organizador
  mine: protectedProcedure.query(({ ctx }) => myEvents(ctx.user as any)),
  save: protectedProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return saveEvent(ctx.user as any, input);
    }),
  setStatus: protectedProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          status: z.enum(eventStatuses),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return setEventStatus(ctx.user as any, input.id, input.status);
    }),
  orders: protectedProcedure
    .input(id)
    .query(({ ctx, input }) => eventOrders(ctx.user as any, input.id)),
  markPaid: protectedProcedure.input(id).mutation(({ ctx, input }) => {
    csrf(ctx);
    return markOrderPaid(ctx.user as any, input.id);
  }),
  attendance: protectedProcedure
    .input(id)
    .query(({ ctx, input }) => eventAttendance(ctx.user as any, input.id)),
  scan: protectedProcedure
    .input(
      z
        .object({
          eventId: z.number().int().positive(),
          code: z.string().trim().min(1).max(200),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return validateTicket(ctx.user as any, input.eventId, input.code);
    }),
});
