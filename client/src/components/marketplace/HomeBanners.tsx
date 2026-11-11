import { Link } from "wouter";
import type { BannerDTO } from "@shared/siteContent";
import { trpc } from "@/lib/trpc";
import "./homeBanners.css";

/**
 * Etapa 6 · Banners de la portada que publica el administrador. Si no hay
 * ninguno vigente, no se dibuja nada y el inicio queda como siempre.
 */
export function HomeBanners() {
  const banners = trpc.catalog.banners.useQuery(undefined, {
    staleTime: 60 * 1000,
    retry: false,
  });
  const list = banners.data ?? [];
  if (!list.length) return null;
  return (
    <section className="home-banners container" aria-label="Novedades de CuadraZone">
      <div className={`home-banners-track ${list.length === 1 ? "is-single" : ""}`}>
        {list.map((b, i) => (
          <Banner key={b.id} banner={b} first={i === 0} />
        ))}
      </div>
    </section>
  );
}

function Banner({ banner, first }: { banner: BannerDTO; first: boolean }) {
  const body = (
    <>
      {banner.imageUrl && (
        <img
          src={banner.imageUrl}
          alt=""
          loading={first ? "eager" : "lazy"}
          decoding="async"
        />
      )}
      <span className="home-banner-text">
        <strong>{banner.title}</strong>
        {banner.subtitle && <span>{banner.subtitle}</span>}
      </span>
    </>
  );
  const link = banner.linkUrl;
  if (!link) return <div className="home-banner">{body}</div>;
  if (link.startsWith("/"))
    return (
      <Link href={link} className="home-banner">
        {body}
      </Link>
    );
  return (
    <a href={link} className="home-banner" target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  );
}
