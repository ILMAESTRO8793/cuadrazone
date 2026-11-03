import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { applicationStatuses, jobFiltersInput } from "@shared/jobs";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  applyToJob,
  deleteJob,
  jobApplicants,
  myApplications,
  myJobs,
  myResume,
  publicJob,
  publicJobs,
  saveJob,
  saveResume,
  setApplicationStatus,
  setJobStatus,
} from "../services/jobs";

function csrf(ctx: { req: { headers: Record<string, string | string[] | undefined> } }) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Falta la cabecera x-cz-request: 1" });
}
const id = z.object({ id: z.number().int().positive() }).strict();

export const jobsRouter = router({
  list: publicProcedure.input(jobFiltersInput).query(({ input }) => publicJobs(input)),
  detail: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(160) }).strict())
    .query(({ ctx, input }) => publicJob(input.slug, (ctx.user as any) ?? null)),
  myResume: protectedProcedure.query(({ ctx }) => myResume(ctx.user as any)),
  saveResume: protectedProcedure.input(z.record(z.string(), z.unknown())).mutation(({ ctx, input }) => {
    csrf(ctx);
    return saveResume(ctx.user as any, input);
  }),
  applyToJob: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive(), message: z.string().max(1000) }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return applyToJob(ctx.user as any, input.jobId, input.message);
    }),
  myApplications: protectedProcedure.query(({ ctx }) => myApplications(ctx.user as any)),
  mine: protectedProcedure.query(({ ctx }) => myJobs(ctx.user as any)),
  save: protectedProcedure.input(z.record(z.string(), z.unknown())).mutation(({ ctx, input }) => {
    csrf(ctx);
    return saveJob(ctx.user as any, input);
  }),
  setStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["published", "paused", "closed", "draft"]) }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return setJobStatus(ctx.user as any, input.id, input.status);
    }),
  remove: protectedProcedure.input(id).mutation(({ ctx, input }) => {
    csrf(ctx);
    return deleteJob(ctx.user as any, input.id);
  }),
  applicants: protectedProcedure.input(id).query(({ ctx, input }) => jobApplicants(ctx.user as any, input.id)),
  setApplicationStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(applicationStatuses) }).strict())
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return setApplicationStatus(ctx.user as any, input.id, input.status);
    }),
});
