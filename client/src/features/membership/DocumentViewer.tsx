import { authFetch } from "@/lib/authFetch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DocumentSnapshot } from "@shared/membership";
import { Eye, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function readableError(response: Response) {
  if (response.status === 401) return "Tu sesión expiró. Inicia sesión nuevamente.";
  if (response.status === 403) return "No tienes permiso para ver este documento.";
  return `No se pudo abrir el documento (HTTP ${response.status}).`;
}

export function DocumentViewer({ document }: { document: DocumentSnapshot }) {
  const [open, setOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setObjectUrl(previous => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    void authFetch(`/api/verification/documents/${document.id}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(readableError(response));
        const blob = await response.blob();
        if (!active) return;
        setObjectUrl(previous => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(blob);
        });
      })
      .catch(reason => {
        if (!active || reason?.name === "AbortError") return;
        const message = reason instanceof Error ? reason.message : "No se pudo abrir el documento.";
        setError(message);
        toast.error("Documento no disponible", { description: message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
      setObjectUrl(previous => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    };
  }, [document.id, open]);

  const close = () => setOpen(false);
  const isImage = document.mimeType === "image/png" || document.mimeType === "image/jpeg" || document.mimeType === "image/webp";

  return (
    <>
      <button className="member-button member-button--small member-button--outline" type="button" onClick={() => setOpen(true)}>
        <Eye size={15} aria-hidden="true" /> Mostrar documento
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="member-document-dialog">
          <DialogTitle>Documento: {document.fileName}</DialogTitle>
          <DialogDescription>Vista privada para el titular de la solicitud o un administrador.</DialogDescription>
          <div className="member-document-viewer" aria-live="polite">
            {loading && <div className="member-viewer-state"><LoaderCircle className="member-spin" size={26} /> Cargando documento…</div>}
            {!loading && error && <div className="member-viewer-state member-viewer-state--error"><p>{error}</p><button className="member-button member-button--outline" type="button" onClick={close}>Cerrar</button></div>}
            {!loading && !error && objectUrl && isImage && <img className="member-document-image" src={objectUrl} alt={`Vista previa de ${document.fileName}`} />}
            {!loading && !error && objectUrl && !isImage && <><iframe className="member-document-pdf" title={`Vista previa de ${document.fileName}`} src={objectUrl} sandbox="" /><a className="member-inline-link member-download-link" href={objectUrl} download={document.fileName}>Descargar una copia</a></>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
