import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { PLAN_CATALOG_VERSION, type SelectSellerPlanInput } from "../shared/pricing";

const input: SelectSellerPlanInput = { planId: "normal" as const, catalogVersion: PLAN_CATALOG_VERSION, expectedRevision: 0, acknowledgePending: true as const };
function caller(user: TrpcContext["user"], headers: Record<string,string> = {}) {
  return appRouter.createCaller({ user, req: { headers } as TrpcContext["req"], res: {} as TrpcContext["res"] });
}
const baseUser = { id: 7, openId: "test-memory-only", role: "user" as const, name: "Prueba", email: null, phone: null, loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
describe("Permisos de selección de plan", () => {
  it("rejects anonymous reads and writes before database access", async () => {
    const api = caller(null);
    await expect(api.membership.plan.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.membership.plan.select(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("requires the CSRF request marker for writes", async () => {
    await expect(caller(baseUser).membership.plan.select(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("rejects task sessions before reads or writes", async () => {
    const api = caller({ ...baseUser, id: -1 }, { "x-cz-request": "1" });
    await expect(api.membership.plan.get()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.membership.plan.select(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
