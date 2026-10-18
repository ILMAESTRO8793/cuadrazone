import {
  and,
  desc,
  eq,
  isNotNull,
  like,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import { czApplications, czMembershipProfiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { CatalogError } from "./catalog";
import {
  businessCategories,
  matchingBusinessSelections,
  normalizeBusinessSearch,
  readBusinessSelections,
  type BusinessSelection,
} from "@shared/businessCategories";
import {
  storeDirectoryInput,
  type DirectoryPage,
  type DirectoryStore,
  type StoreDirectoryInput,
} from "@shared/storeDirectory";

function activeDirectoryConditions() {
  return [
    eq(czApplications.status, "approved"),
    eq(czApplications.subscriptionStatus, "active"),
    isNotNull(czMembershipProfiles.emailVerifiedAt),
    isNotNull(czMembershipProfiles.phoneVerifiedAt),
    eq(czApplications.contactEmail, czMembershipProfiles.email),
    eq(czApplications.contactPhone, czMembershipProfiles.phone),
  ];
}
function categoryContains(selection: BusinessSelection): SQL {
  // JSON_CONTAINS incluye especialidad y categoría en el mismo objeto, no en grupos distintos.
  const candidate = JSON.stringify([
    {
      categoryId: selection.categoryId,
      ...(selection.specialtyIds.length
        ? { specialtyIds: selection.specialtyIds }
        : {}),
    },
  ]);
  return sql`json_contains(${czApplications.details}, ${candidate}, '$.businessCategories') = 1`;
}
export function directoryConditions(input: StoreDirectoryInput): SQL[] {
  const conditions = activeDirectoryConditions();
  if (input.category || input.specialty) {
    const categoryId =
      input.category ??
      businessCategories.find(category =>
        category.specialties.some(s => s.id === input.specialty)
      )!.id;
    conditions.push(
      categoryContains({
        categoryId,
        specialtyIds: input.specialty ? [input.specialty] : [],
      })
    );
  }
  if (input.province) conditions.push(eq(czStores.province, input.province));
  if (input.cursor) conditions.push(lt(czStores.id, input.cursor));
  if (input.q) {
    const term = `%${input.q.replace(/[\\%_]/g, character => `\\${character}`)}%`;
    const matches = matchingBusinessSelections(input.q).flatMap(selection =>
      selection.specialtyIds.length
        ? selection.specialtyIds.map(id =>
            categoryContains({
              categoryId: selection.categoryId,
              specialtyIds: [id],
            })
          )
        : [categoryContains(selection)]
    );
    conditions.push(
      or(
        like(czStores.name, term),
        like(czStores.description, term),
        like(czStores.city, term),
        ...matches
      )!
    );
  }
  return conditions;
}
function parseSelectionProjection(value: unknown): BusinessSelection[] {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return readBusinessSelections({ businessCategories: value });
}
export async function listPublicStores(
  raw: StoreDirectoryInput
): Promise<DirectoryPage> {
  const input = storeDirectoryInput.parse(raw);
  const db = await getDb();
  if (!db)
    throw new CatalogError(
      "INTERNAL_SERVER_ERROR",
      "No se pudo cargar el directorio de tiendas"
    );
  const rows = await db
    .select({
      id: czStores.id,
      slug: czStores.slug,
      name: czStores.name,
      description: czStores.description,
      province: czStores.province,
      city: czStores.city,
      churchName: czApplications.churchName,
      businessCategories: sql<unknown>`json_extract(${czApplications.details}, '$.businessCategories')`,
    })
    .from(czStores)
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    )
    .where(and(...directoryConditions(input)))
    .orderBy(desc(czStores.id))
    .limit(input.limit + 1);
  const page = rows.slice(0, input.limit);
  const items: DirectoryStore[] = page.map(row => ({
    ...row,
    verified: true,
    businessCategories: parseSelectionProjection(row.businessCategories),
  }));
  return {
    items,
    nextCursor: rows.length > input.limit ? page[page.length - 1]!.id : null,
  };
}
export async function suggestStores(q: string): Promise<string[]> {
  const term = normalizeBusinessSearch(q);
  const labels = businessCategories
    .flatMap(category => [
      category.label,
      ...category.specialties.map(specialty => specialty.label),
    ])
    .filter(label => normalizeBusinessSearch(label).includes(term))
    .slice(0, 6);
  const stores = await listPublicStores(
    storeDirectoryInput.parse({ q, limit: 6 })
  );
  return [
    ...new Set([...labels, ...stores.items.map(store => store.name)]),
  ].slice(0, 10);
}
