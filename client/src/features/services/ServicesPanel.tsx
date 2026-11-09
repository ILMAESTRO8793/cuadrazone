import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { provinceOptions } from "@shared/marketplace";
import {
  MAX_SERVICE_IMAGES,
  durationLabel,
  modalityLabels,
  priceTypeLabels,
  priceTypes,
  requestStatusLabels,
  requestStatuses,
  serviceCategoryOptions,
  serviceModalities,
  servicePriceLabel,
  serviceStatusLabels,
  serviceTypeLabels,
  serviceTypes,
  type OwnServiceDTO,
  type PriceType,
  type RequestStatus,
  type ServiceModality,
  type ServiceType,
} from "@shared/services";
import { trpc } from "@/lib/trpc";
import "../realEstate/realEstate.css";
import "./services.css";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error");
const centsFrom = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

type Form = {
  id?: number; expectedRevision?: number; status?: OwnServiceDTO["status"]; slug?: string; title: string; description: string; serviceType: ServiceType; categoryId: string;
  specialtyId: string; priceType: PriceType; price: string; durationHours: string; durationMinutes: string;
  modalities: ServiceModality[]; coverageProvinces: string[]; schedule: string; images: string[];
};
const empty = (): Form => ({
  title: "", description: "", serviceType: "a_domicilio", categoryId: serviceCategoryOptions[0]!.id, specialtyId: "", priceType: "fijo",
  price: "", durationHours: "", durationMinutes: "", modalities: ["a_domicilio"], coverageProvinces: [], schedule: "", images: [],
});
const fromService = (s: OwnServiceDTO): Form => ({
  id: s.id, expectedRevision: s.revision, status: s.status, slug: s.slug, title: s.title, description: s.description, serviceType: s.serviceType, categoryId: s.categoryId,
  specialtyId: s.specialtyId ?? "", priceType: s.priceType, price: s.priceCents ? String(s.priceCents / 100) : "",
  durationHours: s.durationMinutes ? String(Math.floor(s.durationMinutes / 60) || "") : "",
  durationMinutes: s.durationMinutes ? String(s.durationMinutes % 60 || "") : "",
  modalities: s.modalities, coverageProvinces: s.coverageProvinces, schedule: s.schedule, images: s.images,
});

export function ServicesPanel({ hasStore }: { hasStore: boolean }) {
  const utils = trpc.useUtils();
  const mine = trpc.services.mine.useQuery(undefined, { enabled: hasStore });
  const requests = trpc.services.myRequests.useQuery(undefined, { enabled: hasStore });
  const save = trpc.services.save.useMutation();
  const setStatus = trpc.services.setStatus.useMutation();
  const remove = trpc.services.remove.useMutation();
  const setRequestStatus = trpc.services.setRequestStatus.useMutation();
  const [form, setForm] = useState<Form | null>(null);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  const category = serviceCategoryOptions.find(c => c.id === form?.categoryId);

  if (!hasStore)
    return (
      <section className="seller-catalog-empty">
        <h2>Primero guarda la información de tu tienda</h2>
        <p>En la pestaña «Mi tienda» escribe el nombre, la descripción y la provincia. Después podrás publicar tus servicios.</p>
      </section>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const minutes = (Number(form.durationHours) || 0) * 60 + (Number(form.durationMinutes) || 0);
    try {
      const saved = await save.mutateAsync({
        ...(form.id ? { id: form.id, expectedRevision: form.expectedRevision } : {}),
        title: form.title, description: form.description, serviceType: form.serviceType, categoryId: form.categoryId,
        specialtyId: form.specialtyId || null, priceType: form.priceType, priceCents: form.priceType === "cotizar" ? null : centsFrom(form.price),
        durationMinutes: minutes || null, modalities: form.modalities,
        coverageProvinces: form.modalities.includes("a_domicilio") ? form.coverageProvinces : [], schedule: form.schedule, images: form.images,
      });
      const fresh = await utils.services.mine.fetch();
      const updated = fresh.services.find(s => s.id === saved.id);
      if (updated) setForm(fromService(updated));
      toast.success(
        form.id
          ? "Servicio guardado"
          : "published" in saved && saved.published
            ? "¡Servicio publicado! Ya aparece en Servicios. Agrega fotos de tu trabajo abajo."
            : "Servicio creado como borrador. Se publicará cuando tu tienda esté aprobada y tu plan activo."
      );
    } catch (error) { toast.error(errorText(error)); }
  }
  async function upload(files: FileList | null) {
    if (!form?.id || !files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, MAX_SERVICE_IMAGES - form.images.length)) {
        const r = await fetch(`/api/services/${form.id}/images`, { method: "POST", credentials: "include", headers: { "Content-Type": file.type, "x-cz-request": "1" }, body: file });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "No se pudo subir la foto");
      }
      const fresh = await utils.services.mine.fetch();
      const updated = fresh.services.find(s => s.id === form.id);
      if (updated) setForm(fromService(updated));
      toast.success("Fotos agregadas");
    } catch (error) { toast.error(errorText(error)); } finally { setUploading(false); }
  }
  async function changeStatus(id: number, status: "published" | "paused" | "draft") {
    try {
      await setStatus.mutateAsync({ id, status });
      const fresh = await utils.services.mine.fetch();
      if (form?.id === id) { const updated = fresh.services.find(s => s.id === id); if (updated) setForm(fromService(updated)); }
      toast.success(status === "published" ? "¡Servicio publicado! Ya aparece en Servicios." : "Estado actualizado");
    }
    catch (error) { toast.error(errorText(error)); }
  }

  if (form) {
    const home = form.modalities.includes("a_domicilio");
    return (
      <section className="svc-editor">
        <button className="re-back" onClick={() => setForm(null)}>← Mis servicios</button>
        <h2>{form.id ? "Editar servicio" : "Nuevo servicio"}</h2>
        {form.id && form.status && (
          <div className={`svc-status-bar svc-status-bar--${form.status}`} role="status">
            <span>
              <strong>{serviceStatusLabels[form.status]}</strong>
              {form.status === "published" ? " · Visible en la sección Servicios." : " · No se ve en Servicios hasta que lo publiques."}
            </span>
            {form.status !== "published" ? (
              <button type="button" className="btn btn-gold" disabled={setStatus.isPending} onClick={() => void changeStatus(form.id!, "published")}>Publicar ahora</button>
            ) : (
              <span className="svc-status-actions">
                {form.slug && <Link className="btn btn-outline" href={`/servicio/${form.slug}`}>Ver como cliente</Link>}
                <button type="button" className="btn btn-outline" disabled={setStatus.isPending} onClick={() => void changeStatus(form.id!, "paused")}>Pausar</button>
              </span>
            )}
          </div>
        )}
        <form className="re-form" onSubmit={submit}>
          <fieldset>
            <legend>¿Qué ofreces?</legend>
            <div className="re-segment">
              {serviceTypes.map(t => <button type="button" key={t} className={form.serviceType === t ? "is-active" : ""} onClick={() => set("serviceType", t)}>{serviceTypeLabels[t]}</button>)}
            </div>
            <label>Nombre del servicio<input className="svc-input" value={form.title} onChange={e => set("title", e.target.value)} maxLength={120} required placeholder="Ej.: Destape de tuberías y reparación de fugas" /></label>
            <label>Descripción<textarea rows={5} value={form.description} onChange={e => set("description", e.target.value)} maxLength={5000} required placeholder="Qué incluye, tu experiencia, materiales, garantía del trabajo…" /></label>
            <div className="re-row">
              <label>Categoría
                <select value={form.categoryId} onChange={e => { set("categoryId", e.target.value); set("specialtyId", ""); }}>
                  {serviceCategoryOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label>Especialidad (opcional)
                <select value={form.specialtyId} onChange={e => set("specialtyId", e.target.value)}>
                  <option value="">Sin especificar</option>
                  {category?.specialties.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Precio y duración</legend>
            <div className="re-segment">
              {priceTypes.map(t => <button type="button" key={t} className={form.priceType === t ? "is-active" : ""} onClick={() => set("priceType", t)}>{priceTypeLabels[t]}</button>)}
            </div>
            <div className="re-row">
              {form.priceType !== "cotizar" && <label>{form.priceType === "por_hora" ? "Precio por hora (US$)" : form.priceType === "desde" ? "Precio desde (US$)" : "Precio (US$)"}<input className="svc-input" inputMode="decimal" value={form.price} onChange={e => set("price", e.target.value)} required /></label>}
              <label>Duración: horas<input className="svc-input" inputMode="numeric" value={form.durationHours} onChange={e => set("durationHours", e.target.value)} placeholder="Ej.: 1" /></label>
              <label>y minutos<input className="svc-input" inputMode="numeric" value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)} placeholder="Ej.: 30" /></label>
            </div>
            {form.priceType === "cotizar" && <p className="re-muted re-small">El cliente te escribe y tú le das el precio según el trabajo.</p>}
          </fieldset>
          <fieldset>
            <legend>Dónde lo das</legend>
            <div className="re-checks">
              {serviceModalities.map(m => (
                <label key={m}>
                  <input type="checkbox" checked={form.modalities.includes(m)} onChange={e => set("modalities", e.target.checked ? [...form.modalities, m] : form.modalities.filter(x => x !== m))} /> {modalityLabels[m]}
                </label>
              ))}
            </div>
            {home && (
              <>
                <p className="re-muted re-small">¿A qué provincias vas a domicilio?</p>
                <div className="kind-chips">
                  {provinceOptions.map(p => {
                    const on = form.coverageProvinces.includes(p);
                    return <button type="button" key={p} className={`kind-chip ${on ? "is-active" : ""}`} aria-pressed={on} onClick={() => set("coverageProvinces", on ? form.coverageProvinces.filter(x => x !== p) : [...form.coverageProvinces, p])}>{p}</button>;
                  })}
                </div>
              </>
            )}
            <label>Horario (opcional)<input className="svc-input" value={form.schedule} onChange={e => set("schedule", e.target.value)} maxLength={300} placeholder="Ej.: Lunes a sábado de 8:00 a. m. a 5:00 p. m." /></label>
          </fieldset>
          <div className="re-form-actions"><button className="btn btn-gold" type="submit" disabled={save.isPending}>{save.isPending ? "Guardando…" : form.id ? "Guardar cambios" : "Crear servicio"}</button></div>
          {form.id && (
            <fieldset>
              <legend>Fotos de tus trabajos ({form.images.length} de {MAX_SERVICE_IMAGES})</legend>
              <div className="re-thumbs re-thumbs--edit">{form.images.map(src => <img key={src} src={src} alt="" />)}</div>
              {form.images.length < MAX_SERVICE_IMAGES && (
                <label className="re-upload">
                  {uploading ? "Subiendo…" : "+ Agregar fotos (JPG, PNG o WEBP, máx. 5 MB)"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={e => void upload(e.target.files)} />
                </label>
              )}
            </fieldset>
          )}
        </form>
      </section>
    );
  }

  const pending = requests.data?.filter(r => r.status === "nueva").length ?? 0;
  return (
    <>
      <section className="seller-catalog-toolbar">
        <div>
          <p className="seller-catalog-eyebrow">TIENDA DE SERVICIOS</p>
          <h2>Mis servicios</h2>
          <p>Sin envíos ni inventario: tus clientes te envían una solicitud y tú los contactas para coordinar. No pagas comisión, solo tu plan.</p>
        </div>
        <button className="seller-catalog-button seller-catalog-button--gold" type="button" onClick={() => setForm(empty())}>+ Nuevo servicio</button>
      </section>
      {mine.isLoading && <p role="status">Cargando…</p>}
      {mine.data && mine.data.services.length === 0 && (
        <div className="re-empty"><h3>Todavía no tienes servicios</h3><p>Crea el primero: clases, reparaciones, consultas, servicios para eventos…</p></div>
      )}
      <ul className="re-mine">
        {mine.data?.services.map(s => (
          <li key={s.id}>
            {s.images[0] ? <img src={s.images[0]} alt="" /> : <div className="re-card-nophoto">Sin foto</div>}
            <div>
              <strong>{s.title}</strong>
              <span className="re-muted">{servicePriceLabel(s)}{s.durationMinutes ? ` · ${durationLabel(s.durationMinutes)}` : ""} · {s.modalities.map(m => modalityLabels[m]).join(", ")}</span>
              <span className={`re-status re-status--${s.status}`}>{serviceStatusLabels[s.status]}{s.newRequests ? ` · ${s.newRequests} solicitud(es) nueva(s)` : ""}</span>
              {s.status !== "published" && <span className="re-muted re-small">No se ve en Servicios hasta que pulses «Publicar».</span>}
              {!s.images[0] && <span className="re-muted re-small">Agrega una foto: es lo primero que ven los clientes.</span>}
            </div>
            <div className="re-mine-actions">
              <button className="btn btn-outline" onClick={() => setForm(fromService(s))}>Editar</button>
              {s.status !== "published" && <button className="btn btn-gold" onClick={() => void changeStatus(s.id, "published")}>Publicar</button>}
              {s.status === "published" && <Link className="btn btn-outline" href={`/servicio/${s.slug}`}>Ver</Link>}
              {s.status === "published" && <button className="btn btn-outline" onClick={() => void changeStatus(s.id, "paused")}>Pausar</button>}
              <button className="btn btn-outline" onClick={async () => { if (confirm("¿Borrar este servicio y sus solicitudes?")) { await remove.mutateAsync({ id: s.id }); await utils.services.mine.invalidate(); } }}>Borrar</button>
            </div>
          </li>
        ))}
      </ul>
      <section className="svc-requests" aria-labelledby="svc-requests-title">
        <h2 id="svc-requests-title">Solicitudes recibidas{pending ? ` · ${pending} nuevas` : ""}</h2>
        {requests.data && requests.data.length === 0 && <p className="re-muted">Cuando alguien solicite uno de tus servicios aparecerá aquí y te llegará un correo.</p>}
        <ul className="re-mine">
          {requests.data?.map(r => {
            const digits = r.phone.replace(/\D/g, "");
            return (
              <li key={r.id} className="job-applicant">
                <div className="job-applicant-head">
                  <div>
                    <strong>{r.name} · {r.serviceTitle}</strong>
                    <span className="re-muted">{r.province}{r.preferredDate ? ` · prefiere el ${r.preferredDate}` : ""} · {new Date(r.createdAt).toLocaleDateString("es-PA")}</span>
                  </div>
                  <select aria-label="Estado de la solicitud" value={r.status} onChange={async e => { await setRequestStatus.mutateAsync({ id: r.id, status: e.target.value as RequestStatus }); await utils.services.myRequests.invalidate(); }}>
                    {requestStatuses.map(s => <option key={s} value={s}>{requestStatusLabels[s]}</option>)}
                  </select>
                </div>
                <p className="job-message">«{r.message}»</p>
                <div className="re-mine-actions">
                  <a className="btn btn-gold" href={`https://wa.me/${digits}?text=${encodeURIComponent(`Hola ${r.name}, te escribo por tu solicitud en CuadraZone: ${r.serviceTitle}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  <a className="btn btn-outline" href={`tel:${r.phone}`}>Llamar</a>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
