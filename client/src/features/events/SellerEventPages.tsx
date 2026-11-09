import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, Camera, CheckCircle2, Plus, ScanLine, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import jsQR from "jsqr";
import { provinceOptions } from "@shared/marketplace";
import {
  MAX_EVENT_IMAGES,
  MAX_TICKET_TYPES,
  dateToPanamaLocal,
  eventDateLabel,
  eventStatusLabels,
  moneyLabel,
  ticketOrderStatusLabels,
  type OwnEventDTO,
} from "@shared/events";
import { trpc } from "@/lib/trpc";
import "../realEstate/realEstate.css";
import "../services/services.css";
import "./events.css";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error");
const centsFrom = (v: string) => {
  const n = Number(v.replace(/[,\s$]/g, ""));
  return v.trim() === "" ? 0 : Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};

type TypeRow = { id?: number; name: string; price: string; capacity: string; taken: number };
type Form = {
  id?: number;
  expectedRevision?: number;
  status?: OwnEventDTO["status"];
  slug?: string;
  title: string;
  artist: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  address: string;
  province: string;
  city: string;
  mapUrl: string;
  images: string[];
  types: TypeRow[];
};
const empty = (): Form => ({
  title: "",
  artist: "",
  description: "",
  startsAt: "",
  endsAt: "",
  venueName: "",
  address: "",
  province: "Panamá",
  city: "",
  mapUrl: "",
  images: [],
  types: [{ name: "General", price: "", capacity: "100", taken: 0 }],
});
const fromEvent = (e: OwnEventDTO): Form => ({
  id: e.id,
  expectedRevision: e.revision,
  status: e.status,
  slug: e.slug,
  title: e.title,
  artist: e.artist,
  description: e.description,
  startsAt: dateToPanamaLocal(e.startsAt),
  endsAt: e.endsAt ? dateToPanamaLocal(e.endsAt) : "",
  venueName: e.venueName,
  address: e.address,
  province: e.province,
  city: e.city,
  mapUrl: e.mapUrl,
  images: e.images,
  types: e.ticketTypes.map(t => ({
    id: t.id,
    name: t.name,
    price: t.priceCents ? (t.priceCents / 100).toFixed(2) : "",
    capacity: String(t.capacity),
    taken: t.capacity - t.available,
  })),
});

function Orders({ eventId }: { eventId: number }) {
  const utils = trpc.useUtils();
  const orders = trpc.events.orders.useQuery({ id: eventId });
  const refresh = () => {
    void utils.events.orders.invalidate({ id: eventId });
    void utils.events.mine.invalidate();
  };
  const markPaid = trpc.events.markPaid.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Pago confirmado. El comprador ya recibió sus boletos con QR.");
    },
    onError: e => toast.error(e.message),
  });
  const cancel = trpc.events.cancelOrder.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Reserva cancelada y aforo liberado");
    },
    onError: e => toast.error(e.message),
  });
  if (orders.isLoading) return <p role="status">Cargando reservas…</p>;
  if (orders.error) return <p className="member-error">{orders.error.message}</p>;
  const rows = orders.data ?? [];
  return (
    <section className="ev-seller-orders">
      <h3>Reservas ({rows.length})</h3>
      {rows.length === 0 && <p className="re-muted">Todavía no hay reservas.</p>}
      <ul className="re-mine ev-order-list">
        {rows.map(o => (
          <li key={o.id}>
            <div>
              <strong>
                {o.buyerName} · {o.quantity} × {o.typeName}
              </strong>
              <span className="re-muted">
                {o.buyerPhone} · {moneyLabel(o.totalCents)} ·{" "}
                <span className={`ev-status ev-status--${o.status}`}>{ticketOrderStatusLabels[o.status]}</span>
              </span>
              {o.status === "reserved" && o.expiresAt && <span className="re-muted re-small">Se libera el {eventDateLabel(o.expiresAt)}</span>}
            </div>
            <div className="re-mine-actions">
              {o.status === "reserved" && (
                <button
                  className="btn btn-gold"
                  disabled={markPaid.isPending}
                  onClick={() => {
                    if (window.confirm(`¿Recibiste ${moneyLabel(o.totalCents)} de ${o.buyerName}? Se le enviarán sus boletos con QR.`)) markPaid.mutate({ id: o.id });
                  }}
                >
                  Marcar pagado
                </button>
              )}
              {o.status !== "cancelled" && (
                <button
                  className="btn btn-outline"
                  disabled={cancel.isPending}
                  onClick={() => {
                    if (window.confirm(o.status === "paid" ? "Esta reserva ya está pagada: si la cancelas, tú devuelves el dinero al comprador. ¿Cancelar?" : "¿Cancelar esta reserva?"))
                      cancel.mutate({ id: o.id });
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SellerEventsPage() {
  const utils = trpc.useUtils();
  const mine = trpc.events.mine.useQuery();
  const save = trpc.events.save.useMutation();
  const setStatus = trpc.events.setStatus.useMutation();
  const [form, setForm] = useState<Form | null>(null);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  const setType = (i: number, patch: Partial<TypeRow>) => setForm(f => (f ? { ...f, types: f.types.map((t, j) => (j === i ? { ...t, ...patch } : t)) } : f));

  async function reload(id: number) {
    const fresh = await utils.events.mine.fetch();
    const updated = fresh.events.find(e => e.id === id);
    if (updated) setForm(fromEvent(updated));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const ticketTypes = form.types.map(t => ({
      ...(t.id ? { id: t.id } : {}),
      name: t.name,
      priceCents: centsFrom(t.price),
      capacity: Number(t.capacity),
    }));
    if (ticketTypes.some(t => Number.isNaN(t.priceCents))) return toast.error("Revisa los precios: escribe solo números, por ejemplo 15.00");
    try {
      const saved = await save.mutateAsync({
        ...(form.id ? { id: form.id, expectedRevision: form.expectedRevision } : {}),
        title: form.title,
        artist: form.artist,
        description: form.description,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        venueName: form.venueName,
        address: form.address,
        province: form.province,
        city: form.city,
        mapUrl: form.mapUrl,
        ticketTypes,
        images: form.images,
      });
      await reload(saved.id);
      toast.success(form.id ? "Evento guardado" : "Evento creado como borrador. Agrega fotos y publícalo.");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function upload(files: FileList | null) {
    if (!form?.id || !files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, MAX_EVENT_IMAGES - form.images.length)) {
        const r = await fetch(`/api/events/${form.id}/images`, { method: "POST", credentials: "include", headers: { "Content-Type": file.type, "x-cz-request": "1" }, body: file });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "No se pudo subir la foto");
      }
      await reload(form.id);
      toast.success("Fotos agregadas");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setUploading(false);
    }
  }

  async function changeStatus(id: number, status: "published" | "draft" | "cancelled") {
    if (status === "cancelled" && !window.confirm("¿Cancelar el evento? Se anulan todas las reservas y boletos, y se avisa por correo a los compradores. No se puede deshacer."))
      return;
    try {
      const result = await setStatus.mutateAsync({ id, status });
      if (form?.id === id) await reload(id);
      else await utils.events.mine.invalidate();
      toast.success(
        status === "published"
          ? "¡Evento publicado! Ya aparece en Eventos."
          : status === "cancelled"
            ? `Evento cancelado. ${result.cancelledOrders} reserva(s) anulada(s).`
            : "El evento volvió a borrador"
      );
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  if (form) {
    const locked = form.status === "cancelled";
    return (
      <div className="re-page container">
        <button className="re-back" onClick={() => setForm(null)}>
          ← Mis eventos
        </button>
        <h1>{form.id ? "Editar evento" : "Nuevo evento"}</h1>
        {form.id && form.status && (
          <div className={`svc-status-bar svc-status-bar--${form.status}`} role="status">
            <span>
              <strong>{eventStatusLabels[form.status]}</strong>
              {form.status === "published" ? " · Visible en Eventos." : form.status === "cancelled" ? " · Reservas y boletos anulados." : " · No se ve en Eventos hasta que lo publiques."}
            </span>
            <span className="svc-status-actions">
              {form.status === "draft" && (
                <button type="button" className="btn btn-gold" disabled={setStatus.isPending} onClick={() => void changeStatus(form.id!, "published")}>
                  Publicar ahora
                </button>
              )}
              {form.status === "published" && (
                <>
                  {form.slug && (
                    <Link className="btn btn-outline" href={`/evento/${form.slug}`}>
                      Ver como cliente
                    </Link>
                  )}
                  <Link className="btn btn-outline" href={`/vendedor/escanear/${form.id}`}>
                    <ScanLine size={16} /> Escanear boletos
                  </Link>
                </>
              )}
              {form.status !== "cancelled" && (
                <button type="button" className="btn btn-outline" disabled={setStatus.isPending} onClick={() => void changeStatus(form.id!, "cancelled")}>
                  Cancelar evento
                </button>
              )}
            </span>
          </div>
        )}
        <form className="re-form" onSubmit={submit}>
          <fieldset disabled={locked}>
            <legend>El evento</legend>
            <label>
              Nombre del evento
              <input className="svc-input" value={form.title} onChange={e => set("title", e.target.value)} required minLength={3} maxLength={140} placeholder="Concierto de alabanza" />
            </label>
            <label>
              Artista o invitado (opcional)
              <input className="svc-input" value={form.artist} onChange={e => set("artist", e.target.value)} maxLength={140} />
            </label>
            <label>
              Descripción
              <textarea value={form.description} onChange={e => set("description", e.target.value)} required minLength={10} maxLength={5000} />
            </label>
            <div className="ev-form-row">
              <label>
                Empieza (hora de Panamá)
                <input className="svc-input" type="datetime-local" value={form.startsAt} onChange={e => set("startsAt", e.target.value)} required />
              </label>
              <label>
                Termina (opcional)
                <input className="svc-input" type="datetime-local" value={form.endsAt} onChange={e => set("endsAt", e.target.value)} />
              </label>
            </div>
          </fieldset>
          <fieldset disabled={locked}>
            <legend>Lugar</legend>
            <label>
              Lugar
              <input className="svc-input" value={form.venueName} onChange={e => set("venueName", e.target.value)} required minLength={2} maxLength={140} placeholder="Auditorio, iglesia, centro de convenciones…" />
            </label>
            <label>
              Dirección
              <input className="svc-input" value={form.address} onChange={e => set("address", e.target.value)} maxLength={240} />
            </label>
            <div className="ev-form-row">
              <label>
                Provincia
                <select value={form.province} onChange={e => set("province", e.target.value)}>
                  {provinceOptions.map(p => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Ciudad o corregimiento
                <input className="svc-input" value={form.city} onChange={e => set("city", e.target.value)} maxLength={80} />
              </label>
            </div>
            <label>
              Enlace de Google Maps (opcional)
              <input className="svc-input" type="url" value={form.mapUrl} onChange={e => set("mapUrl", e.target.value)} maxLength={500} placeholder="https://maps.app.goo.gl/…" />
            </label>
          </fieldset>
          <fieldset disabled={locked}>
            <legend>Entradas</legend>
            <p className="re-muted re-small">Deja el precio vacío o en 0 para entrada gratis. No puedes bajar la capacidad por debajo de lo ya apartado ni cambiar el precio de una entrada que ya tiene boletos.</p>
            {form.types.map((t, i) => (
              <div key={t.id ?? `new-${i}`} className="ev-type-row">
                <label>
                  Tipo
                  <input className="svc-input" value={t.name} onChange={e => setType(i, { name: e.target.value })} required maxLength={60} />
                </label>
                <label>
                  Precio (US$)
                  <input className="svc-input" inputMode="decimal" value={t.price} onChange={e => setType(i, { price: e.target.value })} placeholder="Gratis" disabled={t.taken > 0} />
                </label>
                <label>
                  Capacidad
                  <input className="svc-input" type="number" min={Math.max(1, t.taken)} value={t.capacity} onChange={e => setType(i, { capacity: e.target.value })} required />
                </label>
                <span className="re-muted re-small">{t.taken > 0 ? `${t.taken} apartados` : ""}</span>
                {form.types.length > 1 && t.taken === 0 && (
                  <button type="button" className="btn btn-outline ev-icon-btn" aria-label={`Quitar ${t.name}`} onClick={() => set("types", form.types.filter((_, j) => j !== i))}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            {form.types.length < MAX_TICKET_TYPES && (
              <button type="button" className="btn btn-outline" onClick={() => set("types", [...form.types, { name: "", price: "", capacity: "50", taken: 0 }])}>
                <Plus size={16} /> Agregar tipo de entrada
              </button>
            )}
          </fieldset>
          {form.id ? (
            <fieldset disabled={locked}>
              <legend>Fotos ({form.images.length}/{MAX_EVENT_IMAGES})</legend>
              <div className="re-thumbs re-thumbs--edit">
                {form.images.map(src => (
                  <span key={src} className="ev-photo">
                    <img src={src} alt="" />
                    <button type="button" aria-label="Quitar foto" onClick={() => set("images", form.images.filter(x => x !== src))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {form.images.length < MAX_EVENT_IMAGES && (
                <label className="btn btn-outline ev-upload">
                  <Camera size={16} /> {uploading ? "Subiendo…" : "Agregar fotos"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden disabled={uploading} onChange={e => void upload(e.target.files)} />
                </label>
              )}
              <p className="re-muted re-small">Si quitas una foto, pulsa «Guardar» para confirmar.</p>
            </fieldset>
          ) : (
            <p className="re-muted">Después de guardar podrás agregar fotos.</p>
          )}
          {!locked && (
            <div className="re-form-actions">
              <button className="btn btn-gold" type="submit" disabled={save.isPending}>
                {save.isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          )}
        </form>
        {form.id && <Orders eventId={form.id} />}
      </div>
    );
  }

  return (
    <div className="re-page container">
      <div className="re-hero">
        <div>
          <p className="eyebrow">PANEL DE VENDEDOR</p>
          <h1>Mis eventos</h1>
          <p className="re-muted">Publica conciertos y conferencias, confirma pagos y escanea los boletos en la entrada.</p>
        </div>
        <span className="svc-status-actions">
          <Link className="btn btn-outline" href="/vendedor/productos">
            ← Mi tienda
          </Link>
          <button className="btn btn-gold" onClick={() => setForm(empty())}>
            <Plus size={16} /> Nuevo evento
          </button>
        </span>
      </div>
      {mine.isLoading && <p role="status">Cargando…</p>}
      {mine.error && <p className="member-error">{mine.error.message}</p>}
      {mine.data && mine.data.events.length === 0 && (
        <div className="re-empty">
          <h2>Todavía no tienes eventos</h2>
          <p>Necesitas una tienda aprobada con plan activo para publicarlos.</p>
          <button className="btn btn-gold" onClick={() => setForm(empty())}>
            Crear mi primer evento
          </button>
        </div>
      )}
      <ul className="re-mine">
        {mine.data?.events.map(e => (
          <li key={e.id}>
            {e.images[0] ? <img src={e.images[0]} alt="" /> : <div className="re-card-nophoto">Evento</div>}
            <div>
              <strong>{e.title}</strong>
              <span className="re-muted">
                <CalendarDays size={13} /> {eventDateLabel(e.startsAt)} · {eventStatusLabels[e.status]}
              </span>
              <span className="ev-stats">
                <span>{e.stats.paid} pagados</span>
                <span>{e.stats.reserved} apartados</span>
                <span>{e.stats.used} ingresaron</span>
                <span>Aforo {e.stats.capacity}</span>
              </span>
            </div>
            <div className="re-mine-actions">
              <button className="btn btn-outline" onClick={() => setForm(fromEvent(e))}>
                Editar y reservas
              </button>
              {e.status === "draft" && (
                <button className="btn btn-gold" disabled={setStatus.isPending} onClick={() => void changeStatus(e.id, "published")}>
                  Publicar
                </button>
              )}
              {e.status === "published" && (
                <Link className="btn btn-gold" href={`/vendedor/escanear/${e.id}`}>
                  <ScanLine size={16} /> Escanear
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────── Escáner de la entrada ─────────────

type Result = { ok: true; holderName: string; typeName: string } | { ok: false; reason: string; usedAt?: string | null };

export function TicketScannerPage({ eventId }: { eventId: number }) {
  const attendance = trpc.events.attendance.useQuery({ id: eventId }, { refetchInterval: 5000 });
  const scan = trpc.events.scan.useMutation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const check = useCallback(
    async (code: string) => {
      const now = Date.now();
      // El mismo QR frente a la cámara se lee muchas veces por segundo: se ignora 4 s.
      if (busy.current || (lastCode.current?.code === code && now - lastCode.current.at < 4000)) return;
      busy.current = true;
      lastCode.current = { code, at: now };
      try {
        const r = await scan.mutateAsync({ eventId, code });
        setResult(r);
        if (navigator.vibrate) navigator.vibrate(r.ok ? 120 : [80, 60, 80]);
        void attendance.refetch();
      } catch (error) {
        setResult({ ok: false, reason: errorText(error) });
      } finally {
        busy.current = false;
      }
    },
    [eventId, scan, attendance]
  );

  const checkRef = useRef(check);
  checkRef.current = check;

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  async function start() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError("No se pudo abrir la cámara. Revisa el permiso de cámara o escribe el código a mano.");
    }
  }

  useEffect(() => {
    if (!cameraOn) return;
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && video.videoWidth) {
        const w = Math.min(640, video.videoWidth);
        const h = Math.round((video.videoHeight / video.videoWidth) * w);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
          if (found?.data) void checkRef.current(found.data);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cameraOn]);

  useEffect(() => stop, [stop]);

  const a = attendance.data;
  return (
    <div className="re-page container ev-scanner">
      <Link className="re-back" href="/vendedor/eventos">
        ← Mis eventos
      </Link>
      <h1>Escanear boletos</h1>
      {attendance.error && <p className="member-error">{attendance.error.message}</p>}
      {a && (
        <div className="ev-live" aria-live="polite">
          <strong>{a.title}</strong>
          <div className="ev-live-numbers">
            <span>
              <b>{a.used}</b> ingresaron
            </span>
            <span>
              <b>{a.issued - a.used}</b> por llegar
            </span>
            <span>
              <b>{a.capacity}</b> aforo
            </span>
          </div>
          <div className="ev-live-bar" role="progressbar" aria-valuemin={0} aria-valuemax={a.capacity} aria-valuenow={a.used}>
            <span style={{ width: `${a.capacity ? Math.min(100, (a.used / a.capacity) * 100) : 0}%` }} />
          </div>
        </div>
      )}
      {result && (
        <div className={`ev-result ${result.ok ? "is-ok" : "is-bad"}`} role="status" aria-live="assertive">
          {result.ok ? <CheckCircle2 size={56} /> : <XCircle size={56} />}
          <div>
            <strong>{result.ok ? "VÁLIDO · Puede pasar" : "NO VÁLIDO"}</strong>
            <span>
              {result.ok
                ? `${result.holderName} · ${result.typeName}`
                : `${result.reason}${result.usedAt ? ` (${eventDateLabel(result.usedAt)})` : ""}`}
            </span>
          </div>
        </div>
      )}
      <div className="ev-camera">
        <video ref={videoRef} playsInline muted hidden={!cameraOn} />
        <canvas ref={canvasRef} hidden />
        {!cameraOn ? (
          <button className="btn btn-gold" onClick={() => void start()}>
            <Camera size={18} /> Abrir cámara
          </button>
        ) : (
          <button className="btn btn-outline" onClick={stop}>
            Apagar cámara
          </button>
        )}
        {cameraError && <p className="member-error">{cameraError}</p>}
      </div>
      <form
        className="ev-manual"
        onSubmit={e => {
          e.preventDefault();
          lastCode.current = null;
          void check(manual).then(() => setManual(""));
        }}
      >
        <label>
          Escribir el código
          <input className="svc-input" value={manual} onChange={e => setManual(e.target.value.toUpperCase())} placeholder="XXXXX XXXXX XXXXX XXXXX" autoComplete="off" />
        </label>
        <button className="btn btn-outline" type="submit" disabled={!manual.trim() || scan.isPending}>
          Validar
        </button>
      </form>
    </div>
  );
}
