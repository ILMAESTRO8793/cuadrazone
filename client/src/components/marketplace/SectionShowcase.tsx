import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ShowcaseSection, ShowcaseTile } from "@shared/showcase";
import { trpc } from "@/lib/trpc";
import { StoreLogo } from "./StoreLogo";
import "./sectionShowcase.css";

/**
 * Vitrina estilo Amazon arriba de cada sección: a la izquierda un reel o video
 * grande; a la derecha, una fila de tiendas destacadas y otra de productos
 * promocionados. No muestra nada mientras el administrador no la arme.
 */
export function SectionShowcase({ section }: { section: ShowcaseSection }) {
  const q = trpc.showcase.forSection.useQuery(
    { section },
    { staleTime: 60_000 }
  );
  const d = q.data;
  if (!d || (!d.reel && !d.stores.length && !d.products.length)) return null;
  return (
    <section
      className={`showcase ${d.reel ? "" : "showcase--no-reel"}`}
      aria-label="Vitrina de CuadraZone"
    >
      {d.reel && <Reel tile={d.reel} />}
      <div className="showcase-rows">
        {d.stores.length > 0 && (
          <Row title="Tiendas destacadas" tone="stores">
            {d.stores.map((t, i) => (
              <StoreTile key={t.id} tile={t} index={i} />
            ))}
          </Row>
        )}
        {d.products.length > 0 && (
          <Row title="Productos promocionados" tone="products">
            {d.products.map(t => (
              <ProductCard key={t.id} tile={t} />
            ))}
          </Row>
        )}
      </div>
    </section>
  );
}

function TileLink({
  href,
  className,
  children,
  label,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  label: string;
}) {
  if (!href) return <div className={className}>{children}</div>;
  if (href.startsWith("/"))
    return (
      <Link href={href} className={className} aria-label={label}>
        {children}
      </Link>
    );
  return (
    <a
      href={href}
      className={className}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

function Reel({ tile }: { tile: ShowcaseTile }) {
  const video = useRef<HTMLVideoElement>(null);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [playing, setPlaying] = useState(!reduced);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing]);

  return (
    <div className="showcase-reel">
      <TileLink
        href={tile.linkUrl}
        className="showcase-reel-link"
        label={tile.title}
      >
        {tile.mediaType === "video" ? (
          <video
            ref={video}
            src={tile.mediaUrl ?? undefined}
            muted={muted}
            loop
            playsInline
            autoPlay={!reduced}
            preload="metadata"
          />
        ) : (
          <img src={tile.mediaUrl ?? undefined} alt="" loading="eager" />
        )}
        <span className="showcase-reel-text">
          {tile.subtitle && <small>{tile.subtitle}</small>}
          <strong>{tile.title}</strong>
        </span>
      </TileLink>
      {tile.mediaType === "video" && (
        <div className="showcase-reel-controls">
          <button
            type="button"
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? "Pausar video" : "Reproducir video"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setMuted(m => !m)}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "stores" | "products";
  children: React.ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = () => {
    const el = track.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  };
  useEffect(() => {
    update();
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const move = (dir: 1 | -1) =>
    track.current?.scrollBy({
      left: dir * track.current.clientWidth * 0.85,
      behavior: "smooth",
    });
  return (
    <div className={`showcase-row showcase-row--${tone}`}>
      <h2>{title}</h2>
      <div className="showcase-track-wrap">
        {!edges.start && (
          <button
            type="button"
            className="showcase-arrow showcase-arrow--left"
            onClick={() => move(-1)}
            aria-label={`Ver anteriores: ${title}`}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="showcase-track" ref={track} onScroll={update}>
          {children}
        </div>
        {!edges.end && (
          <button
            type="button"
            className="showcase-arrow showcase-arrow--right"
            onClick={() => move(1)}
            aria-label={`Ver más: ${title}`}
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
}

const TONES = ["#0b2a4a", "#b8862b", "#2e6b3a", "#6d3fa0", "#c23a3a"];

function StoreTile({ tile, index }: { tile: ShowcaseTile; index: number }) {
  const name = tile.store?.name ?? tile.title;
  return (
    <TileLink
      href={tile.linkUrl}
      className="showcase-store"
      label={`${tile.title}${tile.store ? ` · ${tile.store.name}` : ""}`}
    >
      <span
        className="showcase-store-media"
        style={{ background: TONES[index % TONES.length] }}
      >
        {tile.mediaUrl ? (
          tile.mediaType === "video" ? (
            <video
              src={tile.mediaUrl}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
            />
          ) : (
            <img src={tile.mediaUrl} alt="" loading="lazy" />
          )
        ) : (
          <StoreLogo
            name={name}
            logoUrl={tile.store?.logoUrl}
            size={96}
            className="showcase-store-logo"
          />
        )}
      </span>
      <span className="showcase-store-text">
        {tile.subtitle && <small>{tile.subtitle}</small>}
        <strong>{tile.title}</strong>
        {tile.store && tile.store.name !== tile.title && (
          <em>{tile.store.name}</em>
        )}
      </span>
    </TileLink>
  );
}

function ProductCard({ tile }: { tile: ShowcaseTile }) {
  return (
    <TileLink
      href={tile.linkUrl}
      className="showcase-product"
      label={tile.title}
    >
      <strong>{tile.title}</strong>
      <small>{tile.subtitle || "Promocionado"}</small>
      <span className="showcase-product-media">
        {tile.mediaUrl ? (
          tile.mediaType === "video" ? (
            <video
              src={tile.mediaUrl}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
            />
          ) : (
            <img src={tile.mediaUrl} alt="" loading="lazy" />
          )
        ) : tile.store ? (
          <StoreLogo
            name={tile.store.name}
            logoUrl={tile.store.logoUrl}
            size={80}
          />
        ) : null}
      </span>
    </TileLink>
  );
}
