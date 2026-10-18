import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { and, eq } from "drizzle-orm";
import {
  documentKinds,
  MAX_DOCUMENT_BYTES,
  type DocumentSnapshot,
} from "@shared/membership";
import { getDb } from "../db";
import { sdk, type AuthenticatedUser } from "../_core/sdk";
import {
  czApplications,
  czMembershipAudit,
  czVerificationDocuments,
} from "../../drizzle/schema";
import { MembershipError, validateDocumentBytes } from "./membership";

const MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const KIND_SET = new Set(documentKinds);

function errorStatus(error: unknown) {
  if (!(error instanceof MembershipError)) return 500;
  return (
    (
      {
        BAD_REQUEST: 400,
        PAYLOAD_TOO_LARGE: 413,
        UNSUPPORTED_MEDIA_TYPE: 415,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        PRECONDITION_FAILED: 412,
        CONFLICT: 409,
      } as Record<string, number>
    )[error.code] ?? 500
  );
}

function errorMessage(error: unknown) {
  return error instanceof MembershipError
    ? error.message
    : "No se pudo procesar el documento";
}

export function updateChanged(result: unknown): boolean {
  const value = result as
    | { affectedRows?: number }
    | [{ affectedRows?: number }];
  const affectedRows = Array.isArray(value)
    ? value[0]?.affectedRows
    : value && typeof value === "object"
      ? value.affectedRows
      : undefined;
  return typeof affectedRows === "number" && affectedRows >= 1;
}

export function documentIdFromInsertResult(inserted: unknown): number {
  const firstInserted = Array.isArray(inserted) ? inserted[0] : inserted;
  const candidateId =
    (firstInserted as { id?: unknown; insertId?: unknown } | undefined)?.id ??
    (firstInserted as { insertId?: unknown } | undefined)?.insertId;
  if (
    typeof candidateId !== "number" ||
    !Number.isSafeInteger(candidateId) ||
    candidateId <= 0
  )
    throw new MembershipError(
      "INTERNAL_SERVER_ERROR",
      "No se pudo identificar el documento guardado"
    );
  return candidateId;
}

export function nextApplicationRevision(revision: number): number {
  if (
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    revision === Number.MAX_SAFE_INTEGER
  )
    throw new MembershipError(
      "CONFLICT",
      "La versión de la solicitud no es válida"
    );
  return revision + 1;
}

function snapshot(row: {
  id: number;
  kind: "identity" | "pastoral";
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}): DocumentSnapshot {
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  };
}

function requireHeader(req: Request) {
  if (req.headers["x-cz-request"] !== "1")
    throw new MembershipError(
      "PRECONDITION_FAILED",
      "Falta la cabecera x-cz-request: 1"
    );
}

function safeFileName(value: string | undefined) {
  if (!value) return "documento";
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new MembershipError("BAD_REQUEST", "Nombre de archivo inválido");
  }
  const cleaned = decoded.replace(/[\\/\0\r\n]/g, "_").trim();
  if (!cleaned || cleaned.length > 200)
    throw new MembershipError("BAD_REQUEST", "Nombre de archivo inválido");
  return cleaned;
}

async function auth(req: Request): Promise<AuthenticatedUser> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.id < 0)
      throw new MembershipError(
        "FORBIDDEN",
        "Las sesiones de tareas no pueden cargar documentos"
      );
    return user;
  } catch (error) {
    if (error instanceof MembershipError) throw error;
    throw new MembershipError("UNAUTHORIZED", "Autenticación requerida");
  }
}

async function upload(req: Request, res: Response) {
  try {
    requireHeader(req);
    const user = await auth(req);
    const kind = req.params.kind as "identity" | "pastoral";
    if (!KIND_SET.has(kind))
      throw new MembershipError("BAD_REQUEST", "Tipo de documento inválido");
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]
      .toLowerCase();
    if (!MIME_TYPES.has(mimeType))
      throw new MembershipError(
        "UNSUPPORTED_MEDIA_TYPE",
        "Solo se aceptan PDF, PNG, JPEG o WEBP"
      );
    if (!Buffer.isBuffer(req.body))
      throw new MembershipError(
        "UNSUPPORTED_MEDIA_TYPE",
        "La carga debe enviarse como bytes raw, no multipart ni JSON"
      );
    const db = await getDb();
    if (!db)
      throw new MembershipError(
        "INTERNAL_SERVER_ERROR",
        "La base de datos no está disponible"
      );
    validateDocumentBytes(req.body, mimeType, MAX_DOCUMENT_BYTES);
    const fileName = safeFileName(
      req.headers["x-cz-filename"] as string | undefined
    );
    const createdAt = new Date();
    let id = 0;
    let applicationId = 0;
    await db.transaction(async (tx: any) => {
      const apps = await tx
        .select()
        .from(czApplications)
        .where(eq(czApplications.userId, user.id))
        .limit(1);
      const app = apps[0];
      if (!app || (app.status !== "draft" && app.status !== "rejected"))
        throw new MembershipError(
          "FORBIDDEN",
          "No tienes permiso para cargar este documento"
        );
      if (!app.privacyAccepted)
        throw new MembershipError(
          "PRECONDITION_FAILED",
          "Acepta privacidad antes de cargar documentos"
        );
      applicationId = app.id;
      const insertQuery = tx.insert(czVerificationDocuments).values({
        applicationId: app.id,
        userId: user.id,
        kind,
        fileName,
        mimeType,
        size: req.body.length,
        bytes: req.body,
        createdAt,
      });
      const inserted =
        typeof insertQuery.$returningId === "function"
          ? await insertQuery.$returningId()
          : await insertQuery;
      id = documentIdFromInsertResult(inserted);
      const pointer =
        kind === "identity"
          ? { identityDocumentId: id }
          : { pastoralDocumentId: id };
      const pointerUpdate = await tx
        .update(czApplications)
        .set({ ...pointer, revision: nextApplicationRevision(app.revision) })
        .where(
          and(
            eq(czApplications.id, app.id),
            eq(czApplications.userId, user.id),
            eq(czApplications.status, app.status),
            eq(czApplications.revision, app.revision)
          )
        );
      if (!updateChanged(pointerUpdate))
        throw new MembershipError(
          "CONFLICT",
          "La solicitud cambió mientras guardabas el documento"
        );
      await tx.insert(czMembershipAudit).values({
        applicationId: app.id,
        userId: user.id,
        actorUserId: user.id,
        action: "document_uploaded",
        reason: kind,
        metadata: { kind, mimeType, size: req.body.length },
      });
    });
    const docs = await db
      .select({
        id: czVerificationDocuments.id,
        kind: czVerificationDocuments.kind,
        fileName: czVerificationDocuments.fileName,
        mimeType: czVerificationDocuments.mimeType,
        size: czVerificationDocuments.size,
        createdAt: czVerificationDocuments.createdAt,
      })
      .from(czVerificationDocuments)
      .where(eq(czVerificationDocuments.id, id))
      .limit(1);
    const row = docs[0];
    if (!row)
      throw new MembershipError(
        "INTERNAL_SERVER_ERROR",
        "No se pudo guardar el documento"
      );
    return res.status(201).json(snapshot(row));
  } catch (error) {
    return res.status(errorStatus(error)).json({ error: errorMessage(error) });
  }
}

async function download(req: Request, res: Response) {
  try {
    const user = await auth(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new MembershipError("FORBIDDEN", "Documento no disponible");
    const db = await getDb();
    if (!db)
      throw new MembershipError(
        "INTERNAL_SERVER_ERROR",
        "La base de datos no está disponible"
      );
    const rows = await db
      .select()
      .from(czVerificationDocuments)
      .where(eq(czVerificationDocuments.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) throw new MembershipError("FORBIDDEN", "Documento no disponible");
    let allowed = user.role === "admin";
    if (!allowed) {
      const apps = await db
        .select()
        .from(czApplications)
        .where(
          and(
            eq(czApplications.id, row.applicationId),
            eq(czApplications.userId, user.id)
          )
        )
        .limit(1);
      allowed = apps.length > 0;
    }
    if (!allowed)
      throw new MembershipError("FORBIDDEN", "Documento no disponible");
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Content-Disposition": `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
    });
    res.type(row.mimeType);
    return res.status(200).send(row.bytes);
  } catch (error) {
    return res.status(errorStatus(error)).json({ error: errorMessage(error) });
  }
}

function rawBody(req: Request, res: Response, next: NextFunction) {
  express.raw({ type: () => true, limit: MAX_DOCUMENT_BYTES })(
    req,
    res,
    error => {
      if (!error) return next();
      const status =
        (error as { type?: string; status?: number }).type ===
          "entity.too.large" || (error as { status?: number }).status === 413
          ? 413
          : 400;
      return res.status(status).json({
        error:
          status === 413
            ? "El documento supera el límite de 5 MiB"
            : "Carga raw inválida",
      });
    }
  );
}

/** Parent server mounts this after its normal JSON parser; rawBody is route-scoped and rejects parsed JSON. */
export function registerDocumentRoutes(app: Express) {
  app.post("/api/verification/documents/:kind", rawBody, upload);
  app.get("/api/verification/documents/:id", download);
}
