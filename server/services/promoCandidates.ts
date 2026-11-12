/*
 * Para armar banners y la vitrina sin subir nada: tiendas (por defecto solo
 * las de Mayor Visibilidad) o productos y servicios publicados.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { czProducts, czServices, czStores } from "../../drizzle/catalog-schema";
import { czApplications } from "../../drizzle/schema";
import type { PromoCandidate } from "@shared/showcase";
import { getDb } from "../db";

export async function adminPromoCandidates(input: {
  kind: "tiendas" | "items";
  q: string;
  onlyFeatured: boolean;
}): Promise<PromoCandidate[]> {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "La base de datos no está disponible",
    });
  const q = input.q.trim();
  const live = and(
    eq(czApplications.status, "approved"),
    eq(czApplications.subscriptionStatus, "active")
  );
  const onlyFeatured = input.onlyFeatured
    ? eq(czApplications.subscriptionPlanId, "mayor_visibilidad")
    : undefined;
  const featuredSql = sql<number>`case when ${czApplications.subscriptionPlanId} = 'mayor_visibilidad' then 1 else 0 end`;
  const price = (c: number | null) =>
    c ? `US$${(c / 100).toFixed(2)} · ` : "";

  if (input.kind === "tiendas") {
    const rows = await db
      .select({
        id: czStores.id,
        name: czStores.name,
        slug: czStores.slug,
        logoUrl: czStores.logoUrl,
        province: czStores.province,
        kind: czStores.storeKind,
        featured: featuredSql,
      })
      .from(czStores)
      .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
      .where(
        and(live, onlyFeatured, q ? like(czStores.name, `%${q}%`) : undefined)
      )
      .orderBy(desc(featuredSql), asc(czStores.name))
      .limit(60);
    return rows.map(r => ({
      key: `tienda-${r.id}`,
      kind: "tienda" as const,
      title: r.name,
      subtitle: `${r.kind === "servicios" ? "Servicios" : "Comercio"} · ${r.province}`,
      imageUrl: r.logoUrl ?? null,
      linkUrl: `/tiendas/${r.slug}`,
      storeId: r.id,
      storeName: r.name,
      featured: Number(r.featured) === 1,
    }));
  }

  const [products, services] = await Promise.all([
    db
      .select({
        id: czProducts.id,
        slug: czProducts.slug,
        title: czProducts.title,
        priceCents: czProducts.priceCents,
        images: czProducts.imageUrls,
        storeId: czStores.id,
        storeName: czStores.name,
        featured: featuredSql,
      })
      .from(czProducts)
      .innerJoin(czStores, eq(czStores.id, czProducts.storeId))
      .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
      .where(
        and(
          live,
          onlyFeatured,
          eq(czProducts.status, "published"),
          q
            ? or(
                like(czProducts.title, `%${q}%`),
                like(czStores.name, `%${q}%`)
              )
            : undefined
        )
      )
      .orderBy(desc(czProducts.updatedAt))
      .limit(40),
    db
      .select({
        id: czServices.id,
        slug: czServices.slug,
        title: czServices.title,
        priceCents: czServices.priceCents,
        images: czServices.images,
        storeId: czStores.id,
        storeName: czStores.name,
        featured: featuredSql,
      })
      .from(czServices)
      .innerJoin(czStores, eq(czStores.userId, czServices.userId))
      .innerJoin(czApplications, eq(czApplications.userId, czServices.userId))
      .where(
        and(
          live,
          onlyFeatured,
          eq(czServices.status, "published"),
          q
            ? or(
                like(czServices.title, `%${q}%`),
                like(czStores.name, `%${q}%`)
              )
            : undefined
        )
      )
      .orderBy(desc(czServices.updatedAt))
      .limit(40),
  ]);
  return [
    ...products.map(p => ({
      key: `producto-${p.id}`,
      kind: "producto" as const,
      title: p.title,
      subtitle: `${price(p.priceCents)}${p.storeName}`,
      imageUrl: (p.images as string[] | null)?.[0] ?? null,
      linkUrl: `/articulo/${p.slug}`,
      storeId: p.storeId,
      storeName: p.storeName,
      featured: Number(p.featured) === 1,
    })),
    ...services.map(s => ({
      key: `servicio-${s.id}`,
      kind: "servicio" as const,
      title: s.title,
      subtitle: `${price(s.priceCents)}${s.storeName}`,
      imageUrl: (s.images as string[] | null)?.[0] ?? null,
      linkUrl: `/servicio/${s.slug}`,
      storeId: s.storeId,
      storeName: s.storeName,
      featured: Number(s.featured) === 1,
    })),
  ];
}
