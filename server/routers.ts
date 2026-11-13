import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { catalogRouter } from "./routers/catalog";
import { commerceRouter } from "./routers/commerce";
import { membershipRouter } from "./routers/membership";
import { realEstateRouter } from "./routers/realEstate";
import { vehiclesRouter } from "./routers/vehicles";
import { jobsRouter } from "./routers/jobs";
import { servicesRouter } from "./routers/services";
import { eventsRouter } from "./routers/events";
import { appointmentsRouter } from "./routers/appointments";
import { sellerRouter } from "./routers/seller";
import { adminPanelRouter, claimsRouter } from "./routers/adminPanel";
import { adminDashboardRouter } from "./routers/adminDashboard";
import { starsRouter } from "./routers/stars";
import { showcaseRouter } from "./routers/showcase";
import { servicePubRouter } from "./routers/servicePub";
import { brandingRouter } from "./routers/branding";
import { storeLinkRouter } from "./routers/storeLink";
import { placesRouter } from "./routers/places";
import { dispatchRouter } from "./routers/dispatch";
import { menuRouter } from "./routers/menu";
import { listingReviewsRouter } from "./routers/listingReviews";
import { profileDisplayName } from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  membership: membershipRouter,
  catalog: catalogRouter,
  commerce: commerceRouter,
  realEstate: realEstateRouter,
  vehicles: vehiclesRouter,
  jobs: jobsRouter,
  services: servicesRouter,
  events: eventsRouter,
  appointments: appointmentsRouter,
  seller: sellerRouter,
  claims: claimsRouter,
  adminPanel: adminPanelRouter,
  adminDashboard: adminDashboardRouter,
  stars: starsRouter,
  showcase: showcaseRouter,
  servicePub: servicePubRouter,
  branding: brandingRouter,
  storeLink: storeLinkRouter,
  places: placesRouter,
  dispatch: dispatchRouter,
  menu: menuRouter,
  listingReviews: listingReviewsRouter,
  auth: router({
    // El nombre que la persona escribe en su perfil manda sobre el de la cuenta
    // (que en las cuentas por código está vacío): así lo saluda la cabecera.
    me: publicProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user?.id) return user;
      const displayName = await profileDisplayName(user.id);
      return displayName ? { ...user, name: displayName } : user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
