import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  MAX_BOOKABLE_MINUTES,
  MIN_BOOKABLE_MINUTES,
  appointmentStatusLabels,
  dayLabel,
  panamaDayKey,
  timeLabel,
  weekdayLabels,
  weekdayOrder,
  type AppointmentStatus,
} from "@shared/appointments";
import { durationLabel, type ServiceDTO } from "@shared/services";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { CommerceNav } from "../commerce/BuyerPages";
import "../realEstate/realEstate.css";
import "./services.css";
import "./appointments.css";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";
function normalizePhone(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 8
    ? `+507${d}`
    : d.length === 11 && d.startsWith("507")
      ? `+${d}`
      : v.trim();
}
const shortDay = (day: string) =>
  new Intl.DateTimeFormat("es-PA", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));

// ───────────── Cliente: reservar desde la ficha del servicio ─────────────

export function BookingBox({ service }: { service: ServiceDTO }) {
  const auth = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const slots = trpc.appointments.slots.useQuery(
    { serviceId: service.id },
    { retry: false }
  );
  const book = trpc.appointments.book.useMutation();
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", note: "" });
  const days = slots.data?.days ?? [];
  const current = days.find(d => d.day === day) ?? days[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return toast.error("Elige una hora");
    try {
      await book.mutateAsync({
        serviceId: service.id,
        startsAt: slot,
        clientName: form.name || auth.user?.name || "",
        clientPhone: normalizePhone(form.phone),
        note: form.note,
      });
      await utils.appointments.mine.invalidate();
      toast.success("¡Cita confirmada! Te enviamos los detalles por correo.");
      navigate("/mis-citas");
    } catch (error) {
      toast.error(errorText(error));
      setSlot(null);
      void slots.refetch();
    }
  }

  return (
    <section className="ap-box" aria-label="Reservar cita">
      <strong className="ap-box-title">
        <CalendarCheck size={18} /> Reservar cita
      </strong>
      {service.durationMinutes ? (
        <span className="re-muted re-small">
          <Clock size={12} /> Duración: {durationLabel(service.durationMinutes)}{" "}
          · Se confirma al instante
        </span>
      ) : null}
      {slots.isLoading && <p role="status">Buscando horas libres…</p>}
      {slots.error && <p className="re-muted">{slots.error.message}</p>}
      {slots.data && days.length === 0 && (
        <p className="re-muted">
          No hay horas libres en los próximos días. Pide información abajo.
        </p>
      )}
      {current && (
        <>
          <div className="ap-days" role="tablist" aria-label="Día">
            {days.map(d => (
              <button
                key={d.day}
                type="button"
                role="tab"
                aria-selected={d.day === current.day}
                className={d.day === current.day ? "is-active" : ""}
                onClick={() => {
                  setDay(d.day);
                  setSlot(null);
                }}
              >
                {shortDay(d.day)}
              </button>
            ))}
          </div>
          <p className="ap-day-label">{dayLabel(current.day)}</p>
          <div className="ap-slots">
            {current.slots.map(s => (
              <button
                key={s}
                type="button"
                className={s === slot ? "is-active" : ""}
                aria-pressed={s === slot}
                onClick={() => setSlot(s)}
              >
                {timeLabel(s)}
              </button>
            ))}
          </div>
        </>
      )}
      {slot && (
        <form className="svc-request" onSubmit={submit}>
          <label>
            Tu nombre
            <input
              value={form.name || auth.user?.name || ""}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              maxLength={120}
            />
          </label>
          <label>
            Tu celular
            <input
              inputMode="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              required
              placeholder="6123-4567"
            />
          </label>
          <label>
            Nota para el proveedor (opcional)
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              maxLength={500}
              placeholder="Dirección, detalles del trabajo…"
            />
          </label>
          <button
            className="btn btn-gold"
            type="submit"
            disabled={book.isPending}
          >
            {book.isPending
              ? "Reservando…"
              : `Confirmar cita: ${dayLabel(panamaDayKey(new Date(slot)))}, ${timeLabel(slot)}`}
          </button>
        </form>
      )}
    </section>
  );
}

// ───────────── Cliente: mis citas ─────────────

function StatusTag({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`ap-status ap-status--${status}`}>
      {appointmentStatusLabels[status]}
    </span>
  );
}

export function MyAppointmentsPage() {
  const utils = trpc.useUtils();
  const list = trpc.appointments.mine.useQuery();
  const cancel = trpc.appointments.cancel.useMutation({
    onSuccess: () => {
      void utils.appointments.mine.invalidate();
      toast.success("Cita cancelada. La hora quedó libre.");
    },
    onError: e => toast.error(e.message),
  });
  const now = Date.now();
  const rows = list.data ?? [];
  const upcoming = rows
    .filter(a => a.status === "confirmed" && new Date(a.endsAt).getTime() > now)
    .reverse();
  const past = rows.filter(a => !upcoming.includes(a));
  return (
    <div className="live-page container">
      <CommerceNav />
      <p className="eyebrow">SERVICIOS</p>
      <h1>Mis citas</h1>
      {list.isLoading && <p role="status">Cargando tus citas…</p>}
      {list.error && <p className="member-error">{list.error.message}</p>}
      {list.data && rows.length === 0 && (
        <div className="re-empty">
          <h2>Todavía no tienes citas</h2>
          <p>
            Busca un servicio con «Reservar cita» y elige la hora que te
            convenga.
          </p>
          <Link href="/servicios" className="btn btn-gold">
            Ver servicios
          </Link>
        </div>
      )}
      {upcoming.length > 0 && <h2 className="ap-heading">Próximas</h2>}
      <div className="ap-list">
        {upcoming.map(a => {
          const digits = a.storePhone?.replace(/\D/g, "") ?? "";
          return (
            <article key={a.id} className="ap-card">
              <div className="ap-when">
                <strong>{timeLabel(a.startsAt)}</strong>
                <span>{dayLabel(panamaDayKey(new Date(a.startsAt)))}</span>
              </div>
              <div className="ap-body">
                <Link href={`/servicio/${a.serviceSlug}`}>
                  <h3>{a.serviceTitle}</h3>
                </Link>
                <span className="re-muted">
                  {a.storeName} · {a.priceLabel}
                </span>
                <div className="re-mine-actions">
                  {digits && (
                    <a
                      className="btn btn-outline"
                      href={`https://wa.me/${digits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Phone size={15} /> WhatsApp
                    </a>
                  )}
                  <button
                    className="btn btn-outline"
                    disabled={
                      cancel.isPending || new Date(a.startsAt).getTime() <= now
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Cancelar esta cita? La hora quedará libre para otra persona."
                        )
                      )
                        cancel.mutate({ id: a.id, reason: "" });
                    }}
                  >
                    Cancelar cita
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {past.length > 0 && (
        <h2 className="ap-heading">Anteriores y canceladas</h2>
      )}
      <ul className="ap-past">
        {past.map(a => (
          <li key={a.id}>
            <span>
              {dayLabel(panamaDayKey(new Date(a.startsAt)))},{" "}
              {timeLabel(a.startsAt)} · <strong>{a.serviceTitle}</strong> ·{" "}
              {a.storeName}
            </span>
            <StatusTag status={a.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────── Proveedor: horario y agenda ─────────────

type WindowRow = { weekday: number; start: string; end: string };

function AvailabilityEditor() {
  const utils = trpc.useUtils();
  const data = trpc.appointments.availability.useQuery();
  const save = trpc.appointments.saveAvailability.useMutation();
  const setBookable = trpc.appointments.setBookable.useMutation();
  const [rows, setRows] = useState<WindowRow[] | null>(null);
  const windows = rows ?? data.data?.windows ?? [];

  if (data.isLoading) return <p role="status">Cargando tu horario…</p>;
  if (data.error) return <p className="member-error">{data.error.message}</p>;

  const update = (i: number, patch: Partial<WindowRow>) =>
    setRows(windows.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ windows });
      setRows(null);
      await utils.appointments.availability.invalidate();
      toast.success(
        windows.length
          ? "Horario guardado"
          : "Horario vacío: se apagaron las citas"
      );
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  async function toggle(serviceId: number, bookable: boolean) {
    try {
      await setBookable.mutateAsync({ serviceId, bookable });
      await utils.appointments.availability.invalidate();
      toast.success(
        bookable
          ? "Los clientes ya pueden reservar cita en este servicio"
          : "Citas apagadas para este servicio"
      );
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <div className="ap-setup">
      <form className="re-form" onSubmit={submit}>
        <fieldset>
          <legend>Horario de atención (hora de Panamá)</legend>
          <p className="re-muted re-small">
            Los clientes solo pueden reservar dentro de estos horarios. Para
            pausar un día, quita su horario. Puedes poner dos horarios el mismo
            día (por ejemplo, mañana y tarde).
          </p>
          {weekdayOrder.map(weekday => {
            const dayRows = windows
              .map((w, i) => ({ w, i }))
              .filter(x => x.w.weekday === weekday);
            return (
              <div key={weekday} className="ap-weekday">
                <strong>{weekdayLabels[weekday]}</strong>
                <div className="ap-ranges">
                  {dayRows.length === 0 && (
                    <span className="re-muted re-small">Cerrado</span>
                  )}
                  {dayRows.map(({ w, i }) => (
                    <span key={i} className="ap-range">
                      <input
                        type="time"
                        step={900}
                        value={w.start}
                        onChange={e => update(i, { start: e.target.value })}
                        aria-label={`${weekdayLabels[weekday]}: abre`}
                        required
                      />
                      a
                      <input
                        type="time"
                        step={900}
                        value={w.end}
                        onChange={e => update(i, { end: e.target.value })}
                        aria-label={`${weekdayLabels[weekday]}: cierra`}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline ap-icon-btn"
                        aria-label="Quitar horario"
                        onClick={() =>
                          setRows(windows.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="ap-add"
                    onClick={() =>
                      setRows([
                        ...windows,
                        {
                          weekday,
                          start: dayRows.length ? "14:00" : "08:00",
                          end: dayRows.length ? "18:00" : "12:00",
                        },
                      ])
                    }
                  >
                    <Plus size={14} /> Agregar horario
                  </button>
                </div>
              </div>
            );
          })}
          <div className="re-form-actions">
            <button
              className="btn btn-gold"
              type="submit"
              disabled={save.isPending || rows === null}
            >
              {save.isPending ? "Guardando…" : "Guardar horario"}
            </button>
            {rows !== null && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setRows(null)}
              >
                Deshacer
              </button>
            )}
          </div>
        </fieldset>
      </form>
      <section className="re-form">
        <fieldset>
          <legend>Servicios con cita</legend>
          <p className="re-muted re-small">
            Activa «Reservar cita» en los servicios que se atienden con hora.
            Cada servicio necesita una duración (entre {MIN_BOOKABLE_MINUTES}{" "}
            min y {MAX_BOOKABLE_MINUTES / 60} h); la cambias en «Mis servicios».
          </p>
          {data.data?.services.length === 0 && (
            <p className="re-muted">Todavía no tienes servicios.</p>
          )}
          {data.data?.services.map(s => (
            <label key={s.id} className="ap-toggle">
              <input
                type="checkbox"
                checked={s.bookable}
                disabled={setBookable.isPending}
                onChange={e => void toggle(s.id, e.target.checked)}
              />
              <span>
                <strong>{s.title}</strong>
                <span className="re-muted re-small">
                  {s.durationMinutes
                    ? durationLabel(s.durationMinutes)
                    : "Sin duración"}
                  {s.status !== "published" ? " · No publicado" : ""}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>
    </div>
  );
}

export function ProviderAgendaPage() {
  const utils = trpc.useUtils();
  const agenda = trpc.appointments.agenda.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const [tab, setTab] = useState<"agenda" | "horario">("agenda");
  const refresh = () => void utils.appointments.agenda.invalidate();
  const cancel = trpc.appointments.cancel.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Cita cancelada. Avisamos al cliente por correo.");
    },
    onError: e => toast.error(e.message),
  });
  const close = trpc.appointments.close.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const now = Date.now();
  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof agenda.data>>();
    for (const a of agenda.data ?? []) {
      const key = panamaDayKey(new Date(a.startsAt));
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return Array.from(map.entries());
  }, [agenda.data]);
  const today = panamaDayKey(new Date());

  return (
    <div className="re-page container">
      <div className="re-hero">
        <div>
          <p className="eyebrow">PANEL DE VENDEDOR</p>
          <h1>Mi agenda</h1>
          <p className="re-muted">
            Tus citas de los próximos días. Los clientes reservan solos dentro
            de tu horario.
          </p>
        </div>
        <Link className="btn btn-outline" href="/vendedor/productos">
          ← Mi tienda
        </Link>
      </div>
      <nav className="seller-catalog-nav" aria-label="Agenda">
        <button
          type="button"
          className={tab === "agenda" ? "is-active" : ""}
          onClick={() => setTab("agenda")}
        >
          <CalendarDays size={17} /> Citas
        </button>
        <button
          type="button"
          className={tab === "horario" ? "is-active" : ""}
          onClick={() => setTab("horario")}
        >
          <Clock size={17} /> Horario y servicios
        </button>
      </nav>
      {tab === "horario" ? (
        <AvailabilityEditor />
      ) : (
        <>
          {agenda.isLoading && <p role="status">Cargando tu agenda…</p>}
          {agenda.error && (
            <p className="member-error">{agenda.error.message}</p>
          )}
          {agenda.data && agenda.data.length === 0 && (
            <div className="re-empty">
              <h2>Todavía no tienes citas</h2>
              <p>
                Define tu horario y activa «Reservar cita» en tus servicios.
              </p>
              <button
                className="btn btn-gold"
                onClick={() => setTab("horario")}
              >
                Configurar horario
              </button>
            </div>
          )}
          {groups.map(([day, items]) => (
            <section
              key={day}
              className={`ap-agenda-day ${day < today ? "is-past" : ""}`}
            >
              <h2>
                {day === today ? "Hoy · " : ""}
                {dayLabel(day)}
              </h2>
              <ul className="ap-agenda">
                {items.map(a => {
                  const started = new Date(a.startsAt).getTime() <= now;
                  const digits = a.clientPhone.replace(/\D/g, "");
                  return (
                    <li
                      key={a.id}
                      className={`ap-agenda-item ap-agenda-item--${a.status}`}
                    >
                      <span className="ap-agenda-time">
                        {timeLabel(a.startsAt)}
                        <small>a {timeLabel(a.endsAt)}</small>
                      </span>
                      <div>
                        <strong>{a.serviceTitle}</strong>
                        <span>
                          {a.clientName} ·{" "}
                          <a href={`tel:${a.clientPhone}`}>{a.clientPhone}</a>
                          {digits && (
                            <>
                              {" "}
                              ·{" "}
                              <a
                                href={`https://wa.me/${digits}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                WhatsApp
                              </a>
                            </>
                          )}
                        </span>
                        {a.note && <span className="ap-note">«{a.note}»</span>}
                        {a.status === "cancelled" && (
                          <span className="re-muted re-small">
                            Cancelada por{" "}
                            {a.cancelledBy === "client" ? "el cliente" : "ti"}
                            {a.cancelReason ? `: ${a.cancelReason}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="re-mine-actions">
                        {a.status !== "confirmed" ? (
                          <StatusTag status={a.status} />
                        ) : started ? (
                          <>
                            <button
                              className="btn btn-gold"
                              disabled={close.isPending}
                              onClick={() =>
                                close.mutate({ id: a.id, status: "completed" })
                              }
                            >
                              Atendida
                            </button>
                            <button
                              className="btn btn-outline"
                              disabled={close.isPending}
                              onClick={() =>
                                close.mutate({ id: a.id, status: "no_show" })
                              }
                            >
                              No vino
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-outline"
                            disabled={cancel.isPending}
                            onClick={() => {
                              const reason = window.prompt(
                                "¿Por qué cancelas? (se le envía al cliente)",
                                ""
                              );
                              if (reason !== null)
                                cancel.mutate({ id: a.id, reason });
                            }}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
