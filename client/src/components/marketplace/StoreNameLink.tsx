import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { StoreLogo } from "./StoreLogo";

/**
 * Logo y nombre del negocio. El nombre abre la web o el Instagram que puso la
 * tienda; si no puso ninguno, lleva a su página en CuadraZone.
 */
export function StoreNameLink({
  slug,
  name,
  logoUrl,
  logoSize = 28,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  logoSize?: number;
}) {
  const link = trpc.storeLink.forSlug.useQuery(
    { slug },
    { staleTime: 5 * 60_000 }
  );
  const logo = <StoreLogo name={name} logoUrl={logoUrl} size={logoSize} />;
  if (link.data)
    return (
      <a
        className="store-name-link"
        href={link.data}
        target="_blank"
        rel="noopener noreferrer nofollow"
        title={`Abrir la web de ${name}`}
      >
        {logo}
        <span>{name}</span>
      </a>
    );
  return (
    <Link className="store-name-link" href={`/tiendas/${slug}`}>
      {logo}
      <span>{name}</span>
    </Link>
  );
}
