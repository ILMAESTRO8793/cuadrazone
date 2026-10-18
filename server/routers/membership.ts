import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  saveApplicationInput,
  applicationStatuses,
  profileInput,
  type ApplicationStatus,
} from "@shared/membership";
import { selectSellerPlanInput } from "@shared/pricing";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";
import {
  adminDetail,
  failClosedVerification,
  getMembership,
  listApplications,
  listAllDenominations,
  listDenominations,
  readiness,
  reviewApplication,
  saveApplication,
  saveDenomination,
  saveProfile,
  serviceCall,
  submitApplication,
} from "../services/membership";
import { getPlanSelection, selectSellerPlan } from "../services/sellerPlans";

type MembershipUser = { id: number; role: "user" | "admin"; isCron?: boolean };

function realUser(user: MembershipUser): MembershipUser {
  if (user.id < 0 || user.isCron)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Las sesiones de tareas no pueden usar membership",
    });
  return user;
}

function rejectCron(user: unknown) {
  const candidate = user as Partial<MembershipUser> | null;
  if (
    candidate &&
    (candidate.id === undefined || candidate.id < 0 || candidate.isCron)
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Las sesiones de tareas no pueden usar membership",
    });
}

function csrf(ctx: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}

const revisionInput = z
  .object({ revision: z.number().int().positive() })
  .strict();
const adminStatusInput = z
  .object({
    status: z.union([z.literal("all"), z.enum(applicationStatuses)]),
    cursor: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .strict();
const decisionInput = z
  .object({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string(),
    documentsReviewed: z.boolean(),
  })
  .strict();
const denominationInput = z
  .object({
    id: z.number().int().positive().optional(),
    name: z.string(),
    active: z.boolean(),
  })
  .strict();

export const membershipRouter = router({
  readiness: publicProcedure.query(({ ctx }) => {
    rejectCron(ctx.user);
    return readiness();
  }),
  me: protectedProcedure.query(({ ctx }) =>
    serviceCall(() => getMembership(realUser(ctx.user) as any))
  ),
  plan: router({
    get: protectedProcedure.query(({ ctx }) => {
      const user = realUser(ctx.user);
      return getPlanSelection(user.id);
    }),
    select: protectedProcedure
      .input(selectSellerPlanInput)
      .mutation(({ ctx, input }) => {
        csrf(ctx);
        const user = realUser(ctx.user);
        return selectSellerPlan(user.id, input);
      }),
  }),
  profile: router({
    save: protectedProcedure.input(profileInput).mutation(({ ctx, input }) => {
      csrf(ctx);
      return serviceCall(() => saveProfile(realUser(ctx.user) as any, input));
    }),
  }),
  denominations: router({
    list: publicProcedure.query(({ ctx }) => {
      rejectCron(ctx.user);
      return serviceCall(() => listDenominations());
    }),
  }),
  application: router({
    save: protectedProcedure
      .input(saveApplicationInput)
      .mutation(({ ctx, input }) => {
        csrf(ctx);
        return serviceCall(() =>
          saveApplication(realUser(ctx.user) as any, input, input.revision, input.consentVersion)
        );
      }),
    submit: protectedProcedure
      .input(revisionInput)
      .mutation(({ ctx, input }) => {
        csrf(ctx);
        return serviceCall(() =>
          submitApplication(realUser(ctx.user) as any, input.revision)
        );
      }),
  }),
  verification: router({
    sendEmail: protectedProcedure.mutation(({ ctx }) => {
      csrf(ctx);
      realUser(ctx.user);
      return serviceCall(() => failClosedVerification());
    }),
    confirmEmail: protectedProcedure
      .input(z.object({ code: z.string().regex(/^\d{6}$/) }).strict())
      .mutation(({ ctx }) => {
        csrf(ctx);
        realUser(ctx.user);
        return serviceCall(() => failClosedVerification());
      }),
    sendPhone: protectedProcedure.mutation(({ ctx }) => {
      csrf(ctx);
      realUser(ctx.user);
      return serviceCall(() => failClosedVerification());
    }),
    confirmPhone: protectedProcedure
      .input(z.object({ code: z.string().regex(/^\d{6}$/) }).strict())
      .mutation(({ ctx }) => {
        csrf(ctx);
        realUser(ctx.user);
        return serviceCall(() => failClosedVerification());
      }),
  }),
  admin: router({
    denominations: adminProcedure.query(({ ctx }) => {
      realUser(ctx.user);
      return serviceCall(() => listAllDenominations());
    }),
    list: adminProcedure.input(adminStatusInput).query(({ ctx, input }) => {
      realUser(ctx.user);
      return serviceCall(() =>
        listApplications(
          input.status as "all" | ApplicationStatus,
          input.cursor,
          input.limit
        )
      );
    }),
    detail: adminProcedure
      .input(z.object({ id: z.number().int().positive() }).strict())
      .query(({ ctx, input }) => {
        realUser(ctx.user);
        return serviceCall(() => adminDetail(input.id));
      }),
    review: adminProcedure.input(decisionInput).mutation(({ ctx, input }) => {
      csrf(ctx);
      const admin = realUser(ctx.user);
      return serviceCall(() =>
        reviewApplication(
          admin as any,
          input.id,
          input.revision,
          input.decision,
          input.reason,
          input.documentsReviewed
        )
      );
    }),
    saveDenomination: adminProcedure
      .input(denominationInput)
      .mutation(({ ctx, input }) => {
        csrf(ctx);
        realUser(ctx.user);
        return serviceCall(() => saveDenomination(input));
      }),
  }),
});
