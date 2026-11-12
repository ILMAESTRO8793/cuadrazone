/*
 * Enlace del negocio (web o Instagram) que cualquier tienda puede poner. El
 * nombre de la tienda en sus servicios abre ese enlace en otra pestaña.
 */
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import { czStoreLinks } from "../../drizzle/storelink-schema";
import { normalizeStoreLink, type SaveStoreLinkInput } from "@shared/storeLink";
import { getDb } from "../db";

async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "La base de datos no está disponible",
    });
  return db;
}

async function storeOf(
  db: Awaited<ReturnType<typeof requireDb>>,
  userId: number
) {
  const [store] = await db
    .select({ id: czStores.id })
    .from(czStores)
    .where(eq(czStores.userId, userId))
    .limit(1);
  return store ?? null;
}

export async function myStoreLink(userId: number) {
  const db = await requireDb();
  const store = await storeOf(db, userId);
  if (!store) return { hasStore: false, url: "" };
  const [row] = await db
    .select({ url: czStoreLinks.url })
    .from(czStoreLinks)
    .where(eq(czStoreLinks.storeId, store.id))
    .limit(1);
  return { hasStore: true, url: row?.url ?? "" };
}

export async function saveMyStoreLink(
  userId: number,
  input: SaveStoreLinkInput
) {
  const db = await requireDb();
  const store = await storeOf(db, userId);
  if (!store)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Primero guarda los datos de tu tienda",
    });
  const url = input.url ? normalizeStoreLink(input.url) : "";
  if (url === null)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Escribe una dirección válida, p. ej. https://tunegocio.com o @tuinstagram",
    });
  if (!url)
    await db.delete(czStoreLinks).where(eq(czStoreLinks.storeId, store.id));
  else
    await db
      .insert(czStoreLinks)
      .values({ storeId: store.id, url })
      .onDuplicateKeyUpdate({ set: { url } });
  return myStoreLink(userId);
}

/** Enlace público de una tienda por su slug, o null si no puso ninguno. */
export async function storeLinkForSlug(slug: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ url: czStoreLinks.url })
    .from(czStoreLinks)
    .innerJoin(czStores, eq(czStores.id, czStoreLinks.storeId))
    .where(eq(czStores.slug, slug))
    .limit(1);
  // Se vuelve a validar al leer, por si un dato viejo no cumple.
  return row?.url ? normalizeStoreLink(row.url) : null;
}
