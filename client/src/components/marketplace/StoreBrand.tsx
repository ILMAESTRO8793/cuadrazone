import { BadgeCheck } from "lucide-react";
import { BRAND_BADGE_LABEL, readableTextOn } from "@shared/branding";
import { trpc } from "@/lib/trpc";
import "./storeBrand.css";

/** Marca pública de una tienda con Mayor Visibilidad vigente (null si no tiene). */
export function useStoreBranding(slug: string) {
  const q = trpc.branding.forStores.useQuery(
    { slugs: [slug] },
    { staleTime: 5 * 60_000 }
  );
  return q.data?.[slug] ?? null;
}

/** Insignia «Tienda Destacada» con el color de la marca. */
export function StoreBrandBadge({
  slug,
  color,
}: {
  slug: string;
  color?: string;
}) {
  const branding = useStoreBranding(slug);
  if (!branding) return null;
  const bg = color || branding.brandColor || "#b8862b";
  return (
    <span
      className="store-brand-badge"
      style={{ background: bg, color: readableTextOn(bg) }}
    >
      <BadgeCheck size={14} aria-hidden="true" /> {BRAND_BADGE_LABEL}
    </span>
  );
}

/** Lema de la tienda, si lo tiene. */
export function StoreTagline({ slug }: { slug: string }) {
  const branding = useStoreBranding(slug);
  return branding?.tagline ? (
    <p className="store-brand-tagline">{branding.tagline}</p>
  ) : null;
}
