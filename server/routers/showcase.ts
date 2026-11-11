import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { saveShowcaseInput, showcaseSections } from "@shared/showcase";
import { adminDeleteShowcase, adminListShowcase, adminSaveShowcase, publicShowcase } from "../services/showcase";

function csrf(ctx: { req: { headers: Record<string, string | string[] | undefined> } }) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Falta la cabecera x-cz-request: 1" });
}

/** Vitrina estilo Amazon de cada sección. */
export const showcaseRouter = router({
  forSection: publicProcedure
    .input(z.object({ section: z.enum(showcaseSections) }).strict())
    .query(({ input }) => publicShowcase(input.section)),
  adminList: adminProcedure.query(() => adminListShowcase()),
  adminSave: adminProcedure.input(saveShowcaseInput).mutation(({ ctx, input }) => {
    csrf(ctx);
    return adminSaveShowcase(input);
  }),
  adminDelete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return adminDeleteShowcase(input.id);
    }),
});
