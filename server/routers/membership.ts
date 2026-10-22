import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sellerPlanIds } from "@shared/pricing";
import {
  adminDeactivateSubscription,
  adminListPayments,
  adminListSubscriptions,
  adminRecordPayment,
  MAX_MONTHS_PER_PAYMENT,
  PAYMENT_METHODS,
  paymentContact,
  subscriptionForUser,
} from "../services/subscriptions";
import { adminCommissionDetail, adminRecordCommissionPayment, commissionForSeller } from "../services/commissions";
import {
  saveApplicationInput,
  splitApplicationSave,
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
  adminSetPhoneVerification,
  verifyEmailWithAccount,
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
        // revision y consentVersion son campos de control: no forman parte de la
        // solicitud que el servicio valida de forma estricta.
        const { revision, consentVersion, application } = splitApplicationSave(input);
        return serviceCall(() =>
          saveApplication(realUser(ctx.user) as any, application, revision, consentVersion)
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
    /** Verifica el correo del perfil con la cuenta de Google de la sesión. */
    emailWithGoogle: protectedProcedure.mutation(({ ctx }) => {
      csrf(ctx);
      const user = realUser(ctx.user);
      return serviceCall(() => verifyEmailWithAccount(user as any));
    }),
  }),
  commission: router({
    /** Comisión pendiente del propio vendedor. */
    mine: protectedProcedure.query(({ ctx }) => commissionForSeller(realUser(ctx.user).id)),
    detail: adminProcedure
      .input(z.object({ applicationId: z.number().int().positive() }).strict())
      .query(({ ctx, input }) => {
        realUser(ctx.user);
        return adminCommissionDetail(input.applicationId);
      }),
    recordPayment: adminProcedure
      .input(
        z.object({
          applicationId: z.number().int().positive(),
          amountCents: z.number().int().positive().max(100_000_000),
          method: z.enum(PAYMENT_METHODS),
          reference: z.string().max(120),
          paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          note: z.string().max(500),
        }).strict()
      )
      .mutation(({ ctx, input }) => {
        csrf(ctx);
        return adminRecordCommissionPayment(realUser(ctx.user) as any, input);
      }),
  }),
  subscription: router({
    /** Estado de la suscripción del propio vendedor y a quién pagarle. */
    mine: protectedProcedure.query(async ({ ctx }) => {
      const user = realUser(ctx.user);
      return { subscription: await subscriptionForUser(user.id), paymentContact: paymentContact() };
    }),
    list: adminProcedure.query(({ ctx }) => {
      realUser(ctx.user);
      return adminListSubscriptions();
    }),
    payments: adminProcedure
      .input(z.object({ applicationId: z.number().int().positive() }).strict())
      .query(({ ctx, input }) => {
        realUser(ctx.user);
        return adminListPayments(input.applicationId);
      }),
    recordPayment: adminProcedure
      .input(
        z.object({
          applicationId: z.number().int().positive(),
          planId: z.enum(sellerPlanIds),
          months: z.number().int().min(1).max(MAX_MONTHS_PER_PAYMENT),
          amountCents: z.number().int().positive().max(1_000_000),
          method: z.enum(PAYMENT_METHODS),
          reference: z.string().max(120),
          paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          note: z.string().max(500),
        }).strict()
      )
      .mutation(({ ctx, input }) => {
        csrf(ctx);
        const admin = realUser(ctx.user);
        return adminRecordPayment(admin as any, input);
      }),
    deactivate: adminProcedure
      .input(z.object({ applicationId: z.number().int().positive(), reason: z.string().trim().min(5).max(500) }).strict())
      .mutation(({ ctx, input }) => {
        csrf(ctx);
        const admin = realUser(ctx.user);
        return adminDeactivateSubscription(admin as any, input.applicationId, input.reason);
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
    phoneVerification: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          revision: z.number().int().positive(),
          verified: z.boolean(),
          note: z.string().trim().min(5).max(500),
        }).strict()
      )
      .mutation(({ ctx, input }) => {
        csrf(ctx);
        const admin = realUser(ctx.user);
        return serviceCall(() =>
          adminSetPhoneVerification(admin as any, input.id, input.revision, input.verified, input.note)
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
