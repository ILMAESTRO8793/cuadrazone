import { useRef, useState } from "react";
import { toast } from "sonner";
import { StoreLogo } from "@/components/marketplace/StoreLogo";
import { trpc } from "@/lib/trpc";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** El vendedor sube o quita el logo de su tienda (se ve en un círculo). */
export function StoreLogoUploader({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  const utils = trpc.useUtils();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const send = async (method: "POST" | "DELETE", file?: File) => {
    setBusy(true);
    try {
      const response = await fetch("/api/stores/mine/logo", {
        method,
        credentials: "include",
        headers: {
          "x-cz-request": "1",
          ...(file ? { "Content-Type": file.type } : {}),
        },
        body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error ?? "No se pudo guardar el logo");
      await utils.catalog.myStore.invalidate();
      toast.success(file ? "Logo actualizado" : "Logo quitado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el logo"
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type))
      return toast.error("El logo debe ser una imagen PNG, JPEG o WEBP");
    if (file.size > MAX_BYTES) return toast.error("El logo supera 5 MB");
    void send("POST", file);
  };

  return (
    <div className="store-logo-uploader">
      <StoreLogo name={name || "Tienda"} logoUrl={logoUrl} size={72} />
      <div>
        <strong>Logo de la tienda</strong>
        <p>
          Imagen cuadrada (por ejemplo 400 × 400), PNG, JPG o WEBP. Se ve en tu
          tienda y junto a tus productos.
        </p>
        <div className="store-logo-actions">
          <button
            type="button"
            className="seller-catalog-button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "Guardando…" : logoUrl ? "Cambiar logo" : "Subir logo"}
          </button>
          {logoUrl && (
            <button
              type="button"
              className="store-logo-remove"
              disabled={busy}
              onClick={() => void send("DELETE")}
            >
              Quitar
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={event => pick(event.target.files?.[0])}
        />
      </div>
    </div>
  );
}
