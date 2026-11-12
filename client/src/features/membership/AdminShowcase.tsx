import { useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  showcaseSectionLabels,
  showcaseSections,
  showcaseZoneLabels,
  showcaseZones,
  type AdminShowcaseItem,
  type ShowcaseSection,
  type ShowcaseZone,
} from "@shared/showcase";
import { trpc } from "@/lib/trpc";
import { StoreLogo } from "@/components/marketplace/StoreLogo";
import { PromoPicker } from "./PromoPicker";
import "./adminShowcase.css";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

type Draft = {
  id?: number;
  section: ShowcaseSection;
  zone: ShowcaseZone;
  title: string;
  subtitle: string;
  linkUrl: string;
  storeId: number | null;
  active: boolean;
  sortOrder: number;
  startsOn: string;
  endsOn: string;
  mediaUrl: string | null;
  mediaType: "image" | "video";
};
const empty = (zone: ShowcaseZone = "tienda"): Draft => ({
  section: "todas",
  zone,
  title: "",
  subtitle: "",
  linkUrl: "",
  storeId: null,
  active: true,
  sortOrder: 0,
  startsOn: "",
  endsOn: "",
  mediaUrl: null,
  mediaType: "image",
});
const fromItem = (i: AdminShowcaseItem): Draft => ({
  id: i.id,
  section: i.section,
  zone: i.zone,
  title: i.title,
  subtitle: i.subtitle,
  linkUrl: i.store && i.linkUrl === `/tiendas/${i.store.slug}` ? "" : i.linkUrl,
  storeId: i.storeId,
  active: i.active,
  sortOrder: i.sortOrder,
  startsOn: i.startsOn,
  endsOn: i.endsOn,
  mediaUrl: i.mediaUrl,
  mediaType: i.mediaType,
});

/** La vitrina estilo Amazon de cada sección: reel, tiendas destacadas y productos promocionados. */
export function AdminShowcase({ enabled }: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const list = trpc.showcase.adminList.useQuery(undefined, { enabled });
  const stores = trpc.adminDashboard.stores.useQuery(undefined, { enabled });
  const save = trpc.showcase.adminSave.useMutation();
  const remove = trpc.showcase.adminDelete.useMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<ShowcaseSection | "all">("all");
  const [uploading, setUploading] = useState(false);

  const refresh = () =>
    Promise.all([
      utils.showcase.adminList.invalidate(),
      utils.showcase.forSection.invalidate(),
    ]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft(d => (d ? { ...d, [k]: v } : d));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    try {
      const { mediaUrl, mediaType: _t, ...input } = draft;
      const saved = await save.mutateAsync({
        ...input,
        // Solo una foto escogida de una tienda o producto; lo subido ya está guardado.
        mediaUrl:
          mediaUrl?.startsWith("/media/catalog/") && !mediaUrl.startsWith("/media/catalog/showcase/")
            ? mediaUrl
            : undefined,
      });
      setDraft(d => (d ? { ...d, id: saved.id } : d));
      await refresh();
      toast.success(
        draft.id
          ? "Cambios guardados"
          : "Bloque creado. Ahora sube su foto o video."
      );
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  async function upload(file: File | undefined) {
    if (!draft?.id || !file) return;
    setUploading(true);
    try {
      const r = await fetch(`/api/admin/showcase/${draft.id}/media`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type, "x-cz-request": "1" },
        body: file,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No se pudo subir el archivo");
      set("mediaUrl", data.url);
      set("mediaType", file.type.startsWith("video/") ? "video" : "image");
      await refresh();
      toast.success("Archivo subido");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setUploading(false);
    }
  }
  async function del(item: AdminShowcaseItem) {
    if (
      !confirm(`¿Eliminar «${item.title}» de la vitrina? No se puede deshacer.`)
    )
      return;
    try {
      await remove.mutateAsync({ id: item.id });
      await refresh();
      toast.success("Bloque eliminado");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  const items = (list.data ?? []).filter(
    i => filter === "all" || i.section === filter
  );

  return (
    <section className="member-card as-wrap" aria-labelledby="as-title">
      <div className="as-head">
        <div>
          <h2 id="as-title">
            <Clapperboard size={20} /> Vitrina de las secciones
          </h2>
          <p className="member-muted">
            Sale arriba de Comercios, Servicios, Autos, Bienes raíces, Empleos y
            Eventos, como en Amazon: a la izquierda un reel o video grande, y a
            la derecha una fila de <strong>tiendas destacadas</strong> y otra de{" "}
            <strong>productos promocionados</strong>. Si una sección no tiene
            nada, no se muestra.
          </p>
        </div>
        <div className="as-new">
          {showcaseZones.map(z => (
            <button
              key={z}
              type="button"
              className="member-button member-button--gold"
              onClick={() => setDraft(empty(z))}
            >
              <Plus size={16} /> {showcaseZoneLabels[z]}
            </button>
          ))}
        </div>
      </div>

      {draft && (
        <form className="as-form" onSubmit={submit}>
          <h3>
            {draft.id
              ? "Editar bloque"
              : `Nuevo: ${showcaseZoneLabels[draft.zone].toLowerCase()}`}
          </h3>
          {draft.zone !== "reel" && (
            <PromoPicker
              key={draft.zone}
              initial={draft.zone === "tienda" ? "tiendas" : "items"}
              onPick={c =>
                setDraft(d =>
                  d
                    ? {
                        ...d,
                        storeId: c.storeId,
                        title: c.title.slice(0, 80),
                        subtitle: c.kind === "tienda" ? d.subtitle : c.subtitle.slice(0, 160),
                        linkUrl: c.kind === "tienda" ? "" : c.linkUrl,
                        ...(c.kind !== "tienda" && c.imageUrl
                          ? { mediaUrl: c.imageUrl, mediaType: "image" as const }
                          : {}),
                      }
                    : d
                )
              }
            />
          )}
          <div className="as-grid">
            <label>
              Tipo
              <select
                value={draft.zone}
                onChange={e => set("zone", e.target.value as ShowcaseZone)}
              >
                {showcaseZones.map(z => (
                  <option key={z} value={z}>
                    {showcaseZoneLabels[z]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dónde sale
              <select
                value={draft.section}
                onChange={e =>
                  set("section", e.target.value as ShowcaseSection)
                }
              >
                {showcaseSections.map(s => (
                  <option key={s} value={s}>
                    {showcaseSectionLabels[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tienda {draft.zone === "tienda" ? "" : "(opcional)"}
              <select
                value={draft.storeId ?? ""}
                onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  const st = stores.data?.find(s => s.id === id);
                  setDraft(d =>
                    d
                      ? { ...d, storeId: id, title: d.title || st?.name || "" }
                      : d
                  );
                }}
              >
                <option value="">Ninguna</option>
                {stores.data?.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Título
              <input
                value={draft.title}
                onChange={e => set("title", e.target.value)}
                maxLength={80}
                required
                placeholder={
                  draft.zone === "producto"
                    ? "Ej.: Tortas para Navidad"
                    : "Ej.: 20 % en toda la tienda"
                }
              />
            </label>
            <label>
              Texto pequeño (opcional)
              <input
                value={draft.subtitle}
                onChange={e => set("subtitle", e.target.value)}
                maxLength={160}
                placeholder="Ej.: Oferta de la semana"
              />
            </label>
            <label>
              Enlace (opcional)
              <input
                value={draft.linkUrl}
                onChange={e => set("linkUrl", e.target.value)}
                maxLength={300}
                placeholder={
                  draft.storeId
                    ? "Si lo dejas vacío, abre la tienda"
                    : "/producto/torta-de-chocolate"
                }
              />
            </label>
            <label>
              Orden
              <input
                type="number"
                min={0}
                max={9999}
                value={draft.sortOrder}
                onChange={e => set("sortOrder", Number(e.target.value))}
              />
            </label>
            <label>
              Desde (opcional)
              <input
                type="date"
                value={draft.startsOn}
                onChange={e => set("startsOn", e.target.value)}
              />
            </label>
            <label>
              Hasta (opcional)
              <input
                type="date"
                value={draft.endsOn}
                onChange={e => set("endsOn", e.target.value)}
              />
            </label>
          </div>
          <label className="as-check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={e => set("active", e.target.checked)}
            />{" "}
            Mostrar en la vitrina
          </label>
          <div className="as-media">
            <div className="as-preview">
              {draft.mediaUrl ? (
                draft.mediaType === "video" ? (
                  <video src={draft.mediaUrl} muted loop autoPlay playsInline />
                ) : (
                  <img src={draft.mediaUrl} alt="" />
                )
              ) : (
                <span>
                  {draft.zone === "reel"
                    ? "El reel necesita un video o una foto"
                    : "Sin foto: se usa el logo de la tienda"}
                </span>
              )}
            </div>
            {draft.id ? (
              <label className="as-upload">
                <Upload size={16} />{" "}
                {uploading
                  ? "Subiendo…"
                  : draft.mediaUrl
                    ? "Cambiar foto o video"
                    : "Subir foto o video"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  disabled={uploading}
                  onChange={e => void upload(e.target.files?.[0])}
                />
              </label>
            ) : (
              <p className="member-muted">
                Guarda primero; después subes la foto o el video.
              </p>
            )}
            <small className="member-muted">
              Foto JPG, PNG o WEBP hasta 5 MB · video MP4, WEBM o MOV hasta 40
              MB. Para el reel, mejor vertical (por ejemplo 1080 × 1350).
            </small>
          </div>
          <div className="as-actions">
            <button
              type="submit"
              className="member-button member-button--gold"
              disabled={save.isPending}
            >
              {save.isPending
                ? "Guardando…"
                : draft.id
                  ? "Guardar cambios"
                  : "Crear bloque"}
            </button>
            <button
              type="button"
              className="member-button"
              onClick={() => setDraft(null)}
            >
              Cerrar
            </button>
          </div>
        </form>
      )}

      <div className="as-filter">
        <label>
          Ver
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">Todas las secciones</option>
            {showcaseSections.map(s => (
              <option key={s} value={s}>
                {showcaseSectionLabels[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.data && items.length === 0 && (
        <p className="as-empty">
          Todavía no hay bloques. Empieza con un reel y algunas tiendas
          destacadas.
        </p>
      )}
      <ul className="as-list">
        {items.map(i => (
          <li key={i.id} className={i.active ? "" : "is-off"}>
            <div className="as-thumb">
              {i.mediaUrl ? (
                i.mediaType === "video" ? (
                  <video src={i.mediaUrl} muted />
                ) : (
                  <img src={i.mediaUrl} alt="" />
                )
              ) : i.store ? (
                <StoreLogo
                  name={i.store.name}
                  logoUrl={i.store.logoUrl}
                  size={44}
                />
              ) : (
                <span>Sin foto</span>
              )}
            </div>
            <div>
              <strong>{i.title}</strong>
              <small>
                {showcaseZoneLabels[i.zone]} ·{" "}
                {showcaseSectionLabels[i.section]}
                {i.store ? ` · ${i.store.name}` : ""}
                {i.active ? "" : " · oculto"}
                {i.endsOn ? ` · hasta ${i.endsOn}` : ""}
              </small>
            </div>
            <div className="as-row-actions">
              <button
                type="button"
                className="member-button"
                onClick={() => setDraft(fromItem(i))}
                aria-label={`Editar ${i.title}`}
              >
                <Pencil size={15} /> Editar
              </button>
              <button
                type="button"
                className="member-button as-danger"
                disabled={remove.isPending}
                onClick={() => void del(i)}
                aria-label={`Eliminar ${i.title}`}
              >
                <Trash2 size={15} /> Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
