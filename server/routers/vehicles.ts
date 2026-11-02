import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { vehicleFiltersInput } from "@shared/vehicles";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { deleteVehicle, myVehicles, publicVehicle, publicVehicles, saveVehicle, setVehicleStatus } from "../services/vehicles";

function csrf(ctx: { req: { headers: Record<string, string | string[] | undefined> } }) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Falta la cabecera x-cz-request: 1" });
}

export const vehiclesRouter = router({
  list: publicProcedure.input(vehicleFiltersInput).query(({ input }) => publicVehicles(input)),
  detail: publicProcedure.input(z.object({ slug: z.string().min(1).max(160) }).strict()).query(({ input }) => publicVehicle(input.slug)),
  mine: protectedProcedure.query(({ ctx }) => myVehicles(ctx.user as any)),
  save: protectedProcedure.input(z.record(z.string(), z.unknown())).mutation(({ ctx, input }) => {
    csrf(ctx);
    return saveVehicle(ctx.user as any, input);
  }),
  setStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["published", "paused", "closed", "draft"]) }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return setVehicleStatus(ctx.user as any, input.id, input.status);
    }),
  remove: protectedProcedure.input(z.object({ id: z.number().int().positive() }).strict()).mutation(({ ctx, input }) => {
    csrf(ctx);
    return deleteVehicle(ctx.user as any, input.id);
  }),
});
