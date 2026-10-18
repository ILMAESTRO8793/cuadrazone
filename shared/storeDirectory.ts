import { z } from "zod";
import { provinceOptions } from "./membership";
import {
  getBusinessCategory,
  getBusinessSpecialty,
  type BusinessSelection,
} from "./businessCategories";

export const storeDirectoryInput = z
  .object({
    q: z.string().trim().max(120).optional(),
    category: z
      .string()
      .max(100)
      .refine(
        id => Boolean(getBusinessCategory(id)),
        "Categoría de negocio no válida"
      )
      .optional(),
    specialty: z
      .string()
      .max(120)
      .refine(id => Boolean(getBusinessSpecialty(id)), "Especialidad no válida")
      .optional(),
    province: z
      .string()
      .refine(value => provinceOptions.includes(value), "Provincia no válida")
      .optional(),
    cursor: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(50).default(12),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.specialty &&
      value.category &&
      getBusinessSpecialty(value.specialty)?.categoryId !== value.category
    ) {
      context.addIssue({
        code: "custom",
        path: ["specialty"],
        message: "La especialidad no pertenece a esta categoría",
      });
    }
  });
export type StoreDirectoryInput = z.infer<typeof storeDirectoryInput>;
export type DirectoryStore = {
  id: number;
  slug: string;
  name: string;
  description: string;
  province: string;
  city: string;
  churchName: string;
  verified: true;
  businessCategories: BusinessSelection[];
};
export type DirectoryPage = {
  items: DirectoryStore[];
  nextCursor: number | null;
};

/** Los mismos filtros se usan en SSR y en la navegación del cliente. */
export function storeDirectoryQuery(search: string) {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const text = (name: string) => params.get(name)?.trim() || undefined;
  return {
    q: text("q"),
    category: text("category"),
    specialty: text("specialty"),
    province: text("province"),
    limit: 12,
  };
}
export function storeDirectoryHref(
  search: string,
  changes: Record<string, string | undefined>
) {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  params.delete("cursor");
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return `/tiendas${params.size ? `?${params.toString()}` : ""}`;
}
