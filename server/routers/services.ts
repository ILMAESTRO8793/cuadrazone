import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requestStatuses, serviceFiltersInput } from "@shared/services";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { countStoreProducts } from "../services/catalog";
import {
  changeStoreKind,
  deleteService,
  myServiceRequests,
  myServices,
  publicService,
  publicServices,
  requestService,
  saveService,
  setRequestStatus,
  setServiceStatus,
} from "../services/serviceListings";

function csrf(ctx: { req: { headers: Record<string, string | string[] | undefined> } }) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Falta la cabecera x-cz-request: 1" });
}
const id = z.object({ id: z.number().int().positive() }).strict();

export const servicesRouter = router({
  list: publicProcedure.input(serviceFiltersInput).query(({ input }) => publicServices(input)),
  detail: publicProcedure.input(z.object({ slug: z.string().min(1).max(180) }).strict()).query(({ input }) => publicService(input.slug)),
  mine: protectedProcedure.query(({ ctx }) => myServices(ctx.user as any)),
  save: protectedProcedure.input(z.record(z.string(), z.unknown())).mutation(({ ctx, input }) => {
    csrf(ctx);
    return saveService(ctx.user as any, input);
  }),
  setStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["draft", "published", "paused"]) }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return setServiceStatus(ctx.user as any, input.id, input.status);
    }),
  remove: protectedProcedure.input(id).mutation(({ ctx, input }) => {
    csrf(ctx);
    return deleteService(ctx.user as any, input.id);
  }),
  requestService: protectedProcedure.input(z.record(z.string(), z.unknown())).mutation(({ ctx, input }) => {
    csrf(ctx);
    return requestService(ctx.user as any, input);
  }),
  myRequests: protectedProcedure.query(({ ctx }) => myServiceRequests(ctx.user as any)),
  setRequestStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(requestStatuses) }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return setRequestStatus(ctx.user as any, input.id, input.status);
    }),
  changeStoreKind: protectedProcedure
    .input(z.object({ storeKind: z.enum(["comercio", "servicios"]) }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return changeStoreKind(ctx.user as any, input.storeKind, countStoreProducts);
    }),
});
