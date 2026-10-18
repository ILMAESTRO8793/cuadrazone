import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  getSellerPlan,
  PLAN_CATALOG_VERSION,
  selectSellerPlanInput,
  type PlanSelectionSnapshot,
  type SelectSellerPlanInput,
  type SellerPlanId,
} from "@shared/pricing";
import { getDb } from "../db";
import {
  czMembershipAudit,
  czPlanSelections,
  users,
  type PlanSelection,
} from "../../drizzle/schema";

/**
 * The selection is deliberately separate from billing and application state.
 * It is only the seller's pending preference for a catalog plan.
 */
export function validatePlanSelectionInput(input: unknown): SelectSellerPlanInput {
  const parsed = selectSellerPlanInput.safeParse(input);
  if (!parsed.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        parsed.error.issues[0]?.message ?? "La selección de plan no es válida",
    });
  }
  return parsed.data;
}

function requireUserId(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "El usuario no es válido",
    });
  }
}

function databaseOrFail(db: unknown): any {
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "La base de datos no está disponible",
    });
  }
  return db;
}

async function preservePlanErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "No se pudo completar la operación",
    });
  }
}

function iso(value: Date | string | null | undefined, fallback: Date): string {
  const date = value instanceof Date ? value : value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

function snapshot(row: PlanSelection, fallback = new Date()): PlanSelectionSnapshot {
  return {
    planId: row.planId as SellerPlanId,
    catalogVersion: row.catalogVersion,
    revision: row.revision,
    updatedAt: iso(row.updatedAt, fallback),
  };
}

function conflict(message = "La selección de plan cambió en otra sesión; recarga antes de guardar"): never {
  throw new TRPCError({ code: "CONFLICT", message });
}

function affectedRows(result: unknown): number | undefined {
  const value = result as
    | { affectedRows?: number }
    | [{ affectedRows?: number }]
    | undefined;
  return Array.isArray(value) ? value[0]?.affectedRows : value?.affectedRows;
}

function isDuplicateKey(error: unknown): boolean {
  const candidate = error as { code?: unknown; errno?: unknown; message?: unknown };
  return (
    candidate?.code === "ER_DUP_ENTRY" ||
    candidate?.errno === 1062 ||
    (typeof candidate?.message === "string" &&
      candidate.message.toLowerCase().includes("duplicate"))
  );
}

function nextRevision(current: number): number {
  if (!Number.isSafeInteger(current) || current < 1 || current >= Number.MAX_SAFE_INTEGER)
    conflict("La revisión de la selección de plan no es válida");
  return current + 1;
}

/** Read the pending plan preference for a real application user. */
export async function getPlanSelection(userId: number): Promise<PlanSelectionSnapshot | null> {
  requireUserId(userId);
  return preservePlanErrors(async () => {
    const db = databaseOrFail(await getDb());
    const rows = await db
      .select()
      .from(czPlanSelections)
      .where(eq(czPlanSelections.userId, userId))
      .limit(1);
    const row = rows[0] as PlanSelection | undefined;
    return row ? snapshot(row) : null;
  });
}

/**
 * Persist a pending preference. The owner row is locked before reading the
 * unique selection row, which serializes first insertions as well as updates.
 */
export async function selectSellerPlan(
  userId: number,
  input: unknown
): Promise<PlanSelectionSnapshot> {
  requireUserId(userId);
  const selection = validatePlanSelectionInput(input);
  const plan = getSellerPlan(selection.planId);
  return preservePlanErrors(async () => {
    const db = databaseOrFail(await getDb());
    return db.transaction(async (tx: any) => {
      // A missing selection row cannot itself be locked. Locking the owner row
      // makes concurrent first inserts for the same user wait on one another.
      const ownerRows = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for("update")
        .limit(1);
      if (!ownerRows[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "El usuario propietario no existe",
        });
      }

      const rows = await tx
        .select()
        .from(czPlanSelections)
        .where(eq(czPlanSelections.userId, userId))
        .limit(1);
      const current = rows[0] as PlanSelection | undefined;
      const expectedRevision = current?.revision ?? 0;

      if (selection.expectedRevision !== expectedRevision) conflict();

      const now = new Date();
      let saved: PlanSelection;
      if (!current) {
        try {
          await tx.insert(czPlanSelections).values({
            userId,
            planId: selection.planId,
            catalogVersion: selection.catalogVersion,
            revision: 1,
            createdAt: now,
            updatedAt: now,
          });
        } catch (error) {
          // This is defensive for a stale/legacy owner lock or a DB that did not
          // serialize the unique-key race. Never report a duplicate as success.
          if (isDuplicateKey(error)) conflict();
          throw error;
        }
        saved = {
          id: 0,
          userId,
          planId: selection.planId,
          catalogVersion: selection.catalogVersion,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        } as PlanSelection;
      } else {
        const revision = nextRevision(current.revision);
        const result = await tx
          .update(czPlanSelections)
          .set({
            planId: selection.planId,
            catalogVersion: selection.catalogVersion,
            revision,
            updatedAt: now,
          })
          .where(
            and(
              eq(czPlanSelections.userId, userId),
              eq(czPlanSelections.revision, current.revision)
            )
          );
        if (affectedRows(result) !== 1) conflict();
        saved = {
          ...current,
          planId: selection.planId,
          catalogVersion: selection.catalogVersion,
          revision,
          updatedAt: now,
        };
      }

      await tx.insert(czMembershipAudit).values({
        applicationId: null,
        userId,
        actorUserId: userId,
        action: "plan_selected",
        reason: null,
        metadata: {
          planId: plan.id,
          catalogVersion: PLAN_CATALOG_VERSION,
          monthlyCents: plan.monthlyCents,
        },
      });

      return snapshot(saved, now);
    });
  });
}

// Alias kept explicit for callers that name the operation after the router.
export const selectPlan = selectSellerPlan;
