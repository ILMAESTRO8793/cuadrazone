import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { pointInput, publicPlaceKinds } from "@shared/location";
import {
  myListingPlace,
  myStorePlace,
  orderPlaces,
  publicPlace,
  setMyListingPlace,
  setMyStorePlace,
} from "../services/places";

const id = z.number().int().positive();
const listingKind = z.enum(["inmueble", "auto", "empleo"]);

function requireHeader(ctx: { req: { headers: Record<string, unknown> } }) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}

/** Ubicaciones en el mapa (zona aproximada en público, exacta en pedidos). */
export const placesRouter = router({
  publicPlace: publicProcedure
    .input(
      z
        .object({
          kind: z.enum(publicPlaceKinds),
          id: id.optional(),
          slug: z
            .string()
            .min(1)
            .max(180)
            .regex(/^[a-z0-9-]+$/)
            .optional(),
        })
        .strict()
    )
    .query(({ input }) => publicPlace(input.kind, input)),
  myStore: protectedProcedure.query(({ ctx }) => myStorePlace(ctx.user.id)),
  setMyStore: protectedProcedure
    .input(z.object({ point: pointInput.nullable() }).strict())
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return setMyStorePlace(ctx.user.id, input.point);
    }),
  myListing: protectedProcedure
    .input(z.object({ kind: listingKind, id }).strict())
    .query(({ ctx, input }) =>
      myListingPlace(ctx.user.id, input.kind, input.id)
    ),
  setMyListing: protectedProcedure
    .input(
      z.object({ kind: listingKind, id, point: pointInput.nullable() }).strict()
    )
    .mutation(({ ctx, input }) => {
      requireHeader(ctx);
      return setMyListingPlace(ctx.user.id, input.kind, input.id, input.point);
    }),
  order: protectedProcedure
    .input(z.object({ id }).strict())
    .query(({ ctx, input }) => orderPlaces(ctx.user.id, input.id)),
});
