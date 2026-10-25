import { getSellerPlan, sellerPlanLabel } from "@shared/pricing";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AdminSubscriptions } from "./AdminSubscriptions";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight, Church, FileCheck2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { CONSENT_VERSION, applicationStatuses, statusLabels, type ApplicationStatus } from "@shared/membership";
import { businessSelectionLabels } from "@shared/businessCategories";
import { AuthGate } from "./AuthGate";
import { DocumentViewer } from "./DocumentViewer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AdminVerificationPage({ initialTab = "solicitudes" }: { initialTab?: "solicitudes" | "suscripciones" | "denominaciones" }) {
  const auth = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [status, setStatus] = useState<"all" | ApplicationStatus>("pending");
  const [cursor, setCursor] = useState<number>();
  const [selected, setSelected] = useState<number>();
  const enabled = !auth.loading && auth.user?.role === "admin";
  const queue = trpc.membership.admin.list.useQuery({ status, cursor, limit: 25 }, { enabled });
  return <AuthGate requireAdmin><div className="member-page container admin-page">
    <div className="admin-heading"><div><p className="eyebrow">Administración · Acceso protegido</p><h1>Verificación de vendedores</h1><p>Revisa evidencias reales. La aprobación nunca sustituye la primera mensualidad.</p></div><ShieldCheck size={40} /></div>
    <div className="admin-tabs" role="group" aria-label="Secciones de administración"><button className={tab === "solicitudes" ? "active" : ""} onClick={() => setTab("solicitudes")}>Solicitudes</button><button className={tab === "suscripciones" ? "active" : ""} onClick={() => setTab("suscripciones")}>Suscripciones</button><button className={tab === "denominaciones" ? "active" : ""} onClick={() => setTab("denominaciones")}>Denominaciones</button><Link href="/mi-cuenta">Mi cuenta</Link></div>
    <p className="member-notice">CuadraZone está abierto a vendedores cristianos y no cristianos: todos aceptan los valores cristianos de la plataforma. La iglesia y el pastor son opcionales. El correo se verifica con Google y el teléfono lo confirmas tú por llamada o WhatsApp. No se puede aprobar sin ambos verificados.</p>
    {tab === "suscripciones" ? <AdminSubscriptions enabled={enabled} /> : tab === "denominaciones" ? <DenominationManager enabled={enabled} /> : <div className="admin-columns">
      <section className="member-card admin-queue"><div className="admin-list-heading"><h2>Cola de solicitudes</h2><label>Estado<select value={status} onChange={e => { setStatus(e.target.value as typeof status); setCursor(undefined); setSelected(undefined); }}><option value="all">Todos</option>{applicationStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label></div>
        {queue.isLoading && <p role="status">Consultando solicitudes…</p>}
        {queue.error && <p className="member-error" role="alert">{queue.error.message} <button onClick={() => queue.refetch()}>Reintentar</button></p>}
        {!queue.isLoading && !queue.error && !queue.data?.items.length && <div className="admin-empty"><FileCheck2 size={32} /><h3>No hay solicitudes en este estado</h3><p>Los borradores y solicitudes reales aparecerán aquí. No se han añadido vendedores ficticios.</p></div>}
        <div className="admin-entries">{queue.data?.items.map(item => <button key={item.id} className={`admin-entry ${selected === item.id ? "selected" : ""}`} onClick={() => setSelected(item.id)}><span><strong>{item.displayName || `Solicitud #${item.id}`}</strong><small>{[item.churchName, item.province].filter(Boolean).join(" · ")}</small><small>{statusLabels[item.status]}</small></span><ArrowRight size={18} /></button>)}</div>
        {(cursor || queue.data?.nextCursor) && <div className="admin-pagination"><button className="btn btn-outline" disabled={!cursor} onClick={() => setCursor(undefined)}>Primera página</button><button className="btn btn-outline" disabled={!queue.data?.nextCursor} onClick={() => { setCursor(queue.data?.nextCursor ?? undefined); setSelected(undefined); }}>Siguiente</button></div>}
      </section>
      {selected ? <ReviewDetail key={selected} id={selected} enabled={enabled} onReviewed={() => queue.refetch()} /> : <section className="member-card admin-empty"><ShieldCheck size={40} /><h2>Selecciona una solicitud</h2><p>Los documentos solo están disponibles para su solicitante y administradores autenticados.</p></section>}
    </div>}
  </div></AuthGate>;
}

function ReviewDetail({ id, enabled, onReviewed }: { id: number; enabled: boolean; onReviewed: () => unknown }) {
  const detail = trpc.membership.admin.detail.useQuery({ id }, { enabled });
  const [reason, setReason] = useState("");
  const [documentsReviewed, setDocumentsReviewed] = useState(false);
  const [confirmation, setConfirmation] = useState<"approved" | "rejected" | null>(null);
  const review = trpc.membership.admin.review.useMutation();
  const d = detail.data;
  const app = d?.application;
  const canApprove = Boolean(app?.status === "pending" && app.consentVersion === CONSENT_VERSION && d?.profile?.emailVerifiedAt && d?.profile?.phoneVerifiedAt && documentsReviewed && d?.documents.some(v => v.kind === "identity"));
  async function confirmReview() {
    if (!app || !confirmation) return;
    try { await review.mutateAsync({ id, revision: app.revision, decision: confirmation, reason: reason.trim(), documentsReviewed }); setConfirmation(null); await detail.refetch(); onReviewed(); toast.success("Decisión registrada"); } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar la decisión"); }
  }
  if (detail.isLoading) return <section className="member-card" role="status">Cargando expediente…</section>;
  if (detail.error) return <section className="member-card member-error" role="alert">{detail.error.message}<button onClick={() => detail.refetch()}>Reintentar</button></section>;
  if (!d || !app) return null;
  const classification = businessSelectionLabels(app.businessCategories).map(item => `${item.category}${item.specialties.length ? `: ${item.specialties.join(", ")}` : " (sin especialidad específica)"}`).join(" · ");
  const rows = [["Solicitante", d.applicant.displayName], ["Correo", app.contactEmail], ["Teléfono", app.contactPhone], ["Modalidad", app.businessType === "company" ? `Empresa: ${app.businessName}` : "Persona natural"], ["Clasificación del negocio", classification || "Sin clasificación válida"], ["Preferencia de plan (no pagado)", d.planSelection ? `${getSellerPlan(d.planSelection.planId).name} · ${sellerPlanLabel(d.planSelection.planId)}/mes` : "No elegida"], ["Identificación", `${app.identificationType === "cedula" ? "Cédula" : "Carné de residencia"}: ${app.identificationNumber}`], ["Vencimiento", app.documentExpiry || "Revisar en documento"], ["Ubicación", `${app.city}, ${app.province}`], ["Iglesia (opcional)", app.churchName || "No indicó"], ["Pastor (opcional)", app.pastorName || "No indicó"]];
  return <section className="member-card admin-detail"><div className="admin-list-heading"><h2>Expediente #{id}</h2><span className="admin-status">{statusLabels[app.status]}</span></div>
    <dl className="admin-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="member-notice">Correo: {d.profile?.emailVerifiedAt ? "verificado con Google" : "pendiente"} · Teléfono: {d.profile?.phoneVerifiedAt ? `verificado el ${new Date(d.profile.phoneVerifiedAt).toLocaleDateString("es-PA", { timeZone: "America/Panama" })}` : "pendiente"}</p>
    {app.status === "pending" && <PhoneVerificationBox id={id} revision={app.revision} phone={app.contactPhone} verified={Boolean(d.profile?.phoneVerifiedAt)} onChanged={async () => { await detail.refetch(); }} />}
    <h3>Documentos privados</h3><div className="admin-documents">{d.documents.map(doc => <div key={doc.id}><strong>{doc.kind === "identity" ? "Identificación" : "Carta pastoral (opcional)"}</strong><small>{doc.fileName} · {(doc.size / 1024).toFixed(0)} KiB</small><DocumentViewer document={doc} /></div>)}{!d.documents.length && <p>No se han adjuntado documentos.</p>}</div>
    <p>Versión de consentimiento registrada: <strong>{app.consentVersion}</strong>.</p>
    <p>Consentimientos: residencia {app.residenceConfirmed ? "sí" : "no"}; <strong>valores cristianos de CuadraZone {app.faithAccepted ? "sí" : "no"}</strong>; conducta {app.conductAccepted ? "sí" : "no"}; privacidad {app.privacyAccepted ? "sí" : "no"}.</p>
    {app.reviewReason && <p className="member-notice"><strong>Motivo de revisión:</strong> {app.reviewReason}</p>}
    {app.status === "pending" && <div className="admin-review-form"><label className="admin-check"><input type="checkbox" checked={documentsReviewed} onChange={e => setDocumentsReviewed(e.target.checked)} />He revisado la identificación vigente y la carta pastoral firmada.</label><label>Motivo u observación<textarea maxLength={1500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Para rechazar, explica el motivo con al menos 10 caracteres." /></label><div className="admin-actions"><button className="btn btn-outline" disabled={reason.trim().length < 10 || review.isPending} onClick={() => setConfirmation("rejected")}>Rechazar con motivo</button><button className="btn btn-gold" disabled={!canApprove || review.isPending} onClick={() => setConfirmation("approved")}>Revisar aprobación</button></div><small>Aprobar deja la tienda pendiente del primer pago de {sellerPlanLabel(d.planSelection?.planId ?? "normal")}. No se activan cobros en esta etapa.</small></div>}
    <details className="admin-audit"><summary>Historial del expediente</summary><ul>{d.audit.map(entry => <li key={entry.id}><strong>{auditLabels[entry.action] ?? entry.action}</strong><span>{new Date(entry.createdAt).toLocaleString("es-PA", { timeZone: "America/Panama" })}</span>{entry.reason && <small>{entry.reason}</small>}</li>)}</ul></details>
    <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !review.isPending) setConfirmation(null); }}><DialogContent><DialogHeader><DialogTitle>Confirmar {confirmation === "approved" ? "aprobación" : "rechazo"}</DialogTitle><DialogDescription>Solicitud #{id} de {d.applicant.displayName}. Esta decisión quedará registrada en el historial.</DialogDescription></DialogHeader><p>{confirmation === "approved" ? "Vendedor aprobado, tienda pendiente de su primera mensualidad. No se cobra ni activa la tienda." : `Motivo: ${reason.trim()}`}</p><div className="admin-actions"><button className="btn btn-outline" disabled={review.isPending} onClick={() => setConfirmation(null)}>Volver</button><button className="btn btn-gold" disabled={review.isPending} onClick={confirmReview}>{review.isPending ? "Guardando…" : "Confirmar decisión"}</button></div></DialogContent></Dialog>
  </section>;
}

const auditLabels: Record<string, string> = {
  application_saved: "Borrador guardado",
  application_submitted: "Solicitud enviada",
  document_uploaded: "Documento cargado",
  application_approved: "Solicitud aprobada",
  application_rejected: "Solicitud rechazada",
  email_verified_google: "Correo verificado con Google",
  phone_verified_admin: "Teléfono verificado por administrador",
  phone_verification_revoked: "Verificación de teléfono revocada",
  plan_selected: "Plan elegido",
  trial_started: "Prueba gratis de 3 meses iniciada",
  subscription_payment_recorded: "Mensualidad registrada",
  subscription_deactivated: "Suscripción desactivada",
  commission_payment_recorded: "Comisión pagada",
};

function PhoneVerificationBox({ id, revision, phone, verified, onChanged }: { id: number; revision: number; phone: string; verified: boolean; onChanged: () => Promise<unknown> }) {
  const mutation = trpc.membership.admin.phoneVerification.useMutation();
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const digits = phone.replace(/\D/g, "");
  async function apply() {
    try {
      await mutation.mutateAsync({ id, revision, verified: !verified, note: note.trim() });
      setConfirming(false); setNote("");
      await onChanged();
      toast.success(verified ? "Verificación del teléfono revocada" : "Teléfono verificado");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar"); }
  }
  return <div className="admin-review-form">
    <h3>Verificación del teléfono</h3>
    {verified
      ? <p>El teléfono <strong>{phone}</strong> ya está verificado. Si fue un error, puedes revocarlo con una nota.</p>
      : <p>Confirma que <strong>{phone}</strong> pertenece al solicitante: llámalo o escríbele por <a className="member-inline-link" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">WhatsApp</a> y pídele que confirme sus datos.</p>}
    <label>Cómo lo confirmaste<input maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={verified ? "Motivo de la revocación" : "Ej.: Llamada el 18/10, confirmó nombre e iglesia"} /></label>
    <div className="admin-actions">
      {!confirming
        ? <button className={verified ? "btn btn-outline" : "btn btn-gold"} disabled={note.trim().length < 5 || mutation.isPending} onClick={() => setConfirming(true)}>{verified ? "Revocar verificación" : "Marcar teléfono como verificado"}</button>
        : <><button className="btn btn-outline" disabled={mutation.isPending} onClick={() => setConfirming(false)}>Cancelar</button><button className="btn btn-gold" disabled={mutation.isPending} onClick={() => void apply()}>{mutation.isPending ? "Guardando…" : "Confirmar"}</button></>}
    </div>
    <small>Queda registrado en el historial con tu nombre, la fecha y la nota.</small>
  </div>;
}

function DenominationManager({ enabled }: { enabled: boolean }) {
  const list = trpc.membership.admin.denominations.useQuery(undefined, { enabled });
  const utils = trpc.useUtils();
  const save = trpc.membership.admin.saveDenomination.useMutation();
  const [id, setId] = useState<number>(); const [name, setName] = useState(""); const [active, setActive] = useState(true);
  async function submit(event: React.FormEvent) { event.preventDefault(); try { await save.mutateAsync({ id, name: name.trim(), active }); await Promise.all([list.refetch(), utils.membership.denominations.list.invalidate()]); setId(undefined); setName(""); setActive(true); toast.success("Denominación guardada"); } catch(error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar"); } }
  return <section className="member-card"><div className="admin-list-heading"><h2>Lista cerrada de denominaciones</h2><Church size={26} /></div><p>Las inactivas se conservan en el historial, pero no pueden seleccionarse en nuevas solicitudes.</p>{list.error && <p className="member-error" role="alert">{list.error.message}<button onClick={() => list.refetch()}>Reintentar</button></p>}<div className="admin-denominations">{list.data?.map(item => <button key={item.id} onClick={() => { setId(item.id); setName(item.name); setActive(item.active); }}><strong>{item.name}</strong><span>{item.active ? "Activa" : "Inactiva"}</span><small>Editar</small></button>)}</div><form className="admin-review-form" onSubmit={submit}><h3>{id ? "Editar denominación" : "Agregar denominación"}</h3><label>Nombre<input required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} /></label><label className="admin-check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Activa en el formulario de vendedor</label><div className="admin-actions"><button className="btn btn-outline" type="button" onClick={() => { setId(undefined); setName(""); setActive(true); }}>Nuevo registro</button><button className="btn btn-gold" disabled={save.isPending} type="submit">{save.isPending ? "Guardando…" : "Guardar denominación"}</button></div></form></section>;
}
