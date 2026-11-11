import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { expenseInput, financeSettingsInput } from "@shared/finance";
import {
  addExpense,
  dashboardCustomers,
  dashboardOverview,
  dashboardStoreDetail,
  dashboardStores,
  deleteExpense,
  getFinanceSettings,
  listExpenses,
  saveFinanceSettings,
} from "../services/adminDashboard";

function csrf(ctx: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  if (ctx.req.headers["x-cz-request"] !== "1")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
}
const year = z.object({ year: z.number().int().min(2024).max(2100) }).strict();
const id = z.object({ id: z.number().int().positive() }).strict();

/** Dashboard CuadraZone: métricas, finanzas y gastos (solo administradores). */
export const adminDashboardRouter = router({
  overview: adminProcedure
    .input(year)
    .query(({ input }) => dashboardOverview(input.year)),
  stores: adminProcedure.query(() => dashboardStores()),
  store: adminProcedure
    .input(id)
    .query(({ input }) => dashboardStoreDetail(input.id)),
  customers: adminProcedure
    .input(
      z
        .object({
          search: z.string().max(120).default(""),
          page: z.number().int().min(0).max(10_000).default(0),
        })
        .strict()
    )
    .query(({ input }) => dashboardCustomers(input.search, input.page)),
  expenses: adminProcedure
    .input(year)
    .query(({ input }) => listExpenses(input.year)),
  addExpense: adminProcedure.input(expenseInput).mutation(({ ctx, input }) => {
    csrf(ctx);
    return addExpense(ctx.user.id, input);
  }),
  deleteExpense: adminProcedure.input(id).mutation(({ ctx, input }) => {
    csrf(ctx);
    return deleteExpense(input.id);
  }),
  settings: adminProcedure.query(() => getFinanceSettings()),
  saveSettings: adminProcedure
    .input(financeSettingsInput)
    .mutation(({ ctx, input }) => {
      csrf(ctx);
      return saveFinanceSettings(ctx.user.id, input);
    }),
});
