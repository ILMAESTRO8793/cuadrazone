import { useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** Eliminar la tienda por completo y para siempre (con confirmación escribiendo su nombre). */
export function DeleteStoreSection() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const check = trpc.services.deletionCheck.useQuery(undefined, { refetchOnWindowFocus: false });
  const remove = trpc.services.deleteStore.useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [understood, setUnderstood] = useState(false);
  const data = check.data;
  if (!data?.hasStore) return null;
  const blocked = data.blockers.length > 0;
  const matches = name.trim().replace(/\s+/g, " ").toLowerCase() === data.storeName.trim().replace(/\s+/g, " ").toLowerCase();

  async function confirm() {
    try {
      await remove.mutateAsync({ confirmName: name });
      await utils.invalidate();
      toast.success("Tu tienda fue eliminada para siempre.");
      navigate("/mi-cuenta");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la tienda");
    }
  }

  return (
    <section className="danger-zone" aria-labelledby="danger-title">
      <h2 id="danger-title"><AlertTriangle size={20} aria-hidden="true" /> Zona de peligro</h2>
      {!open ? (
        <div className="danger-row">
          <p>Eliminar tu tienda borra todo su contenido para siempre. No se puede deshacer.</p>
          <button type="button" className="danger-button" onClick={() => setOpen(true)}>Eliminar mi tienda</button>
        </div>
      ) : (
        <div className="danger-box">
          <p><strong>Se borrará para siempre, sin forma de recuperarlo:</strong></p>
          <ul>
            <li>Tu tienda «{data.storeName}», su información y sus datos de pago.</li>
            <li>
              {[
                data.products ? `${data.products} ${data.products === 1 ? "producto" : "productos"}` : "",
                data.services ? `${data.services} ${data.services === 1 ? "servicio" : "servicios"}` : "",
              ].filter(Boolean).join(" y ") || "Todas tus publicaciones"}
              , con todas sus fotos y videos.
            </li>
            <li>Reseñas, preguntas, conversaciones y solicitudes de tus clientes.</li>
            <li>Tu solicitud de vendedor y los documentos que subiste (cédula y captura de Yappy o banco).</li>
          </ul>
          <p><strong>Se conserva:</strong> tu cuenta para comprar, tus anuncios de bienes raíces, autos y empleos, y {data.pastOrders ? `tus ${data.pastOrders} ventas pasadas como «Tienda eliminada», sin tus datos, para tus clientes y la contabilidad` : "nada más"}. Si quieres vender de nuevo, podrás abrir una tienda nueva desde cero.</p>
          {blocked ? (
            <div className="danger-blocked" role="alert">
              <strong>Todavía no puedes eliminarla:</strong>
              <ul>{data.blockers.map(b => <li key={b}>{b}</li>)}</ul>
            </div>
          ) : (
            <>
              <label className="danger-label">
                Para confirmar, escribe el nombre de tu tienda: <b>{data.storeName}</b>
                <input value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
              </label>
              <label className="danger-check">
                <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} />
                Entiendo que esto es permanente y que no podré recuperar ningún dato, foto ni video.
              </label>
            </>
          )}
          <div className="danger-actions">
            <button type="button" className="seller-catalog-button" onClick={() => { setOpen(false); setName(""); setUnderstood(false); }}>Cancelar</button>
            <button type="button" className="danger-button" disabled={blocked || !matches || !understood || remove.isPending} onClick={() => void confirm()}>
              {remove.isPending ? "Eliminando…" : "Eliminar mi tienda para siempre"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
