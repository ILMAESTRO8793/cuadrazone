import { protectedProcedure, router } from "../_core/trpc";
import { sellerDashboard } from "../services/sellerDashboard";

/** Etapa 6 · Panel del vendedor: solo datos de la tienda de quien entra. */
export const sellerRouter = router({
  dashboard: protectedProcedure.query(({ ctx }) =>
    sellerDashboard(ctx.user as any)
  ),
});
