import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

/** Mensaje para errores inesperados: el detalle queda solo en el registro del servidor. */
export const INTERNAL_ERROR_MESSAGE = "Ocurrió un error. Inténtalo de nuevo.";

/**
 * Un error inesperado (p. ej. una consulta que falló) llega envuelto con el
 * mensaje original, que puede traer el texto de la consulta SQL. Fuera del
 * entorno de desarrollo se cambia por un mensaje genérico.
 */
export function isUnexpectedError(error: TRPCError) {
  return (
    error.code === "INTERNAL_SERVER_ERROR" &&
    error.cause instanceof Error &&
    !(error.cause instanceof TRPCError) &&
    error.message === error.cause.message
  );
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (process.env.NODE_ENV === "development" || !isUnexpectedError(error)) return shape;
    return {
      ...shape,
      message: INTERNAL_ERROR_MESSAGE,
      data: { ...shape.data, stack: undefined },
    };
  },
});

export const router = t.router;

/**
 * Protección CSRF para todas las operaciones que cambian datos: el navegador
 * solo puede mandar esta cabecera desde nuestras propias páginas.
 */
const requireCsrfHeader = t.middleware(({ ctx, type, next }) => {
  if (type === "mutation" && ctx.req?.headers?.["x-cz-request"] !== "1") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Falta la cabecera x-cz-request: 1",
    });
  }
  return next();
});

export const publicProcedure = t.procedure.use(requireCsrfHeader);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireUser);

export const adminProcedure = publicProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
