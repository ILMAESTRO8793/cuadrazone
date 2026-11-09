import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { CalendarDays, MapPin, Store, Ticket } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { provinceOptions } from "@shared/marketplace";
import {
  MAX_TICKETS_PER_ORDER,
  RESERVATION_HOURS,
  eventDateLabel,
  moneyLabel,
  ticketOrderStatusLabels,
  ticketQrPayload,
  type EventDTO,
} from "@shared/events";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import FilterDrawer, {
  countActiveFilters,
} from "@/components/marketplace/FilterDrawer";
import { CommerceNav } from "../commerce/BuyerPages";
import "../realEstate/realEstate.css";
import "../services/services.css";
import "./events.css";

type MyOrder = inferRouterOutputs<AppRouter>["events"]["myTickets"][number];
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

/** «20 DIC» para la etiqueta de fecha de las tarjetas. */
function dateChip(iso: string) {
  const parts = new Intl.DateTimeFormat("es-PA", {
    timeZone: "America/Panama",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(iso));
  return {
    day: parts.find(p => p.type === "day")?.value ?? "",
    month: (parts.find(p => p.type === "month")?.value ?? "")
      .replace(".", "")
      .toUpperCase(),
  };
}

export function priceFrom(e: Pick<EventDTO, "minPriceCents" | "ticketTypes">) {
  if (!e.ticketTypes.length) return "";
  const allSame = e.ticketTypes.every(t => t.priceCents === e.minPriceCents);
  return e.minPriceCents === 0 && allSame
    ? "Gratis"
    : `${allSame ? "" : "Desde "}${moneyLabel(e.minPriceCents)}`;
}

function EventCard({ e }: { e: EventDTO }) {
  const chip = dateChip(e.startsAt);
  return (
    <Link href={`/evento/${e.slug}`} className="svc-card ev-card">
      <div className="svc-card-photo">
        {e.images[0] ? (
          <img src={e.images[0]} alt={e.title} loading="lazy" />
        ) : (
          <div className="re-card-nophoto">Evento</div>
        )}
        <span className="ev-date-chip" aria-hidden="true">
          <strong>{chip.day}</strong>
          {chip.month}
        </span>
        {e.soldOut && <span className="re-badge re-badge--gold">Agotado</span>}
      </div>
      <div className="svc-card-body">
        <h3 className="svc-card-title">{e.title}</h3>
        {e.artist && <span className="ev-artist">{e.artist}</span>}
        <strong className="re-price">{priceFrom(e)}</strong>
        <span className="svc-store">
          <CalendarDays size={13} /> {eventDateLabel(e.startsAt)}
        </span>
        <span className="re-where">
          <MapPin size={14} /> {e.venueName}
          {e.city ? `, ${e.city}` : ""} · {e.province}
        </span>
      </div>
    </Link>
  );
}

export function EventListPage() {
  const [f, setF] = useState({ province: "", q: "" });
  const [page, setPage] = useState(1);
  const set = (k: keyof typeof f, v: string) => {
    setF(x => ({ ...x, [k]: v }));
    setPage(1);
  };
  const query = useMemo(() => {
    const out: Record<string, unknown> = { page };
    if (f.province) out.province = f.province;
    if (f.q.trim()) out.q = f.q.trim();
    return out as Parameters<typeof trpc.events.list.useQuery>[0];
  }, [f, page]);
  const list = trpc.events.list.useQuery(query);
  return (
    <div className="re-page container">
      <div className="re-hero">
        <div>
          <p className="eyebrow">EVENTOS</p>
          <h1>Conciertos, conferencias y encuentros</h1>
          <p className="re-muted">
            Aparta tus boletos y recíbelos con código QR. Pagas directo al
            organizador.
          </p>
        </div>
        <Link href="/mis-boletos" className="btn btn-outline">
          <Ticket size={16} /> Mis boletos
        </Link>
      </div>
      <FilterDrawer active={countActiveFilters(f)}>
        <form
          className="re-filters"
          onSubmit={e => e.preventDefault()}
          aria-label="Filtros"
        >
          <label>
            Provincia
            <select
              value={f.province}
              onChange={e => set("province", e.target.value)}
            >
              <option value="">Todas</option>
              {provinceOptions.map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="re-search filter-keep">
            Buscar
            <input
              className="svc-input"
              value={f.q}
              onChange={e => set("q", e.target.value)}
              placeholder="Concierto, artista, lugar…"
            />
          </label>
        </form>
      </FilterDrawer>
      {list.isLoading && <p role="status">Buscando eventos…</p>}
      {list.error && (
        <p className="member-error" role="alert">
          {list.error.message}
        </p>
      )}
      {list.data && (
        <>
          <p className="re-muted">
            {list.data.total} {list.data.total === 1 ? "evento" : "eventos"}
          </p>
          {list.data.items.length === 0 ? (
            <div className="re-empty">
              <h2>Todavía no hay eventos próximos</h2>
              <p>
                ¿Organizas un concierto o una conferencia? Publícalo desde tu
                tienda.
              </p>
              <Link href="/vendedor/eventos" className="btn btn-gold">
                Publicar un evento
              </Link>
            </div>
          ) : (
            <div className="svc-grid">
              {list.data.items.map((e: EventDTO) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          )}
          {list.data.total > list.data.pageSize && (
            <div className="re-pager">
              <button
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </button>
              <span>
                Página {page} de{" "}
                {Math.ceil(list.data.total / list.data.pageSize)}
              </span>
              <button
                className="btn btn-outline"
                disabled={page * list.data.pageSize >= list.data.total}
                onClick={() => setPage(p => p + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function normalizePhone(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 8
    ? `+507${d}`
    : d.length === 11 && d.startsWith("507")
      ? `+${d}`
      : v.trim();
}

export function EventDetailPage({ slug }: { slug: string }) {
  const auth = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const detail = trpc.events.detail.useQuery({ slug }, { retry: false });
  const reserve = trpc.events.reserve.useMutation();
  const [photo, setPhoto] = useState(0);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "" });
  if (detail.isLoading)
    return (
      <div className="re-page container">
        <p role="status">Cargando…</p>
      </div>
    );
  if (detail.error || !detail.data)
    return (
      <div className="re-page container re-empty">
        <h1>Este evento ya no está disponible</h1>
        <Link href="/eventos" className="btn btn-gold">
          Ver otros eventos
        </Link>
      </div>
    );
  const e = detail.data;
  const started = new Date(e.startsAt) <= new Date();
  const selected = e.ticketTypes.find(
    t => t.id === (typeId ?? e.ticketTypes.find(x => x.available > 0)?.id)
  );
  const maxQty = Math.min(MAX_TICKETS_PER_ORDER, selected?.available ?? 0);
  const total = (selected?.priceCents ?? 0) * quantity;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!selected) return;
    try {
      const result = await reserve.mutateAsync({
        ticketTypeId: selected.id,
        quantity,
        buyerName: form.name || auth.user?.name || "",
        buyerPhone: normalizePhone(form.phone),
      });
      await utils.events.myTickets.invalidate();
      toast.success(
        result.status === "paid"
          ? "¡Listo! Tus boletos con QR ya están en «Mis boletos»."
          : `Boletos apartados. Paga al organizador en ${RESERVATION_HOURS} horas; ves sus datos en «Mis boletos».`
      );
      navigate("/mis-boletos");
    } catch (error) {
      toast.error(errorText(error));
      void detail.refetch();
    }
  }

  return (
    <div className="re-page container">
      <nav className="re-crumbs" aria-label="Ruta">
        <Link href="/eventos">Eventos</Link> / <span>{e.title}</span>
      </nav>
      <div className="re-detail">
        <div>
          <div className="re-gallery">
            {e.images[photo] ? (
              <img
                src={e.images[photo]}
                alt={`${e.title}, foto ${photo + 1}`}
              />
            ) : (
              <div className="re-card-nophoto">Evento</div>
            )}
          </div>
          {e.images.length > 1 && (
            <div className="re-thumbs">
              {e.images.map((src, i) => (
                <button
                  key={src}
                  className={i === photo ? "is-active" : ""}
                  onClick={() => setPhoto(i)}
                  aria-label={`Ver foto ${i + 1}`}
                >
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <section className="re-section">
            <h2>Sobre el evento</h2>
            <p className="re-description">{e.description}</p>
          </section>
        </div>
        <aside className="re-aside">
          {e.artist && (
            <span className="re-badge re-badge--inline">{e.artist}</span>
          )}
          <h1>{e.title}</h1>
          <p className="ev-when">
            <CalendarDays size={16} /> {eventDateLabel(e.startsAt)}
          </p>
          <p className="svc-store">
            <MapPin size={14} /> {e.venueName}
            {e.address ? `, ${e.address}` : ""}
            {e.city ? `, ${e.city}` : ""} · {e.province}
            {e.mapUrl && (
              <>
                {" "}
                ·{" "}
                <a href={e.mapUrl} target="_blank" rel="noopener noreferrer">
                  Ver mapa
                </a>
              </>
            )}
          </p>
          <p className="svc-store">
            <Store size={14} /> Organiza{" "}
            <Link href={`/tiendas/${e.store.slug}`}>{e.store.name}</Link>
          </p>
          <hr />
          {started ? (
            <div className="re-plan">
              <p>Este evento ya empezó; no se pueden apartar más boletos.</p>
            </div>
          ) : e.soldOut ? (
            <div className="re-plan">
              <p>
                <strong>Agotado.</strong> Se liberan boletos si alguien no paga
                su reserva a tiempo: vuelve más tarde.
              </p>
            </div>
          ) : (
            <form className="svc-request" onSubmit={submit}>
              <strong>Elige tus entradas</strong>
              <div
                className="ev-types"
                role="radiogroup"
                aria-label="Tipo de entrada"
              >
                {e.ticketTypes.map(t => (
                  <label
                    key={t.id}
                    className={`ev-type ${selected?.id === t.id ? "is-active" : ""} ${t.available === 0 ? "is-off" : ""}`}
                  >
                    <input
                      type="radio"
                      name="ticketType"
                      checked={selected?.id === t.id}
                      disabled={t.available === 0}
                      onChange={() => {
                        setTypeId(t.id);
                        setQuantity(1);
                      }}
                    />
                    <span className="ev-type-name">{t.name}</span>
                    <strong>{moneyLabel(t.priceCents)}</strong>
                    <span className="ev-type-left">
                      {t.available === 0
                        ? "Agotado"
                        : t.available <= 20
                          ? `Quedan ${t.available}`
                          : "Disponible"}
                    </span>
                  </label>
                ))}
              </div>
              <label>
                Cantidad
                <select
                  value={quantity}
                  onChange={ev => setQuantity(Number(ev.target.value))}
                >
                  {Array.from(
                    { length: Math.max(1, maxQty) },
                    (_, i) => i + 1
                  ).map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nombre para los boletos
                <input
                  value={form.name || auth.user?.name || ""}
                  onChange={ev =>
                    setForm(f => ({ ...f, name: ev.target.value }))
                  }
                  required
                  maxLength={120}
                />
              </label>
              <label>
                Tu celular
                <input
                  inputMode="tel"
                  value={form.phone}
                  onChange={ev =>
                    setForm(f => ({ ...f, phone: ev.target.value }))
                  }
                  required
                  placeholder="6123-4567"
                />
              </label>
              <p className="ev-total">
                Total: <strong>{moneyLabel(total)}</strong>
              </p>
              <button
                className="btn btn-gold"
                type="submit"
                disabled={reserve.isPending || !selected || maxQty === 0}
              >
                {reserve.isPending
                  ? "Apartando…"
                  : total === 0
                    ? "Obtener boletos gratis"
                    : "Apartar boletos"}
              </button>
              <p className="re-muted re-small">
                {total === 0
                  ? "Recibes tus boletos con código QR al instante."
                  : `Se apartan por ${RESERVATION_HOURS} horas. Pagas directo al organizador (Yappy, transferencia o efectivo) y, cuando confirme tu pago, recibes los boletos con QR.`}
              </p>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

// ───────────── Mis boletos ─────────────

function TicketQr({ code, used }: { code: string; used: boolean }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(ticketQrPayload(code), {
      margin: 1,
      width: 240,
      errorCorrectionLevel: "M",
    })
      .then(url => alive && setSrc(url))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [code]);
  return (
    <figure className={`ev-qr ${used ? "is-used" : ""}`}>
      {src ? (
        <img
          src={src}
          alt={`Código QR del boleto ${code}`}
          width={200}
          height={200}
        />
      ) : (
        <div className="ev-qr-placeholder" />
      )}
      <figcaption>
        <code>{code.replace(/(.{5})/g, "$1 ").trim()}</code>
        {used && <span>Usado</span>}
      </figcaption>
    </figure>
  );
}

function PaymentBox({ o }: { o: MyOrder }) {
  const digits = o.organizer.phone?.replace(/\D/g, "") ?? "";
  return (
    <div className="ev-pay">
      <p>
        Paga <strong>{moneyLabel(o.totalCents)}</strong> a{" "}
        <strong>{o.organizer.name}</strong>
        {o.expiresAt ? ` antes del ${eventDateLabel(o.expiresAt)}` : ""}. Cuando
        confirme tu pago, aquí aparecen tus boletos con QR.
      </p>
      <dl className="re-table">
        {o.organizer.yappyPhone && (
          <div>
            <dt>Yappy</dt>
            <dd>{o.organizer.yappyPhone}</dd>
          </div>
        )}
        {o.organizer.yappyDirectory && (
          <div>
            <dt>Directorio Yappy</dt>
            <dd>{o.organizer.yappyDirectory}</dd>
          </div>
        )}
        {o.organizer.phone && (
          <div>
            <dt>Celular del organizador</dt>
            <dd>{o.organizer.phone}</dd>
          </div>
        )}
      </dl>
      <div className="re-contact">
        {o.organizer.cardPaymentUrl &&
          /^https:\/\//.test(o.organizer.cardPaymentUrl) && (
            <a
              className="btn btn-outline"
              href={o.organizer.cardPaymentUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Pagar con tarjeta
            </a>
          )}
        {digits && (
          <a
            className="btn btn-gold"
            href={`https://wa.me/${digits}?text=${encodeURIComponent(`Hola, aparté ${o.quantity} boleto(s) «${o.typeName}» para ${o.event.title} en CuadraZone. Te envío el comprobante de pago.`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Enviar comprobante por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export function MyTicketsPage() {
  const utils = trpc.useUtils();
  const orders = trpc.events.myTickets.useQuery();
  const cancel = trpc.events.cancelOrder.useMutation({
    onSuccess: () => {
      void utils.events.myTickets.invalidate();
      toast.success("Reserva cancelada");
    },
    onError: e => toast.error(e.message),
  });
  return (
    <div className="live-page container">
      <CommerceNav />
      <p className="eyebrow">EVENTOS</p>
      <h1>Mis boletos</h1>
      {orders.isLoading && <p role="status">Cargando tus boletos…</p>}
      {orders.error && (
        <p className="member-error" role="alert">
          {orders.error.message}
        </p>
      )}
      {orders.data?.length === 0 && (
        <div className="re-empty">
          <h2>Todavía no tienes boletos</h2>
          <Link href="/eventos" className="btn btn-gold">
            Ver eventos
          </Link>
        </div>
      )}
      <div className="ev-orders">
        {orders.data?.map(o => (
          <article key={o.id} className={`ev-order ev-order--${o.status}`}>
            <header>
              <div>
                <Link href={`/evento/${o.event.slug}`}>
                  <h2>{o.event.title}</h2>
                </Link>
                <p className="svc-store">
                  <CalendarDays size={14} /> {eventDateLabel(o.event.startsAt)}{" "}
                  · <MapPin size={14} /> {o.event.venueName}
                  {o.event.city ? `, ${o.event.city}` : ""}
                  {o.event.mapUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={o.event.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Mapa
                      </a>
                    </>
                  )}
                </p>
                <p className="re-muted">
                  {o.quantity} × {o.typeName} · {moneyLabel(o.totalCents)}
                </p>
              </div>
              <span className={`ev-status ev-status--${o.status}`}>
                {o.event.status === "cancelled"
                  ? "Evento cancelado"
                  : ticketOrderStatusLabels[o.status]}
              </span>
            </header>
            {o.status === "reserved" && (
              <>
                <PaymentBox o={o} />
                <button
                  className="btn btn-outline"
                  disabled={cancel.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "¿Cancelar esta reserva? Los boletos se liberan para otras personas."
                      )
                    )
                      cancel.mutate({ id: o.id });
                  }}
                >
                  Cancelar reserva
                </button>
              </>
            )}
            {o.status === "paid" && (
              <>
                <p className="re-muted re-small">
                  Muestra cada código en la entrada. Cada boleto vale una sola
                  vez; no compartas capturas.
                </p>
                <div className="ev-qr-grid">
                  {o.tickets
                    .filter(t => t.status !== "cancelled")
                    .map(t => (
                      <TicketQr
                        key={t.code}
                        code={t.code}
                        used={t.status === "used"}
                      />
                    ))}
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
