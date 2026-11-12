import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { saveBrandingInput } from "@shared/branding";
import {
  brandingForSlugs,
  myBranding,
  saveMyBranding,
} from "../services/storeBranding";

const slug = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9-]+$/);

/** Marca de la tienda (Mayor Visibilidad): portada, lema, color e insignia. */
export const brandingRouter = router({
  forStores: publicProcedure
    .input(z.object({ slugs: z.array(slug).max(60) }).strict())
    .query(({ input }) => brandingForSlugs(input.slugs)),
  mine: protectedProcedure.query(({ ctx }) => myBranding(ctx.user as any)),
  save: protectedProcedure
    .input(saveBrandingInput)
    .mutation(({ ctx, input }) => {
      if (ctx.req.headers["x-cz-request"] !== "1")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Falta la cabecera x-cz-request: 1",
        });
      return saveMyBranding(ctx.user as any, input);
    }),
});
