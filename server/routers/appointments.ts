import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  bookAppointment,
  cancelAppointment,
  closeAppointment,
  getAvailability,
  myAppointments,
  providerAgenda,
  saveAvailability,
  serviceSlots,
  setServiceBookable,
} from "../services/appointments";

function csrf(ctx: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}

export const appointmentsRouter = router({
  // Cliente
  slots: protectedProcedure
    .input(z.object({ serviceId: z.number().int().positive() }).strict())
    .query(({ input }) => serviceSlots(input.serviceId)),
  book: protectedProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return bookAppointment(ctx.user as any, input);
    }),
  mine: protectedProcedure.query(({ ctx }) => myAppointments(ctx.user as any)),
  /** El cliente o el proveedor cancelan; la hora queda libre. */
  cancel: protectedProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          reason: z.string().max(300).default(""),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return cancelAppointment(ctx.user as any, input.id, input.reason);
    }),

  // Proveedor
  availability: protectedProcedure.query(({ ctx }) =>
    getAvailability(ctx.user as any)
  ),
  saveAvailability: protectedProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return saveAvailability(ctx.user as any, input);
    }),
  setBookable: protectedProcedure
    .input(
      z
        .object({
          serviceId: z.number().int().positive(),
          bookable: z.boolean(),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return setServiceBookable(
        ctx.user as any,
        input.serviceId,
        input.bookable
      );
    }),
  agenda: protectedProcedure.query(({ ctx }) =>
    providerAgenda(ctx.user as any)
  ),
  close: protectedProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          status: z.enum(["completed", "no_show"]),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return closeAppointment(ctx.user as any, input.id, input.status);
    }),
});
