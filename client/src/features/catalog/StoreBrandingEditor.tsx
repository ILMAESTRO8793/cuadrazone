import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { BadgeCheck, ImagePlus, Lock, Palette } from "lucide-react";
import { toast } from "sonner";
import {
  BRAND_BADGE_LABEL,
  brandColorPresets,
  readableTextOn,
} from "@shared/branding";
import { trpc } from "@/lib/trpc";
import "./storeBranding.css";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

/** Portada, lema y color de la tienda (beneficio de Mayor Visibilidad). */
export function StoreBrandingEditor({ storeName }: { storeName: string }) {
  const utils = trpc.useUtils();
  const mine = trpc.branding.mine.useQuery();
  const save = trpc.branding.save.useMutation();
  const [tagline, setTagline] = useState("");
  const [color, setColor] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mine.data) {
      setTagline(mine.data.tagline);
      setColor(mine.data.brandColor);
    }
  }, [mine.data]);

  const d = mine.data;
  if (!d || !d.hasStore) return null;

  if (!d.eligible)
    return (
      <section
        className="brand-editor brand-editor--locked"
        aria-labelledby="brand-title"
      >
        <Lock size={20} aria-hidden="true" />
        <div>
          <h3 id="brand-title">Tu marca: insignia, portada, lema y color</h3>
          <p>
            Con el plan Mayor Visibilidad tu tienda lleva la insignia «
            {BRAND_BADGE_LABEL}», una foto de portada, un lema debajo del nombre
            y tu propio color.
          </p>
          <Link
            href="/vendedor/plan?plan=mayor_visibilidad"
            className="btn btn-gold"
          >
            Ver Mayor Visibilidad
          </Link>
        </div>
      </section>
    );

  async function refresh() {
    await Promise.all([
      utils.branding.mine.invalidate(),
      utils.branding.forStores.invalidate(),
    ]);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ tagline, brandColor: color });
      await refresh();
      toast.success("Marca guardada");
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  async function sendCover(method: "POST" | "DELETE", f?: File) {
    setBusy(true);
    try {
      const r = await fetch("/api/stores/mine/cover", {
        method,
        credentials: "include",
        headers: {
          "x-cz-request": "1",
          ...(f ? { "Content-Type": f.type } : {}),
        },
        body: f,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No se pudo guardar la portada");
      await refresh();
      toast.success(method === "POST" ? "Portada guardada" : "Portada quitada");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const preview = color || "#0b2a4a";
  return (
    <section className="brand-editor" aria-labelledby="brand-title">
      <div className="brand-editor-head">
        <h3 id="brand-title">
          <Palette size={18} aria-hidden="true" /> Tu marca
        </h3>
        <span
          className="brand-badge"
          style={{ background: preview, color: readableTextOn(preview) }}
        >
          <BadgeCheck size={14} aria-hidden="true" /> {BRAND_BADGE_LABEL}
        </span>
      </div>
      <p className="brand-muted">
        Parte de Mayor Visibilidad. Se ve en tu tienda, en el directorio y en
        tus productos mientras tu plan esté vigente.
      </p>

      <div
        className="brand-preview"
        style={{
          borderColor: preview,
          backgroundImage: d.coverUrl
            ? `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.55)), url(${d.coverUrl})`
            : undefined,
          backgroundColor: d.coverUrl ? undefined : preview,
        }}
      >
        <strong style={{ color: "#fff" }}>{storeName}</strong>
        {tagline && <span style={{ color: "#fff" }}>{tagline}</span>}
      </div>

      <div className="brand-cover-actions">
        <label className="btn btn-outline">
          <ImagePlus size={16} aria-hidden="true" />{" "}
          {busy
            ? "Subiendo…"
            : d.coverUrl
              ? "Cambiar portada"
              : "Subir portada"}
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            hidden
            onChange={e =>
              e.target.files?.[0] && void sendCover("POST", e.target.files[0])
            }
          />
        </label>
        {d.coverUrl && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => void sendCover("DELETE")}
          >
            Quitar portada
          </button>
        )}
        <small className="brand-muted">
          Foto horizontal, por ejemplo 1600 × 500. PNG, JPEG o WEBP hasta 5 MB.
        </small>
      </div>

      <form className="brand-form" onSubmit={submit}>
        <label>
          Lema (opcional)
          <input
            value={tagline}
            maxLength={90}
            onChange={e => setTagline(e.target.value)}
            placeholder="Ej.: Repostería artesanal desde 2015"
          />
        </label>
        <fieldset>
          <legend>Color de tu marca</legend>
          <div className="brand-swatches">
            {brandColorPresets.map(c => (
              <button
                key={c}
                type="button"
                className={color === c ? "is-on" : ""}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
              />
            ))}
            <label className="brand-custom">
              Otro
              <input
                type="color"
                value={color || "#0b2a4a"}
                onChange={e => setColor(e.target.value)}
              />
            </label>
            {color && (
              <button
                type="button"
                className="brand-clear"
                onClick={() => setColor("")}
              >
                Sin color
              </button>
            )}
          </div>
        </fieldset>
        <button
          className="btn btn-gold"
          type="submit"
          disabled={save.isPending}
        >
          {save.isPending ? "Guardando…" : "Guardar marca"}
        </button>
      </form>
    </section>
  );
}
