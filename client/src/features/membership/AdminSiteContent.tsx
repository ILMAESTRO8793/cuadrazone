import { useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  ImagePlus,
  LayoutTemplate,
  Tags,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  MAX_ACTIVE_BANNERS,
  type AdminBannerDTO,
  type AdminCategoryDTO,
} from "@shared/siteContent";
import { trpc } from "@/lib/trpc";
import { PromoPicker } from "./PromoPicker";
import "./adminPanels.css";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

type BannerDraft = {
  id?: number;
  title: string;
  subtitle: string;
  linkUrl: string;
  active: boolean;
  sortOrder: number;
  startsOn: string;
  endsOn: string;
  /** Foto tomada de una tienda, producto o servicio escogido. */
  imageUrl?: string;
};
const emptyBanner: BannerDraft = {
  title: "",
  subtitle: "",
  linkUrl: "",
  active: false,
  sortOrder: 0,
  startsOn: "",
  endsOn: "",
};

/** Etapa 6 · Portada: banners del inicio y categorías de productos. */
export function AdminSiteContent({ enabled }: { enabled: boolean }) {
  return (
    <div className="ap2-stack">
      <BannerManager enabled={enabled} />
      <CategoryManager enabled={enabled} />
    </div>
  );
}

// ───────────── Banners ─────────────

function BannerManager({ enabled }: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const list = trpc.adminPanel.banners.useQuery(undefined, { enabled });
  const save = trpc.adminPanel.saveBanner.useMutation();
  const remove = trpc.adminPanel.deleteBanner.useMutation();
  const [draft, setDraft] = useState<BannerDraft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"escoger" | "personalizado">("escoger");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    void list.refetch();
    void utils.catalog.banners.invalidate();
  };

  async function upload(id: number, f: File) {
    setUploading(true);
    try {
      const r = await fetch(`/api/admin/banners/${id}/image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": f.type, "x-cz-request": "1" },
        body: f,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "No se pudo subir la foto");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    try {
      if (draft.id === undefined && !file && !draft.imageUrl)
        throw new Error(
          mode === "escoger"
            ? "Escoge una tienda, un producto o un servicio"
            : "Agrega la foto del banner"
        );
      const { id } = await save.mutateAsync(draft);
      if (file) await upload(id, file);
      toast.success("Banner guardado");
      setDraft(null);
      setFile(null);
      refresh();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  function edit(b: AdminBannerDTO) {
    setFile(null);
    setDraft({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      linkUrl: b.linkUrl,
      active: b.active,
      sortOrder: b.sortOrder,
      startsOn: b.startsOn,
      endsOn: b.endsOn,
    });
  }

  async function toggle(b: AdminBannerDTO) {
    try {
      await save.mutateAsync({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        linkUrl: b.linkUrl,
        active: !b.active,
        sortOrder: b.sortOrder,
        startsOn: b.startsOn,
        endsOn: b.endsOn,
      });
      refresh();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function destroy(b: AdminBannerDTO) {
    if (
      !window.confirm(`¿Borrar el banner «${b.title}»? No se puede deshacer.`)
    )
      return;
    try {
      await remove.mutateAsync({ id: b.id });
      toast.success("Banner borrado");
      refresh();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  const live = list.data?.filter(b => b.live).length ?? 0;
  const set = <K extends keyof BannerDraft>(k: K, v: BannerDraft[K]) =>
    setDraft(d => (d ? { ...d, [k]: v } : d));

  return (
    <section className="ap2-section">
      <div className="ap2-head">
        <h2>
          <LayoutTemplate size={20} /> Banners de la portada
        </h2>
        {!draft && (
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => {
              setFile(null);
              setMode("escoger");
              setDraft({ ...emptyBanner });
            }}
          >
            <ImagePlus size={16} /> Nuevo banner
          </button>
        )}
      </div>
      <p className="re-muted re-small">
        Se muestran en el inicio, debajo de las entradas principales, en el
        orden que indiques. Se ven hasta {MAX_ACTIVE_BANNERS} a la vez. Foto
        horizontal (por ejemplo, 1600 × 600), JPG, PNG o WebP de hasta 5 MB.
        Ahora mismo se ven {live}.
      </p>

      {draft && (
        <form className="ap2-form ap2-banner-form" onSubmit={submit}>
          <h3>{draft.id ? "Editar banner" : "Nuevo banner"}</h3>
          <div className="ap2-mode" role="tablist" aria-label="Tipo de banner">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "escoger"}
              className={mode === "escoger" ? "is-active" : ""}
              onClick={() => setMode("escoger")}
            >
              Escoger tienda, producto o servicio
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "personalizado"}
              className={mode === "personalizado" ? "is-active" : ""}
              onClick={() => setMode("personalizado")}
            >
              Personalizado (Service Pub)
            </button>
          </div>
          {mode === "escoger" ? (
            <PromoPicker
              onPick={c =>
                setDraft(d =>
                  d
                    ? {
                        ...d,
                        title: c.title.slice(0, 80),
                        subtitle: c.kind === "tienda" ? "Tienda destacada" : c.subtitle.slice(0, 160),
                        linkUrl: c.linkUrl,
                        imageUrl: c.imageUrl?.startsWith("/media/catalog/") ? c.imageUrl : undefined,
                      }
                    : d
                )
              }
            />
          ) : (
            <p className="re-muted re-small ap2-mode-note">
              Banner hecho a la medida: tú subes el diseño. Es el servicio
              Service Pub de US$10 al mes que el vendedor pide desde «Mi plan».
            </p>
          )}
          {draft.imageUrl && !file && (
            <div className="ap2-picked">
              <img src={draft.imageUrl} alt="" />
              <span>Se usará esta foto. Puedes subir otra abajo si prefieres.</span>
            </div>
          )}
          <label>
            Título
            <input
              value={draft.title}
              onChange={e => set("title", e.target.value)}
              maxLength={80}
              required
              placeholder="Ej. Feria de emprendedores de diciembre"
            />
          </label>
          <label>
            Texto corto (opcional)
            <input
              value={draft.subtitle}
              onChange={e => set("subtitle", e.target.value)}
              maxLength={160}
            />
          </label>
          <label>
            Enlace al tocarlo (opcional)
            <input
              value={draft.linkUrl}
              onChange={e => set("linkUrl", e.target.value)}
              maxLength={300}
              placeholder="/eventos o https://…"
            />
          </label>
          <div className="ap2-row">
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
            <label>
              Orden
              <input
                type="number"
                min={0}
                max={9999}
                value={draft.sortOrder}
                onChange={e => set("sortOrder", Number(e.target.value) || 0)}
              />
            </label>
          </div>
          <label>
            Foto {draft.id ? "(solo si quieres cambiarla)" : ""}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="ap2-check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={e => set("active", e.target.checked)}
            />
            Mostrar en la portada
          </label>
          <div className="ap2-actions">
            <button
              className="btn btn-gold"
              type="submit"
              disabled={save.isPending || uploading}
            >
              {save.isPending || uploading ? "Guardando…" : "Guardar banner"}
            </button>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setDraft(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {list.isLoading && <p role="status">Cargando banners…</p>}
      {list.error && <p className="member-error">{list.error.message}</p>}
      {list.data?.length === 0 && !draft && (
        <p className="ap2-empty">
          Todavía no hay banners. La portada se ve igual que hoy hasta que
          agregues uno.
        </p>
      )}
      <div className="ap2-banners">
        {list.data?.map(b => (
          <article
            key={b.id}
            className={`ap2-banner ${b.live ? "is-live" : ""}`}
          >
            <div className="ap2-banner-img">
              {b.imageUrl ? (
                <img src={b.imageUrl} alt="" loading="lazy" />
              ) : (
                <span>Sin foto</span>
              )}
            </div>
            <div className="ap2-banner-body">
              <strong>{b.title}</strong>
              {b.subtitle && <span>{b.subtitle}</span>}
              <small>
                {b.live
                  ? "Visible ahora"
                  : !b.active
                    ? "Oculto"
                    : !b.imageUrl
                      ? "Falta la foto"
                      : "Fuera de fechas"}
                {" · orden "}
                {b.sortOrder}
                {b.startsOn || b.endsOn
                  ? ` · ${b.startsOn || "…"} a ${b.endsOn || "…"}`
                  : ""}
                {b.linkUrl ? ` · ${b.linkUrl}` : ""}
              </small>
            </div>
            <div className="ap2-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => edit(b)}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void toggle(b)}
                disabled={save.isPending}
              >
                {b.active ? <EyeOff size={15} /> : <Eye size={15} />}
                {b.active ? " Ocultar" : " Mostrar"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void destroy(b)}
                disabled={remove.isPending}
                aria-label={`Borrar ${b.title}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ───────────── Categorías ─────────────

function CategoryManager({ enabled }: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const list = trpc.adminPanel.categories.useQuery(undefined, { enabled });
  const save = trpc.adminPanel.saveCategory.useMutation();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Record<number, string>>({});

  const refresh = () => {
    void list.refetch();
    void utils.catalog.categories.invalidate();
  };

  async function persist(
    c: AdminCategoryDTO,
    patch: Partial<AdminCategoryDTO>
  ) {
    const next = { ...c, ...patch };
    if (
      patch.name !== undefined &&
      patch.name !== c.name &&
      c.products > 0 &&
      !window.confirm(
        `Cambiar «${c.name}» por «${patch.name}» también mueve sus ${c.products} productos. ¿Seguir?`
      )
    )
      return;
    try {
      const r = await save.mutateAsync({
        id: c.id,
        name: next.name,
        active: next.active,
        sortOrder: next.sortOrder,
      });
      if (r.renamed)
        toast.success(
          `Categoría renombrada · ${r.renamed} productos actualizados`
        );
      setEditing(x => {
        const { [c.id]: _, ...rest } = x;
        return rest;
      });
      refresh();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const sortOrder =
      Math.max(0, ...(list.data ?? []).map(c => c.sortOrder)) + 10;
    try {
      await save.mutateAsync({
        name,
        active: true,
        sortOrder: Math.min(sortOrder, 9999),
      });
      toast.success("Categoría agregada");
      setName("");
      refresh();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <section className="ap2-section">
      <div className="ap2-head">
        <h2>
          <Tags size={20} /> Categorías de productos
        </h2>
      </div>
      <p className="re-muted re-small">
        Son las que eligen los vendedores al publicar y las del filtro del
        Mercado. Ocultar una no borra nada: los productos que ya la usan la
        conservan, pero nadie nuevo la puede escoger.
      </p>
      <form className="ap2-search" onSubmit={add}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          minLength={2}
          maxLength={120}
          required
          placeholder="Nueva categoría, p. ej. Jardinería"
          aria-label="Nombre de la nueva categoría"
        />
        <button
          className="btn btn-gold"
          type="submit"
          disabled={save.isPending}
        >
          Agregar
        </button>
      </form>
      {list.isLoading && <p role="status">Cargando categorías…</p>}
      {list.error && <p className="member-error">{list.error.message}</p>}
      <ul className="ap2-categories">
        {list.data?.map(c => {
          const value = editing[c.id];
          return (
            <li key={c.id} className={c.active ? "" : "is-hidden"}>
              {value === undefined ? (
                <span className="ap2-cat-name">
                  {c.name}
                  <small>
                    {c.products} {c.products === 1 ? "producto" : "productos"}
                    {c.active ? "" : " · oculta"}
                  </small>
                </span>
              ) : (
                <input
                  value={value}
                  onChange={e =>
                    setEditing(x => ({ ...x, [c.id]: e.target.value }))
                  }
                  maxLength={120}
                  aria-label={`Nuevo nombre de ${c.name}`}
                  autoFocus
                />
              )}
              <input
                type="number"
                className="ap2-order"
                min={0}
                max={9999}
                defaultValue={c.sortOrder}
                aria-label={`Orden de ${c.name}`}
                onBlur={e => {
                  const n = Number(e.target.value) || 0;
                  if (n !== c.sortOrder) void persist(c, { sortOrder: n });
                }}
              />
              <div className="ap2-actions">
                {value === undefined ? (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setEditing(x => ({ ...x, [c.id]: c.name }))}
                  >
                    Renombrar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-gold"
                      disabled={save.isPending || value.trim().length < 2}
                      onClick={() => void persist(c, { name: value.trim() })}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() =>
                        setEditing(x => {
                          const { [c.id]: _, ...rest } = x;
                          return rest;
                        })
                      }
                    >
                      Cancelar
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={save.isPending}
                  onClick={() => void persist(c, { active: !c.active })}
                >
                  {c.active ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
