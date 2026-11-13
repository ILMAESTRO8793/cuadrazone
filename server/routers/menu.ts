import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  saveMenuItemInput,
  saveRestaurantInput,
  saveSectionInput,
} from "@shared/menu";
import {
  deleteMenuItem,
  deleteSection,
  myMenu,
  publicMenu,
  saveMenuItem,
  saveRestaurant,
  saveSection,
  setItemAvailable,
} from "../services/menu";

const id = z.object({ id: z.number().int().positive() }).strict();

function requireHeader(ctx: { req: { headers: Record<string, unknown> } }) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}

/** Menú de restaurante: lo arma el vendedor y lo ve el público. */
export const menuRouter = router({
  forStore: publicProcedure
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
    .query(({ input }) => publicMenu(input.slug)),
  mine: protectedProcedure.query(({ ctx }) => myMenu(ctx.user.id)),
  saveRestaurant: protectedProcedure
    .input(saveRestaurantInput)
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return saveRestaurant(ctx.user.id, input);
    }),
  saveSection: protectedProcedure
    .input(saveSectionInput)
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return saveSection(ctx.user.id, input);
    }),
  deleteSection: protectedProcedure.input(id).mutation(({ ctx, input }) => {
    requireHeader(ctx);
    return deleteSection(ctx.user.id, input.id);
  }),
  saveItem: protectedProcedure
    .input(saveMenuItemInput)
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return saveMenuItem(ctx.user.id, input);
    }),
  setAvailable: protectedProcedure
    .input(
      z
        .object({ id: z.number().int().positive(), available: z.boolean() })
        .strict()
    )
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return setItemAvailable(ctx.user.id, input.id, input.available);
    }),
  deleteItem: protectedProcedure.input(id).mutation(({ ctx, input }) => {
    requireHeader(ctx);
    return deleteMenuItem(ctx.user.id, input.id);
  }),
});
