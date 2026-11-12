import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { normalizeStoreLink, STORE_LINK_MAX } from "@shared/storeLink";
import { trpc } from "@/lib/trpc";
import "./storeBranding.css";

/** Web o Instagram del negocio: el nombre de la tienda lleva a este enlace. */
export function StoreLinkEditor() {
  const utils = trpc.useUtils();
  const mine = trpc.storeLink.mine.useQuery();
  const save = trpc.storeLink.save.useMutation();
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (mine.data) setUrl(mine.data.url);
  }, [mine.data]);

  if (!mine.data?.hasStore) return null;
  const preview = url.trim() ? normalizeStoreLink(url) : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const saved = await save.mutateAsync({ url: url.trim() });
      setUrl(saved.url);
      await Promise.all([
        utils.storeLink.mine.invalidate(),
        utils.storeLink.forSlug.invalidate(),
      ]);
      toast.success(saved.url ? "Enlace guardado" : "Enlace quitado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ocurrió un error");
    }
  }

  return (
    <section className="brand-editor" aria-labelledby="store-link-title">
      <h3 id="store-link-title">
        <Globe size={18} aria-hidden="true" /> Web o Instagram de tu negocio
      </h3>
      <p className="brand-muted">
        Cuando alguien toque el nombre de tu negocio en tus servicios, se abrirá
        este enlace. Puedes escribir tu página (tunegocio.com) o tu Instagram
        (@tuinstagram).
      </p>
      <form className="brand-form" onSubmit={submit}>
        <label>
          Enlace
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            maxLength={STORE_LINK_MAX}
            placeholder="https://tunegocio.com o @tuinstagram"
            value={url}
            onChange={e => setUrl(e.target.value)}
            aria-invalid={preview === null}
          />
        </label>
        {preview === null && (
          <p className="brand-muted" role="alert">
            Esa dirección no es válida. Ejemplo: https://tunegocio.com o
            @tuinstagram
          </p>
        )}
        {preview && <p className="brand-muted">Abrirá: {preview}</p>}
        <button
          type="submit"
          className="btn btn-gold"
          disabled={save.isPending || preview === null}
        >
          {save.isPending ? "Guardando…" : "Guardar enlace"}
        </button>
      </form>
    </section>
  );
}
