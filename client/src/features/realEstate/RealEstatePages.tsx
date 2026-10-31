import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Bath, BedDouble, Car as CarIcon, MapPin, Maximize2, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { provinceOptions } from "@shared/marketplace";
import {
  MAX_PROPERTY_IMAGES,
  amenityLabels,
  hasRooms,
  landUseLabels,
  operationLabels,
  priceLabel,
  propertyAmenities,
  propertyTypeLabels,
  propertyTypes,
  statusLabels,
  usd,
  type OwnPropertyDTO,
  type PropertyDTO,
  type PropertyOperation,
  type PropertyType,
} from "@shared/realEstate";
import { trpc } from "@/lib/trpc";
import { AuthGate } from "@/features/membership/AuthGate";
import { Input } from "@/components/ui/input";
import "./realEstate.css";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error");
const centsFrom = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
const intFrom = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v))) || 0);

// ───────────── Tarjeta ─────────────

function PropertyCard({ p }: { p: PropertyDTO }) {
  return (
    <Link href={`/bienes-raices/${p.slug}`} className={`re-card ${p.featured ? "re-card--featured" : ""}`}>
      <div className="re-card-photo">
        {p.images[0] ? <img src={p.images[0]} alt={p.title} loading="lazy" /> : <div className="re-card-nophoto">Sin foto</div>}
        <span className="re-badge">{operationLabels[p.operation]}</span>
        {p.featured && <span className="re-badge re-badge--gold"><Star size={12} /> Destacado</span>}
      </div>
      <div className="re-card-body">
        <strong className="re-price">{priceLabel(p)}</strong>
        <h3>{p.title}</h3>
        <p className="re-where"><MapPin size={14} /> {propertyTypeLabels[p.propertyType]} · {[p.neighborhood, p.district, p.province].filter(Boolean).join(", ")}</p>
        <div className="re-specs">
          {p.bedrooms != null && <span><BedDouble size={14} /> {p.bedrooms} hab.</span>}
          {p.bathrooms != null && <span><Bath size={14} /> {p.bathrooms} baños</span>}
          {p.parking ? <span><CarIcon size={14} /> {p.parking}</span> : null}
          {(p.areaBuiltM2 ?? p.areaLandM2) != null && <span><Maximize2 size={14} /> {p.areaBuiltM2 ?? p.areaLandM2} m²</span>}
        </div>
      </div>
    </Link>
  );
}

// ───────────── Búsqueda ─────────────

export function RealEstateListPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const op = params.get("op");
  const [filters, setFilters] = useState({
    operation: (op === "venta" || op === "alquiler" ? op : "") as "" | PropertyOperation,
    propertyType: "" as "" | PropertyType,
    province: "",
    minPrice: "",
    maxPrice: "",
    minBedrooms: "",
    furnished: false,
    petsAllowed: false,
    q: "",
  });
  useEffect(() => {
    setFilters(f => ({ ...f, operation: (op === "venta" || op === "alquiler" ? op : "") as "" | PropertyOperation }));
  }, [op]);
  const [page, setPage] = useState(1);
  const query = useMemo(
    () => ({
      ...(filters.operation ? { operation: filters.operation } : {}),
      ...(filters.propertyType ? { propertyType: filters.propertyType } : {}),
      ...(filters.province ? { province: filters.province as (typeof provinceOptions)[number] } : {}),
      ...(centsFrom(filters.minPrice) ? { minPriceCents: centsFrom(filters.minPrice)! } : {}),
      ...(centsFrom(filters.maxPrice) ? { maxPriceCents: centsFrom(filters.maxPrice)! } : {}),
      ...(filters.minBedrooms ? { minBedrooms: Number(filters.minBedrooms) } : {}),
      ...(filters.furnished ? { furnished: true } : {}),
      ...(filters.petsAllowed ? { petsAllowed: true } : {}),
      ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
      page,
    }),
    [filters, page]
  );
  const list = trpc.realEstate.list.useQuery(query);
  const set = <K extends keyof typeof filters>(k: K, v: (typeof filters)[K]) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  return (
    <div className="re-page container">
      <div className="re-hero">
        <div>
          <p className="eyebrow">BIENES RAÍCES</p>
          <h1>{filters.operation === "alquiler" ? "Alquila tu próximo hogar" : filters.operation === "venta" ? "Encuentra tu propiedad" : "Casas, apartamentos y terrenos"}</h1>
          <p className="re-muted">Venta y alquiler en todo Panamá, publicados por dueños y agentes.</p>
        </div>
        <Link href="/bienes-raices/mis-anuncios" className="btn btn-gold">Publicar un anuncio</Link>
      </div>

      <div className="re-tabs" role="tablist" aria-label="Operación">
        {(["", "venta", "alquiler"] as const).map(v => (
          <button key={v || "todos"} role="tab" aria-selected={filters.operation === v} className={filters.operation === v ? "is-active" : ""}
            onClick={() => navigate(v ? `/bienes-raices?op=${v}` : "/bienes-raices")}>
            {v === "" ? "Todos" : v === "venta" ? "Comprar" : "Alquilar"}
          </button>
        ))}
      </div>

      <form className="re-filters" onSubmit={e => e.preventDefault()} aria-label="Filtros">
        <label>Tipo
          <select value={filters.propertyType} onChange={e => set("propertyType", e.target.value as PropertyType | "")}>
            <option value="">Todos</option>
            {propertyTypes.map(t => <option key={t} value={t}>{propertyTypeLabels[t]}</option>)}
          </select>
        </label>
        <label>Provincia
          <select value={filters.province} onChange={e => set("province", e.target.value)}>
            <option value="">Todas</option>
            {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>Precio desde (US$)<Input inputMode="decimal" value={filters.minPrice} onChange={e => set("minPrice", e.target.value)} placeholder="0" /></label>
        <label>Precio hasta (US$)<Input inputMode="decimal" value={filters.maxPrice} onChange={e => set("maxPrice", e.target.value)} placeholder="Sin límite" /></label>
        <label>Habitaciones
          <select value={filters.minBedrooms} onChange={e => set("minBedrooms", e.target.value)}>
            <option value="">Cualquiera</option>
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}
          </select>
        </label>
        <label className="re-search">Buscar<Input value={filters.q} onChange={e => set("q", e.target.value)} placeholder="Barrio, distrito o palabra" /></label>
        <label className="re-check"><input type="checkbox" checked={filters.furnished} onChange={e => set("furnished", e.target.checked)} /> Amueblado</label>
        <label className="re-check"><input type="checkbox" checked={filters.petsAllowed} onChange={e => set("petsAllowed", e.target.checked)} /> Acepta mascotas</label>
      </form>

      {list.isLoading && <p role="status">Buscando propiedades…</p>}
      {list.error && <p className="member-error" role="alert">{list.error.message}</p>}
      {list.data && (
        <>
          <p className="re-muted">{list.data.total} {list.data.total === 1 ? "propiedad" : "propiedades"}</p>
          {list.data.items.length === 0 ? (
            <div className="re-empty">
              <h2>Todavía no hay propiedades con esos filtros</h2>
              <p>Prueba con otra provincia o tipo, o sé el primero en publicar.</p>
              <Link href="/bienes-raices/mis-anuncios" className="btn btn-gold">Publicar un anuncio</Link>
            </div>
          ) : (
            <div className="re-grid">{list.data.items.map(p => <PropertyCard key={p.id} p={p} />)}</div>
          )}
          {list.data.total > list.data.pageSize && (
            <div className="re-pager">
              <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
              <span>Página {page} de {Math.ceil(list.data.total / list.data.pageSize)}</span>
              <button className="btn btn-outline" disabled={page * list.data.pageSize >= list.data.total} onClick={() => setPage(p => p + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ───────────── Ficha ─────────────

export function RealEstateDetailPage({ slug }: { slug: string }) {
  const detail = trpc.realEstate.detail.useQuery({ slug }, { retry: false });
  const [photo, setPhoto] = useState(0);
  if (detail.isLoading) return <div className="re-page container"><p role="status">Cargando…</p></div>;
  if (detail.error || !detail.data)
    return (
      <div className="re-page container re-empty">
        <h1>Este anuncio ya no está disponible</h1>
        <Link href="/bienes-raices" className="btn btn-gold">Ver otras propiedades</Link>
      </div>
    );
  const p = detail.data;
  const phone = p.contactPhone;
  const digits = phone?.replace(/\D/g, "");
  const rows: Array<[string, string]> = [
    ["Operación", operationLabels[p.operation]],
    ["Tipo", propertyTypeLabels[p.propertyType]],
    ...(p.bedrooms != null ? [["Habitaciones", String(p.bedrooms)] as [string, string]] : []),
    ...(p.bathrooms != null ? [["Baños", String(p.bathrooms)] as [string, string]] : []),
    ...(p.parking != null ? [["Estacionamientos", String(p.parking)] as [string, string]] : []),
    ...(p.areaBuiltM2 != null ? [["Construcción", `${p.areaBuiltM2} m²`] as [string, string]] : []),
    ...(p.areaLandM2 != null ? [["Terreno", `${p.areaLandM2} m²`] as [string, string]] : []),
    ...(p.floor != null ? [["Piso", String(p.floor)] as [string, string]] : []),
    ...(p.landUse ? [["Uso de suelo", landUseLabels[p.landUse]] as [string, string]] : []),
    ...(p.operation === "alquiler" && p.depositCents != null ? [["Depósito", usd(p.depositCents)] as [string, string]] : []),
    ...(p.operation === "alquiler" && p.minLeaseMonths ? [["Contrato mínimo", `${p.minLeaseMonths} meses`] as [string, string]] : []),
    ...(hasRooms(p.propertyType) ? [["Amueblado", p.furnished ? "Sí" : "No"] as [string, string]] : []),
    ...(p.operation === "alquiler" ? [["Acepta mascotas", p.petsAllowed ? "Sí" : "No"] as [string, string]] : []),
    ...(p.propertyType === "terreno" ? [["Título de propiedad", p.hasTitle ? "Sí" : "No"] as [string, string], ["Agua", p.hasWater ? "Sí" : "No"] as [string, string], ["Luz", p.hasPower ? "Sí" : "No"] as [string, string]] : []),
    ["Publicado por", p.advertiserType === "agente" ? "Agente inmobiliario" : "Dueño"],
  ];
  return (
    <div className="re-page container">
      <nav className="re-crumbs" aria-label="Ruta"><Link href="/bienes-raices">Bienes raíces</Link> / <span>{p.title}</span></nav>
      <div className="re-detail">
        <div>
          <div className="re-gallery">
            {p.images[photo] ? <img src={p.images[photo]} alt={`${p.title}, foto ${photo + 1}`} /> : <div className="re-card-nophoto">Sin foto</div>}
            {p.featured && <span className="re-badge re-badge--gold"><Star size={12} /> Destacado</span>}
          </div>
          {p.images.length > 1 && (
            <div className="re-thumbs">
              {p.images.map((src, i) => (
                <button key={src} className={i === photo ? "is-active" : ""} onClick={() => setPhoto(i)} aria-label={`Ver foto ${i + 1}`}>
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <section className="re-section">
            <h2>Descripción</h2>
            <p className="re-description">{p.description}</p>
          </section>
          {p.amenities.length > 0 && (
            <section className="re-section">
              <h2>Comodidades</h2>
              <ul className="re-amenities">{p.amenities.map(a => <li key={a}>{amenityLabels[a]}</li>)}</ul>
            </section>
          )}
        </div>
        <aside className="re-aside">
          <span className="re-badge re-badge--inline">{operationLabels[p.operation]}</span>
          <h1>{p.title}</h1>
          <strong className="re-price re-price--big">{priceLabel(p)}</strong>
          <p className="re-where"><MapPin size={15} /> {[p.neighborhood, p.district, p.province].filter(Boolean).join(", ")}</p>
          <dl className="re-table">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {phone ? (
            <div className="re-contact">
              <a className="btn btn-gold" href={`https://wa.me/${digits}?text=${encodeURIComponent(`Hola, vi su anuncio en CuadraZone: ${p.title}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a className="btn btn-outline" href={`tel:${phone}`}><Phone size={16} /> Llamar</a>
            </div>
          ) : (
            <p className="re-muted">El anunciante no publicó su teléfono.</p>
          )}
          <p className="re-muted re-small">Nunca pagues ni transfieras dinero antes de ver la propiedad y verificar los documentos.</p>
        </aside>
      </div>
    </div>
  );
}

// ───────────── Mis anuncios y editor ─────────────

type Form = {
  id?: number; expectedRevision?: number; operation: PropertyOperation; propertyType: PropertyType; title: string; description: string;
  price: string; deposit: string; minLeaseMonths: string; province: string; district: string; neighborhood: string;
  areaBuiltM2: string; areaLandM2: string; bedrooms: string; bathrooms: string; parking: string; floor: string;
  furnished: boolean; petsAllowed: boolean; landUse: string; hasTitle: boolean; hasWater: boolean; hasPower: boolean;
  amenities: string[]; advertiserType: "dueno" | "agente"; contactPhone: string; images: string[];
};
const emptyForm: Form = {
  operation: "venta", propertyType: "casa", title: "", description: "", price: "", deposit: "", minLeaseMonths: "", province: "Panamá",
  district: "", neighborhood: "", areaBuiltM2: "", areaLandM2: "", bedrooms: "", bathrooms: "", parking: "", floor: "",
  furnished: false, petsAllowed: false, landUse: "", hasTitle: false, hasWater: false, hasPower: false, amenities: [], advertiserType: "dueno",
  contactPhone: "", images: [],
};
const str = (n: number | null) => (n == null ? "" : String(n));
function formFrom(p: OwnPropertyDTO): Form {
  return {
    id: p.id, expectedRevision: p.revision, operation: p.operation, propertyType: p.propertyType, title: p.title, description: p.description,
    price: String(p.priceCents / 100), deposit: p.depositCents == null ? "" : String(p.depositCents / 100), minLeaseMonths: str(p.minLeaseMonths),
    province: p.province, district: p.district, neighborhood: p.neighborhood, areaBuiltM2: str(p.areaBuiltM2), areaLandM2: str(p.areaLandM2),
    bedrooms: str(p.bedrooms), bathrooms: str(p.bathrooms), parking: str(p.parking), floor: str(p.floor), furnished: p.furnished,
    petsAllowed: p.petsAllowed, landUse: p.landUse ?? "", hasTitle: p.hasTitle, hasWater: p.hasWater, hasPower: p.hasPower,
    amenities: p.amenities, advertiserType: p.advertiserType, contactPhone: p.contactPhoneRaw, images: p.images,
  };
}
function normalizePhone(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 8 ? `+507${d}` : d.length === 11 && d.startsWith("507") ? `+${d}` : v.trim();
}

export function RealEstateMinePage() {
  return <AuthGate><MineContent /></AuthGate>;
}

function MineContent() {
  const utils = trpc.useUtils();
  const mine = trpc.realEstate.mine.useQuery();
  const save = trpc.realEstate.save.useMutation();
  const setStatus = trpc.realEstate.setStatus.useMutation();
  const remove = trpc.realEstate.remove.useMutation();
  const [form, setForm] = useState<Form | null>(null);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  const plan = mine.data?.plan;

  const payload = (f: Form) => ({
    ...(f.id ? { id: f.id, expectedRevision: f.expectedRevision } : {}),
    operation: f.operation, propertyType: f.propertyType, title: f.title, description: f.description,
    priceCents: centsFrom(f.price) ?? 0, depositCents: f.deposit.trim() ? centsFrom(f.deposit) : null,
    minLeaseMonths: intFrom(f.minLeaseMonths), province: f.province, district: f.district, neighborhood: f.neighborhood,
    areaBuiltM2: intFrom(f.areaBuiltM2), areaLandM2: intFrom(f.areaLandM2), bedrooms: intFrom(f.bedrooms), bathrooms: intFrom(f.bathrooms),
    parking: intFrom(f.parking), floor: intFrom(f.floor), furnished: f.furnished, petsAllowed: f.petsAllowed, landUse: f.landUse || null,
    hasTitle: f.hasTitle, hasWater: f.hasWater, hasPower: f.hasPower, amenities: f.amenities, advertiserType: f.advertiserType,
    contactPhone: normalizePhone(f.contactPhone), showPhone: true, images: f.images,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      const saved = await save.mutateAsync(payload(form));
      setForm(formFrom(saved));
      await utils.realEstate.mine.invalidate();
      toast.success(form.id ? "Anuncio guardado" : "Anuncio creado. Ahora agrega las fotos.");
    } catch (error) { toast.error(errorText(error)); }
  }
  async function upload(files: FileList | null) {
    if (!form?.id || !files?.length) return;
    setUploading(true);
    try {
      let images = form.images;
      for (const file of Array.from(files).slice(0, MAX_PROPERTY_IMAGES - images.length)) {
        const r = await fetch(`/api/properties/${form.id}/images`, { method: "POST", credentials: "include", headers: { "Content-Type": file.type, "x-cz-request": "1" }, body: file });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "No se pudo subir la foto");
        images = [...images, data.url];
      }
      const fresh = await utils.realEstate.mine.fetch();
      const updated = fresh.properties.find(p => p.id === form.id);
      if (updated) setForm(formFrom(updated)); else set("images", images);
      toast.success("Fotos agregadas");
    } catch (error) { toast.error(errorText(error)); } finally { setUploading(false); }
  }
  async function changeStatus(id: number, status: "published" | "paused" | "closed" | "draft") {
    try { await setStatus.mutateAsync({ id, status }); await utils.realEstate.mine.invalidate(); toast.success(status === "published" ? "¡Anuncio publicado!" : "Estado actualizado"); }
    catch (error) { toast.error(errorText(error)); }
  }

  if (form) {
    const rooms = hasRooms(form.propertyType);
    const land = form.propertyType === "terreno";
    const rent = form.operation === "alquiler";
    return (
      <div className="re-page container">
        <button className="re-back" onClick={() => setForm(null)}>← Mis anuncios</button>
        <h1>{form.id ? "Editar anuncio" : "Nuevo anuncio"}</h1>
        <form className="re-form" onSubmit={submit}>
          <fieldset>
            <legend>¿Qué publicas?</legend>
            <div className="re-segment">
              {(["venta", "alquiler"] as const).map(v => <button type="button" key={v} className={form.operation === v ? "is-active" : ""} onClick={() => set("operation", v)}>{v === "venta" ? "Venta" : "Alquiler"}</button>)}
            </div>
            <div className="re-segment">
              {propertyTypes.map(t => <button type="button" key={t} className={form.propertyType === t ? "is-active" : ""} onClick={() => set("propertyType", t)}>{propertyTypeLabels[t]}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Datos principales</legend>
            <label>Título<Input value={form.title} onChange={e => set("title", e.target.value)} maxLength={120} required placeholder="Ej.: Casa de 3 recámaras con patio en Las Cumbres" /></label>
            <label>Descripción<textarea rows={5} value={form.description} onChange={e => set("description", e.target.value)} maxLength={4000} required placeholder="Cómo es, qué incluye, cerca de qué está…" /></label>
            <div className="re-row">
              <label>{rent ? "Precio mensual (US$)" : "Precio de venta (US$)"}<Input inputMode="decimal" value={form.price} onChange={e => set("price", e.target.value)} required /></label>
              {rent && <label>Depósito (US$)<Input inputMode="decimal" value={form.deposit} onChange={e => set("deposit", e.target.value)} /></label>}
              {rent && <label>Contrato mínimo (meses)<Input inputMode="numeric" value={form.minLeaseMonths} onChange={e => set("minLeaseMonths", e.target.value)} /></label>}
            </div>
          </fieldset>
          <fieldset>
            <legend>Ubicación</legend>
            <div className="re-row">
              <label>Provincia<select value={form.province} onChange={e => set("province", e.target.value)}>{provinceOptions.map(p => <option key={p}>{p}</option>)}</select></label>
              <label>Distrito<Input value={form.district} onChange={e => set("district", e.target.value)} required /></label>
              <label>Corregimiento o barrio<Input value={form.neighborhood} onChange={e => set("neighborhood", e.target.value)} /></label>
            </div>
            <p className="re-muted re-small">No pongas la dirección exacta: compártela solo con personas interesadas.</p>
          </fieldset>
          <fieldset>
            <legend>Características</legend>
            <div className="re-row">
              {!land && <label>Construcción (m²)<Input inputMode="numeric" value={form.areaBuiltM2} onChange={e => set("areaBuiltM2", e.target.value)} required /></label>}
              <label>Terreno (m²){land ? "" : " (opcional)"}<Input inputMode="numeric" value={form.areaLandM2} onChange={e => set("areaLandM2", e.target.value)} required={land} /></label>
              {rooms && <label>Habitaciones<Input inputMode="numeric" value={form.bedrooms} onChange={e => set("bedrooms", e.target.value)} required /></label>}
              {rooms && <label>Baños<Input inputMode="numeric" value={form.bathrooms} onChange={e => set("bathrooms", e.target.value)} required /></label>}
              {!land && <label>Estacionamientos<Input inputMode="numeric" value={form.parking} onChange={e => set("parking", e.target.value)} /></label>}
              {(form.propertyType === "apartamento" || form.propertyType === "oficina") && <label>Piso<Input inputMode="numeric" value={form.floor} onChange={e => set("floor", e.target.value)} /></label>}
              {land && <label>Uso de suelo<select value={form.landUse} onChange={e => set("landUse", e.target.value)}><option value="">Sin indicar</option>{Object.entries(landUseLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
            </div>
            <div className="re-checks">
              {rooms && <label><input type="checkbox" checked={form.furnished} onChange={e => set("furnished", e.target.checked)} /> Amueblado</label>}
              {rent && <label><input type="checkbox" checked={form.petsAllowed} onChange={e => set("petsAllowed", e.target.checked)} /> Acepta mascotas</label>}
              {land && <label><input type="checkbox" checked={form.hasTitle} onChange={e => set("hasTitle", e.target.checked)} /> Tiene título de propiedad</label>}
              {land && <label><input type="checkbox" checked={form.hasWater} onChange={e => set("hasWater", e.target.checked)} /> Acceso a agua</label>}
              {land && <label><input type="checkbox" checked={form.hasPower} onChange={e => set("hasPower", e.target.checked)} /> Acceso a luz</label>}
            </div>
            {!land && (
              <div className="re-checks">
                {propertyAmenities.map(a => (
                  <label key={a}><input type="checkbox" checked={form.amenities.includes(a)} onChange={e => set("amenities", e.target.checked ? [...form.amenities, a] : form.amenities.filter(x => x !== a))} /> {amenityLabels[a]}</label>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend>Contacto</legend>
            <div className="re-row">
              <label>Tu celular (WhatsApp y llamadas)<Input inputMode="tel" value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} required placeholder="6123-4567" /></label>
              <label>Publicas como<select value={form.advertiserType} onChange={e => set("advertiserType", e.target.value as "dueno" | "agente")}><option value="dueno">Dueño</option><option value="agente">Agente inmobiliario</option></select></label>
            </div>
          </fieldset>
          <div className="re-form-actions">
            <button className="btn btn-gold" type="submit" disabled={save.isPending}>{save.isPending ? "Guardando…" : form.id ? "Guardar cambios" : "Crear anuncio"}</button>
          </div>
          {form.id && (
            <fieldset>
              <legend>Fotos ({form.images.length} de {MAX_PROPERTY_IMAGES})</legend>
              <div className="re-thumbs re-thumbs--edit">{form.images.map(src => <img key={src} src={src} alt="" />)}</div>
              {form.images.length < MAX_PROPERTY_IMAGES && (
                <label className="re-upload">
                  {uploading ? "Subiendo…" : "+ Agregar fotos (JPG, PNG o WEBP, máx. 5 MB)"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={e => void upload(e.target.files)} />
                </label>
              )}
            </fieldset>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="re-page container">
      <div className="re-hero">
        <div>
          <p className="eyebrow">BIENES RAÍCES</p>
          <h1>Mis anuncios</h1>
        </div>
        <button className="btn btn-gold" onClick={() => setForm({ ...emptyForm })}>+ Nuevo anuncio</button>
      </div>
      {plan && (
        <div className={`re-plan ${plan.active ? "re-plan--ok" : ""}`}>
          {plan.active ? (
            <p><strong>Plan activo{plan.featured ? " · Mayor Visibilidad (tus anuncios salen destacados)" : ""}</strong> hasta el {new Date(plan.endsAt!).toLocaleDateString("es-PA", { timeZone: "America/Panama" })}.</p>
          ) : (
            <p><strong>Para publicar necesitas un plan:</strong> Normal (US$19.99 al mes) o Mayor Visibilidad (US$39.99 al mes, tus anuncios salen primero y destacados). Paga por Yappy y escríbenos con el correo o celular de tu cuenta para activarlo. Mientras tanto puedes preparar tus anuncios.</p>
          )}
        </div>
      )}
      {mine.isLoading && <p role="status">Cargando…</p>}
      {mine.data && mine.data.properties.length === 0 && <div className="re-empty"><h2>Aún no tienes anuncios</h2><p>Crea el primero: venta o alquiler de casa, apartamento, terreno, local u oficina.</p></div>}
      <ul className="re-mine">
        {mine.data?.properties.map(p => (
          <li key={p.id}>
            {p.images[0] ? <img src={p.images[0]} alt="" /> : <div className="re-card-nophoto">Sin foto</div>}
            <div>
              <strong>{p.title}</strong>
              <span className="re-muted">{priceLabel(p)} · {propertyTypeLabels[p.propertyType]} · {p.province}</span>
              <span className={`re-status re-status--${p.status}`}>{statusLabels[p.status]}</span>
            </div>
            <div className="re-mine-actions">
              <button className="btn btn-outline" onClick={() => setForm(formFrom(p))}>Editar</button>
              {p.status !== "published" && <button className="btn btn-gold" onClick={() => void changeStatus(p.id, "published")}>Publicar</button>}
              {p.status === "published" && <Link className="btn btn-outline" href={`/bienes-raices/${p.slug}`}>Ver</Link>}
              {p.status === "published" && <button className="btn btn-outline" onClick={() => void changeStatus(p.id, "paused")}>Pausar</button>}
              {p.status === "published" && <button className="btn btn-outline" onClick={() => void changeStatus(p.id, "closed")}>Marcar vendido o alquilado</button>}
              <button className="btn btn-outline" onClick={async () => { if (confirm("¿Borrar este anuncio?")) { await remove.mutateAsync({ id: p.id }); await utils.realEstate.mine.invalidate(); } }}>Borrar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────── Próximamente (Autos y Empleos) ─────────────

export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="re-page container re-empty re-soon">
      <p className="eyebrow">PRÓXIMAMENTE</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link href="/" className="btn btn-gold">Volver al inicio</Link>
    </div>
  );
}
