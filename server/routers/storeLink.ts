import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { saveStoreLinkInput } from "@shared/storeLink";
import {
  myStoreLink,
  saveMyStoreLink,
  storeLinkForSlug,
} from "../services/storeLink";

/** Enlace del negocio (web o Instagram) de cada tienda. */
export const storeLinkRouter = router({
  forSlug: publicProcedure
    .input(
      z
        .object({
          slug: z
            .string()
            .min(1)
            .max(180)
            .regex(/^[a-z0-9-]+$/),
        })
        .strict()
    )
    .query(({ input }) => storeLinkForSlug(input.slug)),
  mine: protectedProcedure.query(({ ctx }) => myStoreLink(ctx.user.id)),
  save: protectedProcedure
    .input(saveStoreLinkInput)
    .mutation(({ ctx, input }) => {
      if (ctx.req.headers["x-cz-request"] !== "1")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Falta la cabecera x-cz-request: 1",
        });
      return saveMyStoreLink(ctx.user.id, input);
    }),
});
