import { SectionShowcase } from "@/components/marketplace/SectionShowcase";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Clock, MapPin, Phone, Store } from "lucide-react";
import { toast } from "sonner";
import { provinceOptions } from "@shared/marketplace";
import {
  durationLabel,
  modalityLabels,
  serviceCategoryOptions,
  serviceModalities,
  servicePriceLabel,
  serviceTypeLabels,
  serviceTypes,
  type ServiceDTO,
} from "@shared/services";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMarket } from "@/contexts/MarketContext";
import "../realEstate/realEstate.css";
import "./services.css";
import FilterDrawer, { countActiveFilters } from "@/components/marketplace/FilterDrawer";
import { BookingBox } from "./AppointmentPages";
import FeaturedStrip from "@/components/marketplace/FeaturedStrip";

function ServiceCard({ s }: { s: ServiceDTO }) {
  return (
    <Link href={`/servicio/${s.slug}`} className="svc-card">
      <div className="svc-card-photo">
        {s.images[0] ? (
          <img src={s.images[0]} alt={s.title} loading="lazy" />
        ) : (
          <div className="re-card-nophoto">
            {serviceTypeLabels[s.serviceType]}
          </div>
        )}
        <span className="re-badge">{serviceTypeLabels[s.serviceType]}</span>
      </div>
      <div className="svc-card-body">
        {/* Cada servicio se presenta por su propio nombre; la tienda va en segundo plano */}
        <h3 className="svc-card-title">{s.title}</h3>
        <strong className="re-price">{servicePriceLabel(s)}</strong>
        <span className="svc-store">
          <Store size={13} /> {s.categoryLabel} · por {s.store.name}
        </span>
        <div className="svc-tags">
          {s.modalities.map(m => (
            <span key={m}>{modalityLabels[m]}</span>
          ))}
          {s.durationMinutes ? (
            <span>
              <Clock size={12} /> {durationLabel(s.durationMinutes)}
            </span>
          ) : null}
        </div>
        <span className="re-where">
          <MapPin size={14} /> {s.store.city}, {s.store.province}
        </span>
      </div>
    </Link>
  );
}

export function ServiceListPage() {
  const [f, setF] = useState({
    serviceType: "",
    categoryId: "",
    modality: "",
    province: "",
    q: "",
  });
  const [page, setPage] = useState(1);
  const set = (k: keyof typeof f, v: string) => {
    setF(x => ({ ...x, [k]: v }));
    setPage(1);
  };
  const query = useMemo(() => {
    const out: Record<string, unknown> = { page };
    for (const k of [
      "serviceType",
      "categoryId",
      "modality",
      "province",
    ] as const)
      if (f[k]) out[k] = f[k];
    if (f.q.trim()) out.q = f.q.trim();
    return out as Parameters<typeof trpc.services.list.useQuery>[0];
  }, [f, page]);
  const list = trpc.services.list.useQuery(query);
  return (
    <div className="re-page container">
      <SectionShowcase section="servicios" />
      <div className="re-hero">
        <div>
          <p className="eyebrow">SERVICIOS</p>
          <h1>Servicios cerca de ti</h1>
          <p className="re-muted">
            Clases, reparaciones, consultas, eventos y más. Solicita el servicio
            y el proveedor te contacta para coordinar.
          </p>
        </div>
        <Link href="/vender" className="btn btn-gold">
          Ofrece tus servicios
        </Link>
      </div>
      <FilterDrawer active={countActiveFilters(f)}>
      <form
        className="re-filters"
        onSubmit={e => e.preventDefault()}
        aria-label="Filtros"
      >
        <label>
          Tipo
          <select
            value={f.serviceType}
            onChange={e => set("serviceType", e.target.value)}
          >
            <option value="">Todos</option>
            {serviceTypes.map(t => (
              <option key={t} value={t}>
                {serviceTypeLabels[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoría
          <select
            value={f.categoryId}
            onChange={e => set("categoryId", e.target.value)}
          >
            <option value="">Todas</option>
            {serviceCategoryOptions.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Modalidad
          <select
            value={f.modality}
            onChange={e => set("modality", e.target.value)}
          >
            <option value="">Cualquiera</option>
            {serviceModalities.map(m => (
              <option key={m} value={m}>
                {modalityLabels[m]}
              </option>
            ))}
          </select>
        </label>
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
            placeholder="Plomero, clases de inglés, fotógrafo…"
          />
        </label>
      </form>
      </FilterDrawer>
      {list.isLoading && <p role="status">Buscando servicios…</p>}
      {list.error && (
        <p className="member-error" role="alert">
          {list.error.message}
        </p>
      )}
      {list.data && (
        <>
          <FeaturedStrip count={list.data.featured.length}>
            {list.data.featured.map((s: ServiceDTO) => (
              <ServiceCard key={`featured-${s.id}`} s={s} />
            ))}
          </FeaturedStrip>
          <p className="re-muted">
            {list.data.total} {list.data.total === 1 ? "servicio" : "servicios"}
          </p>
          {list.data.items.length === 0 ? (
            <div className="re-empty">
              <h2>Todavía no hay servicios con esos filtros</h2>
              <p>
                Prueba con otra categoría o provincia. ¿Ofreces un servicio?
                Abre tu tienda de servicios.
              </p>
              <Link href="/vender" className="btn btn-gold">
                Ofrecer mis servicios
              </Link>
            </div>
          ) : (
            <div className="svc-grid">
              {list.data.items.map((s: ServiceDTO) => (
                <ServiceCard key={s.id} s={s} />
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

export function ServiceDetailPage({ slug }: { slug: string }) {
  const auth = useAuth();
  const market = useMarket();
  const detail = trpc.services.detail.useQuery({ slug }, { retry: false });
  const send = trpc.services.requestService.useMutation();
  const [photo, setPhoto] = useState(0);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    message: "",
    preferredDate: "",
    province: "",
  });
  const [sent, setSent] = useState(false);
  if (detail.isLoading)
    return (
      <div className="re-page container">
        <p role="status">Cargando…</p>
      </div>
    );
  if (detail.error || !detail.data)
    return (
      <div className="re-page container re-empty">
        <h1>Este servicio ya no está disponible</h1>
        <Link href="/servicios" className="btn btn-gold">
          Ver otros servicios
        </Link>
      </div>
    );
  const s = detail.data;
  const digits = s.store.phone?.replace(/\D/g, "") ?? "";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send.mutateAsync({
        serviceId: s.id,
        name: form.name || auth.user?.name || "",
        phone: normalizePhone(form.phone),
        message: form.message,
        preferredDate: form.preferredDate,
        province: form.province || market.province || "Panamá",
      });
      setSent(true);
      toast.success("¡Solicitud enviada! El proveedor te contactará pronto.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar");
    }
  }
  const rows: Array<[string, string]> = [
    ["Tipo", serviceTypeLabels[s.serviceType]],
    [
      "Categoría",
      s.specialtyLabel
        ? `${s.categoryLabel} · ${s.specialtyLabel}`
        : s.categoryLabel,
    ],
    ["Modalidad", s.modalities.map(m => modalityLabels[m]).join(", ")],
    ...(s.durationMinutes
      ? [["Duración", durationLabel(s.durationMinutes)] as [string, string]]
      : []),
    ...(s.coverageProvinces.length
      ? [
          ["Va a domicilio en", s.coverageProvinces.join(", ")] as [
            string,
            string,
          ],
        ]
      : []),
    ...(s.schedule ? [["Horario", s.schedule] as [string, string]] : []),
  ];
  return (
    <div className="re-page container">
      <nav className="re-crumbs" aria-label="Ruta">
        <Link href="/servicios">Servicios</Link> / <span>{s.title}</span>
      </nav>
      <div className="re-detail">
        <div>
          <div className="re-gallery">
            {s.images[photo] ? (
              <img
                src={s.images[photo]}
                alt={`${s.title}, foto ${photo + 1}`}
              />
            ) : (
              <div className="re-card-nophoto">
                {serviceTypeLabels[s.serviceType]}
              </div>
            )}
          </div>
          {s.images.length > 1 && (
            <div className="re-thumbs">
              {s.images.map((src, i) => (
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
            <h2>Descripción</h2>
            <p className="re-description">{s.description}</p>
          </section>
        </div>
        <aside className="re-aside">
          <span className="re-badge re-badge--inline">
            {serviceTypeLabels[s.serviceType]}
          </span>
          <h1>{s.title}</h1>
          <strong className="re-price re-price--big">
            {servicePriceLabel(s)}
          </strong>
          <p className="svc-store">
            <Store size={14} /> {s.store.name} · <MapPin size={14} />{" "}
            {s.store.city}, {s.store.province}
          </p>
          <dl className="re-table">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {digits && (
            <div className="re-contact">
              <a
                className="btn btn-gold"
                href={`https://wa.me/${digits}?text=${encodeURIComponent(`Hola, vi su servicio en CuadraZone: ${s.title}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a className="btn btn-outline" href={`tel:${s.store.phone}`}>
                <Phone size={16} /> Llamar
              </a>
            </div>
          )}
          {s.bookable && auth.user && <BookingBox service={s} />}
          <hr />
          {sent ? (
            <div className="re-plan re-plan--ok">
              <p>
                <strong>Solicitud enviada.</strong> {s.store.name} recibió tu
                mensaje y te contactará al celular que dejaste.
              </p>
            </div>
          ) : !auth.user ? (
            <button className="btn btn-outline" onClick={startLogin}>
              Entra para solicitar este servicio
            </button>
          ) : (
            <form className="svc-request" onSubmit={submit}>
              <strong>
                {s.bookable
                  ? "¿Prefieres pedir información o una cotización?"
                  : "Solicitar este servicio"}
              </strong>
              <label>
                Tu nombre
                <input
                  value={form.name || auth.user.name || ""}
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
                  onChange={e =>
                    setForm(f => ({ ...f, phone: e.target.value }))
                  }
                  required
                  placeholder="6123-4567"
                />
              </label>
              <label>
                ¿Qué necesitas?
                <textarea
                  value={form.message}
                  onChange={e =>
                    setForm(f => ({ ...f, message: e.target.value }))
                  }
                  required
                  minLength={10}
                  maxLength={1500}
                  placeholder="Describe lo que necesitas, dónde y cuándo."
                />
              </label>
              <label>
                Fecha preferida (opcional)
                <input
                  type="date"
                  value={form.preferredDate}
                  onChange={e =>
                    setForm(f => ({ ...f, preferredDate: e.target.value }))
                  }
                />
              </label>
              <label>
                Tu provincia
                <select
                  value={form.province || market.province || "Panamá"}
                  onChange={e =>
                    setForm(f => ({ ...f, province: e.target.value }))
                  }
                >
                  {provinceOptions.map(p => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-gold"
                type="submit"
                disabled={send.isPending}
              >
                {send.isPending ? "Enviando…" : "Enviar solicitud"}
              </button>
              <p className="re-muted re-small">
                El pago se acuerda directamente con el proveedor. Nunca pagues
                por adelantado a alguien que no conoces.
              </p>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
