import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Calendar,
  Fuel,
  Gauge,
  MapPin,
  Phone,
  Settings2,
  Star,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { provinceOptions } from "@shared/marketplace";
import {
  MAX_VEHICLE_IMAGES,
  MAX_VEHICLE_VIDEOS,
  MAX_VEHICLE_VIDEO_BYTES,
  conditionLabels,
  featureLabels,
  fuelLabels,
  fuels,
  km,
  rentPeriodLabels,
  rentPeriods,
  sellerTypeLabels,
  transmissionLabels,
  transmissions,
  vehicleFeatures,
  vehicleMakes,
  vehicleOperationLabels,
  vehiclePriceLabel,
  vehicleStatusLabels,
  vehicleTypeLabels,
  vehicleTypes,
  vehicleUsd,
  type OwnVehicleDTO,
  type RentPeriod,
  type VehicleDTO,
  type VehicleOperation,
  type VehicleType,
} from "@shared/vehicles";
import { trpc } from "@/lib/trpc";
import { AuthGate } from "@/features/membership/AuthGate";
import { Input } from "@/components/ui/input";
import "../realEstate/realEstate.css";
import FilterDrawer, {
  countActiveFilters,
} from "@/components/marketplace/FilterDrawer";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";
const centsFrom = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 && v.trim() !== ""
    ? Math.round(n * 100)
    : null;
};
const intOrNull = (v: string) =>
  v.trim() === ""
    ? null
    : Math.max(0, Math.round(Number(v.replace(/[,\s]/g, "")))) || 0;
const THIS_YEAR = new Date().getFullYear();

// ───────────── Tarjeta ─────────────

function VehicleCard({ v }: { v: VehicleDTO }) {
  return (
    <Link
      href={`/autos/${v.slug}`}
      className={`re-card ${v.featured ? "re-card--featured" : ""}`}
    >
      <div className="re-card-photo">
        {v.images[0] ? (
          <img src={v.images[0]} alt={v.title} loading="lazy" />
        ) : (
          <div className="re-card-nophoto">Sin foto</div>
        )}
        <span className="re-badge">{vehicleOperationLabels[v.operation]}</span>
        {v.featured && (
          <span className="re-badge re-badge--gold">
            <Star size={12} /> Destacado
          </span>
        )}
        {(v.videos ?? []).length > 0 && (
          <span className="re-badge re-badge--video">
            <Video size={12} /> Con video
          </span>
        )}
      </div>
      <div className="re-card-body">
        <strong className="re-price">{vehiclePriceLabel(v)}</strong>
        <h3>
          {v.makeName} {v.model} {v.year}
        </h3>
        <p className="re-where">
          <MapPin size={14} /> {vehicleTypeLabels[v.vehicleType]} · {v.district}
          , {v.province}
        </p>
        <div className="re-specs">
          <span>
            <Calendar size={14} /> {v.year}
          </span>
          <span>
            <Gauge size={14} /> {km(v.mileageKm)}
          </span>
          <span>
            <Settings2 size={14} /> {transmissionLabels[v.transmission]}
          </span>
          <span>
            <Fuel size={14} /> {fuelLabels[v.fuel]}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ───────────── Búsqueda ─────────────

export function VehicleListPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const op = new URLSearchParams(search).get("op");
  const [f, setF] = useState({
    operation: (op === "venta" || op === "alquiler" ? op : "") as
      | ""
      | VehicleOperation,
    vehicleType: "" as "" | VehicleType,
    make: "",
    province: "",
    transmission: "",
    fuel: "",
    condition: "",
    minYear: "",
    maxYear: "",
    minPrice: "",
    maxPrice: "",
    maxMileage: "",
    q: "",
  });
  useEffect(
    () =>
      setF(x => ({
        ...x,
        operation: (op === "venta" || op === "alquiler" ? op : "") as
          | ""
          | VehicleOperation,
      })),
    [op]
  );
  const [page, setPage] = useState(1);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF(x => ({ ...x, [k]: v }));
    setPage(1);
  };
  const query = useMemo(() => {
    const out: Record<string, unknown> = { page };
    if (f.operation) out.operation = f.operation;
    if (f.vehicleType) out.vehicleType = f.vehicleType;
    if (f.make) out.make = f.make;
    if (f.province) out.province = f.province;
    if (f.transmission) out.transmission = f.transmission;
    if (f.fuel) out.fuel = f.fuel;
    if (f.condition) out.condition = f.condition;
    if (/^\d{4}$/.test(f.minYear)) out.minYear = Number(f.minYear);
    if (/^\d{4}$/.test(f.maxYear)) out.maxYear = Number(f.maxYear);
    if (centsFrom(f.minPrice)) out.minPriceCents = centsFrom(f.minPrice);
    if (centsFrom(f.maxPrice)) out.maxPriceCents = centsFrom(f.maxPrice);
    if (intOrNull(f.maxMileage)) out.maxMileageKm = intOrNull(f.maxMileage);
    if (f.q.trim()) out.q = f.q.trim();
    return out as Parameters<typeof trpc.vehicles.list.useQuery>[0];
  }, [f, page]);
  const list = trpc.vehicles.list.useQuery(query);

  return (
    <div className="re-page container">
      <div className="re-hero">
        <div>
          <p className="eyebrow">AUTOS</p>
          <h1>
            {f.operation === "alquiler"
              ? "Alquila un auto"
              : f.operation === "venta"
                ? "Encuentra tu próximo auto"
                : "Autos y motos en Panamá"}
          </h1>
          <p className="re-muted">
            Venta y alquiler de particulares, concesionarios y rentadoras.
          </p>
        </div>
        <Link href="/autos/mis-anuncios" className="btn btn-gold">
          Publicar un auto
        </Link>
      </div>
      <div className="re-tabs" role="tablist" aria-label="Operación">
        {(["", "venta", "alquiler"] as const).map(v => (
          <button
            key={v || "todos"}
            role="tab"
            aria-selected={f.operation === v}
            className={f.operation === v ? "is-active" : ""}
            onClick={() => navigate(v ? `/autos?op=${v}` : "/autos")}
          >
            {v === "" ? "Todos" : v === "venta" ? "Comprar" : "Alquilar"}
          </button>
        ))}
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
              value={f.vehicleType}
              onChange={e =>
                set("vehicleType", e.target.value as VehicleType | "")
              }
            >
              <option value="">Todos</option>
              {vehicleTypes.map(t => (
                <option key={t} value={t}>
                  {vehicleTypeLabels[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Marca
            <select value={f.make} onChange={e => set("make", e.target.value)}>
              <option value="">Todas</option>
              {vehicleMakes
                .filter(m => m !== "Otra")
                .map(m => (
                  <option key={m}>{m}</option>
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
          <label>
            Año desde
            <Input
              inputMode="numeric"
              value={f.minYear}
              onChange={e => set("minYear", e.target.value)}
              placeholder="2015"
            />
          </label>
          <label>
            Año hasta
            <Input
              inputMode="numeric"
              value={f.maxYear}
              onChange={e => set("maxYear", e.target.value)}
              placeholder={String(THIS_YEAR)}
            />
          </label>
          <label>
            Precio desde (US$)
            <Input
              inputMode="decimal"
              value={f.minPrice}
              onChange={e => set("minPrice", e.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Precio hasta (US$)
            <Input
              inputMode="decimal"
              value={f.maxPrice}
              onChange={e => set("maxPrice", e.target.value)}
              placeholder="Sin límite"
            />
          </label>
          <label>
            Kilometraje máximo
            <Input
              inputMode="numeric"
              value={f.maxMileage}
              onChange={e => set("maxMileage", e.target.value)}
              placeholder="Sin límite"
            />
          </label>
          <label>
            Transmisión
            <select
              value={f.transmission}
              onChange={e => set("transmission", e.target.value)}
            >
              <option value="">Cualquiera</option>
              {transmissions.map(t => (
                <option key={t} value={t}>
                  {transmissionLabels[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Combustible
            <select value={f.fuel} onChange={e => set("fuel", e.target.value)}>
              <option value="">Cualquiera</option>
              {fuels.map(t => (
                <option key={t} value={t}>
                  {fuelLabels[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Condición
            <select
              value={f.condition}
              onChange={e => set("condition", e.target.value)}
            >
              <option value="">Nuevo o usado</option>
              <option value="nuevo">Nuevo</option>
              <option value="usado">Usado</option>
            </select>
          </label>
          <label className="re-search filter-keep">
            Buscar
            <Input
              value={f.q}
              onChange={e => set("q", e.target.value)}
              placeholder="Modelo, versión o palabra"
            />
          </label>
        </form>
      </FilterDrawer>
      {list.isLoading && <p role="status">Buscando autos…</p>}
      {list.error && (
        <p className="member-error" role="alert">
          {list.error.message}
        </p>
      )}
      {list.data && (
        <>
          <p className="re-muted">
            {list.data.total} {list.data.total === 1 ? "vehículo" : "vehículos"}
          </p>
          {list.data.items.length === 0 ? (
            <div className="re-empty">
              <h2>Todavía no hay vehículos con esos filtros</h2>
              <p>
                Prueba con otra marca, año o precio, o sé el primero en
                publicar.
              </p>
              <Link href="/autos/mis-anuncios" className="btn btn-gold">
                Publicar un auto
              </Link>
            </div>
          ) : (
            <div className="re-grid">
              {list.data.items.map(v => (
                <VehicleCard key={v.id} v={v} />
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

// ───────────── Ficha ─────────────

export function VehicleDetailPage({ slug }: { slug: string }) {
  const detail = trpc.vehicles.detail.useQuery({ slug }, { retry: false });
  const [photo, setPhoto] = useState(0);
  if (detail.isLoading)
    return (
      <div className="re-page container">
        <p role="status">Cargando…</p>
      </div>
    );
  if (detail.error || !detail.data)
    return (
      <div className="re-page container re-empty">
        <h1>Este anuncio ya no está disponible</h1>
        <Link href="/autos" className="btn btn-gold">
          Ver otros autos
        </Link>
      </div>
    );
  const v = detail.data;
  const digits = v.contactPhone.replace(/\D/g, "");
  const rows: Array<[string, string]> = [
    ["Marca", v.makeName],
    ["Modelo", v.model],
    ["Año", String(v.year)],
    ["Condición", conditionLabels[v.condition]],
    ["Kilometraje", km(v.mileageKm)],
    ["Tipo", vehicleTypeLabels[v.vehicleType]],
    ["Transmisión", transmissionLabels[v.transmission]],
    ["Combustible", fuelLabels[v.fuel]],
    ...(v.color ? [["Color", v.color] as [string, string]] : []),
    ...(v.engine ? [["Motor", v.engine] as [string, string]] : []),
    ...(v.doors != null
      ? [["Puertas", String(v.doors)] as [string, string]]
      : []),
    ...(v.operation === "venta"
      ? [
          ["A nombre del vendedor", v.titleInSellerName ? "Sí" : "No"] as [
            string,
            string,
          ],
          ["Precio negociable", v.negotiable ? "Sí" : "No"] as [string, string],
        ]
      : []),
    ...(v.operation === "alquiler" && v.depositCents != null
      ? [["Depósito", vehicleUsd(v.depositCents)] as [string, string]]
      : []),
    ...(v.operation === "alquiler" && v.minDriverAge
      ? [
          ["Edad mínima del conductor", `${v.minDriverAge} años`] as [
            string,
            string,
          ],
        ]
      : []),
    ["Publicado por", sellerTypeLabels[v.sellerType]],
  ];
  return (
    <div className="re-page container">
      <nav className="re-crumbs" aria-label="Ruta">
        <Link href="/autos">Autos</Link> / <span>{v.title}</span>
      </nav>
      <div className="re-detail">
        <div>
          <div className="re-gallery">
            {v.images[photo] ? (
              <img
                src={v.images[photo]}
                alt={`${v.title}, foto ${photo + 1}`}
              />
            ) : (
              <div className="re-card-nophoto">Sin foto</div>
            )}
            {v.featured && (
              <span className="re-badge re-badge--gold">
                <Star size={12} /> Destacado
              </span>
            )}
          </div>
          {v.images.length > 1 && (
            <div className="re-thumbs">
              {v.images.map((src, i) => (
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
          {(v.videos ?? []).length > 0 && (
            <section className="re-section">
              <h2>Videos</h2>
              <div className="media-grid media-grid--video media-grid--public">
                {v.videos.map((src, i) => (
                  <video
                    key={src}
                    src={src}
                    controls
                    preload="metadata"
                    playsInline
                    aria-label={`Video ${i + 1} de ${v.title}`}
                  />
                ))}
              </div>
            </section>
          )}
          <section className="re-section">
            <h2>Descripción</h2>
            <p className="re-description">{v.description}</p>
          </section>
          {v.features.length > 0 && (
            <section className="re-section">
              <h2>Equipamiento</h2>
              <ul className="re-amenities">
                {v.features.map(a => (
                  <li key={a}>{featureLabels[a]}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="re-aside">
          <span className="re-badge re-badge--inline">
            {vehicleOperationLabels[v.operation]}
          </span>
          <h1>{v.title}</h1>
          <strong className="re-price re-price--big">
            {vehiclePriceLabel(v)}
          </strong>
          {v.negotiable && v.operation === "venta" && (
            <span className="re-muted">Precio negociable</span>
          )}
          <p className="re-where">
            <MapPin size={15} /> {v.district}, {v.province}
          </p>
          <dl className="re-table">
            {rows.map(([k, val]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{val}</dd>
              </div>
            ))}
          </dl>
          <div className="re-contact">
            <a
              className="btn btn-gold"
              href={`https://wa.me/${digits}?text=${encodeURIComponent(`Hola, vi su anuncio en CuadraZone: ${v.title}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
            <a className="btn btn-outline" href={`tel:${v.contactPhone}`}>
              <Phone size={16} /> Llamar
            </a>
          </div>
          <p className="re-muted re-small">
            Revisa el vehículo, el registro único vehicular y el traspaso antes
            de pagar. Nunca envíes dinero por adelantado.
          </p>
        </aside>
      </div>
    </div>
  );
}

// ───────────── Mis anuncios y editor ─────────────

type Form = {
  id?: number;
  expectedRevision?: number;
  operation: VehicleOperation;
  vehicleType: VehicleType;
  make: string;
  otherMake: string;
  model: string;
  year: string;
  condition: "nuevo" | "usado";
  mileage: string;
  transmission: "automatica" | "manual";
  fuel: (typeof fuels)[number];
  color: string;
  engine: string;
  doors: string;
  title: string;
  description: string;
  price: string;
  negotiable: boolean;
  titleInSellerName: boolean;
  rentPeriod: "" | RentPeriod;
  deposit: string;
  minDriverAge: string;
  features: string[];
  province: string;
  district: string;
  sellerType: "particular" | "concesionario" | "rentadora";
  contactPhone: string;
  images: string[];
  videos: string[];
};
const emptyForm: Form = {
  operation: "venta",
  vehicleType: "sedan",
  make: "Toyota",
  otherMake: "",
  model: "",
  year: String(THIS_YEAR - 3),
  condition: "usado",
  mileage: "",
  transmission: "automatica",
  fuel: "gasolina",
  color: "",
  engine: "",
  doors: "4",
  title: "",
  description: "",
  price: "",
  negotiable: false,
  titleInSellerName: true,
  rentPeriod: "",
  deposit: "",
  minDriverAge: "",
  features: [],
  province: "Panamá",
  district: "",
  sellerType: "particular",
  contactPhone: "",
  images: [],
  videos: [],
};
function formFrom(v: OwnVehicleDTO): Form {
  return {
    id: v.id,
    expectedRevision: v.revision,
    operation: v.operation,
    vehicleType: v.vehicleType,
    make: v.make,
    otherMake: v.otherMake,
    model: v.model,
    year: String(v.year),
    condition: v.condition,
    mileage: String(v.mileageKm),
    transmission: v.transmission,
    fuel: v.fuel,
    color: v.color,
    engine: v.engine,
    doors: v.doors == null ? "" : String(v.doors),
    title: v.title,
    description: v.description,
    price: String(v.priceCents / 100),
    negotiable: v.negotiable,
    titleInSellerName: v.titleInSellerName,
    rentPeriod: v.rentPeriod ?? "",
    deposit: v.depositCents == null ? "" : String(v.depositCents / 100),
    minDriverAge: v.minDriverAge == null ? "" : String(v.minDriverAge),
    features: v.features,
    province: v.province,
    district: v.district,
    sellerType: v.sellerType,
    contactPhone: v.contactPhone,
    images: v.images,
    videos: v.videos ?? [],
  };
}
function normalizePhone(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 8
    ? `+507${d}`
    : d.length === 11 && d.startsWith("507")
      ? `+${d}`
      : v.trim();
}

export function VehicleMinePage() {
  return (
    <AuthGate>
      <MineContent />
    </AuthGate>
  );
}

function MineContent() {
  const utils = trpc.useUtils();
  const mine = trpc.vehicles.mine.useQuery();
  const save = trpc.vehicles.save.useMutation();
  const setStatus = trpc.vehicles.setStatus.useMutation();
  const remove = trpc.vehicles.remove.useMutation();
  const [form, setForm] = useState<Form | null>(null);
  const [uploading, setUploading] = useState(false);
  /** Fotos elegidas mientras se crea el anuncio; se suben al pulsar «Crear anuncio». */
  const [pending, setPending] = useState<Array<{ file: File; url: string }>>(
    []
  );
  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm(x => (x ? { ...x, [k]: v } : x));
  const plan = mine.data?.plan;
  const clearPending = () => {
    pending.forEach(p => URL.revokeObjectURL(p.url));
    setPending([]);
  };
  function pickPending(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_VEHICLE_IMAGES - pending.length;
    const chosen: Array<{ file: File; url: string }> = [];
    for (const file of Array.from(files)) {
      if (chosen.length >= room) {
        toast.error(`Máximo ${MAX_VEHICLE_IMAGES} fotos por anuncio`);
        break;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error(`«${file.name}» no es JPG, PNG ni WEBP`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`«${file.name}» pesa más de 5 MB`);
        continue;
      }
      chosen.push({ file, url: URL.createObjectURL(file) });
    }
    setPending(list => [...list, ...chosen]);
  }
  async function sendImages(id: number, files: File[]) {
    for (const file of files) {
      const r = await fetch(`/api/vehicles/${id}/images`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type, "x-cz-request": "1" },
        body: file,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No se pudo subir la foto");
    }
  }

  const payload = (x: Form) => ({
    ...(x.id ? { id: x.id, expectedRevision: x.expectedRevision } : {}),
    operation: x.operation,
    vehicleType: x.vehicleType,
    make: x.make,
    otherMake: x.otherMake,
    model: x.model,
    year: Number(x.year) || 0,
    condition: x.condition,
    mileageKm: intOrNull(x.mileage) ?? 0,
    transmission: x.transmission,
    fuel: x.fuel,
    color: x.color,
    engine: x.engine,
    doors: x.vehicleType === "moto" ? null : intOrNull(x.doors),
    title: x.title,
    description: x.description,
    priceCents: centsFrom(x.price) ?? 0,
    negotiable: x.negotiable,
    titleInSellerName: x.titleInSellerName,
    rentPeriod: x.operation === "alquiler" ? x.rentPeriod || null : null,
    depositCents: x.deposit.trim() ? centsFrom(x.deposit) : null,
    minDriverAge: intOrNull(x.minDriverAge),
    features: x.features,
    province: x.province,
    district: x.district,
    sellerType: x.sellerType,
    contactPhone: normalizePhone(x.contactPhone),
    images: x.images,
    videos: x.videos,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const creating = !form.id;
    if (creating && pending.length === 0) {
      toast.error("Agrega al menos una foto del vehículo");
      document
        .getElementById("vehicle-photos")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    let saved: OwnVehicleDTO;
    try {
      saved = await save.mutateAsync(payload(form));
      setForm(formFrom(saved));
    } catch (error) {
      toast.error(errorText(error));
      return;
    }
    if (creating) {
      setUploading(true);
      try {
        await sendImages(
          saved.id,
          pending.map(p => p.file)
        );
        clearPending();
        const fresh = await utils.vehicles.mine.fetch();
        const updated = fresh.vehicles.find(x => x.id === saved.id);
        if (updated) setForm(formFrom(updated));
        toast.success("Anuncio creado con sus fotos. Revisa y publícalo.");
      } catch (error) {
        toast.error(
          `Anuncio creado, pero falló una foto: ${errorText(error)}. Agrégala de nuevo abajo.`
        );
        clearPending();
        await utils.vehicles.mine.invalidate();
      } finally {
        setUploading(false);
      }
      return;
    }
    await utils.vehicles.mine.invalidate();
    toast.success("Anuncio guardado");
  }
  async function upload(files: FileList | null) {
    if (!form?.id || !files?.length) return;
    setUploading(true);
    try {
      await sendImages(
        form.id,
        Array.from(files).slice(0, MAX_VEHICLE_IMAGES - form.images.length)
      );
      const fresh = await utils.vehicles.mine.fetch();
      const updated = fresh.vehicles.find(x => x.id === form.id);
      if (updated) setForm(formFrom(updated));
      toast.success("Fotos agregadas");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setUploading(false);
    }
  }
  const [uploadingVideo, setUploadingVideo] = useState(false);
  async function uploadVideo(files: FileList | null) {
    const file = files?.[0];
    if (!form?.id || !file) return;
    if (file.size > MAX_VEHICLE_VIDEO_BYTES) {
      toast.error("El video supera el límite de 40 MB");
      return;
    }
    setUploadingVideo(true);
    try {
      const r = await fetch(`/api/vehicles/${form.id}/videos`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type || "video/mp4",
          "x-cz-request": "1",
        },
        body: file,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No se pudo subir el video");
      const fresh = await utils.vehicles.mine.fetch();
      const updated = fresh.vehicles.find(x => x.id === form.id);
      if (updated) setForm(formFrom(updated));
      toast.success("Video agregado");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setUploadingVideo(false);
    }
  }
  /** Quita una foto o un video y guarda el anuncio al instante. */
  async function removeMedia(kind: "images" | "videos", src: string) {
    if (!form?.id) return;
    const next = { ...form, [kind]: form[kind].filter(x => x !== src) };
    try {
      const saved = await save.mutateAsync(payload(next));
      setForm(formFrom(saved));
      await utils.vehicles.mine.invalidate();
      toast.success(kind === "images" ? "Foto quitada" : "Video quitado");
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  async function changeStatus(
    id: number,
    status: "published" | "paused" | "closed" | "draft"
  ) {
    try {
      await setStatus.mutateAsync({ id, status });
      await utils.vehicles.mine.invalidate();
      toast.success(
        status === "published" ? "¡Anuncio publicado!" : "Estado actualizado"
      );
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  if (form) {
    const rent = form.operation === "alquiler";
    const moto = form.vehicleType === "moto";
    return (
      <div className="re-page container">
        <button
          className="re-back"
          onClick={() => {
            clearPending();
            setForm(null);
          }}
        >
          ← Mis autos
        </button>
        <h1>{form.id ? "Editar anuncio" : "Nuevo anuncio de auto"}</h1>
        <form className="re-form" onSubmit={submit}>
          <fieldset>
            <legend>¿Qué publicas?</legend>
            <div className="re-segment">
              {(["venta", "alquiler"] as const).map(v => (
                <button
                  type="button"
                  key={v}
                  className={form.operation === v ? "is-active" : ""}
                  onClick={() => set("operation", v)}
                >
                  {v === "venta" ? "Venta" : "Alquiler"}
                </button>
              ))}
            </div>
            <div className="re-segment">
              {vehicleTypes.map(t => (
                <button
                  type="button"
                  key={t}
                  className={form.vehicleType === t ? "is-active" : ""}
                  onClick={() => set("vehicleType", t)}
                >
                  {vehicleTypeLabels[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>El vehículo</legend>
            <div className="re-row">
              <label>
                Marca
                <select
                  value={form.make}
                  onChange={e => set("make", e.target.value)}
                >
                  {vehicleMakes.map(m => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              {form.make === "Otra" && (
                <label>
                  ¿Cuál marca?
                  <Input
                    value={form.otherMake}
                    onChange={e => set("otherMake", e.target.value)}
                    maxLength={40}
                    required
                  />
                </label>
              )}
              <label>
                Modelo
                <Input
                  value={form.model}
                  onChange={e => set("model", e.target.value)}
                  maxLength={60}
                  required
                  placeholder="Ej.: Corolla, Tucson, Hilux"
                />
              </label>
              <label>
                Año
                <Input
                  inputMode="numeric"
                  value={form.year}
                  onChange={e => set("year", e.target.value)}
                  required
                />
              </label>
              <label>
                Condición
                <select
                  value={form.condition}
                  onChange={e =>
                    set("condition", e.target.value as "nuevo" | "usado")
                  }
                >
                  <option value="usado">Usado</option>
                  <option value="nuevo">Nuevo</option>
                </select>
              </label>
              <label>
                Kilometraje
                <Input
                  inputMode="numeric"
                  value={form.mileage}
                  onChange={e => set("mileage", e.target.value)}
                  required
                  placeholder="Ej.: 45000"
                />
              </label>
              <label>
                Transmisión
                <select
                  value={form.transmission}
                  onChange={e =>
                    set("transmission", e.target.value as Form["transmission"])
                  }
                >
                  {transmissions.map(t => (
                    <option key={t} value={t}>
                      {transmissionLabels[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Combustible
                <select
                  value={form.fuel}
                  onChange={e => set("fuel", e.target.value as Form["fuel"])}
                >
                  {fuels.map(t => (
                    <option key={t} value={t}>
                      {fuelLabels[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Color
                <Input
                  value={form.color}
                  onChange={e => set("color", e.target.value)}
                  maxLength={30}
                />
              </label>
              <label>
                Motor (opcional)
                <Input
                  value={form.engine}
                  onChange={e => set("engine", e.target.value)}
                  maxLength={30}
                  placeholder="Ej.: 1.8 L, 150 cc"
                />
              </label>
              {!moto && (
                <label>
                  Puertas
                  <Input
                    inputMode="numeric"
                    value={form.doors}
                    onChange={e => set("doors", e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="re-checks">
              {vehicleFeatures.map(a => (
                <label key={a}>
                  <input
                    type="checkbox"
                    checked={form.features.includes(a)}
                    onChange={e =>
                      set(
                        "features",
                        e.target.checked
                          ? [...form.features, a]
                          : form.features.filter(x => x !== a)
                      )
                    }
                  />{" "}
                  {featureLabels[a]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset id="vehicle-photos">
            <legend>
              Fotos {moto ? "de la moto" : "del vehículo"}{" "}
              {form.id ? "y videos" : ""}
            </legend>
            <p className="re-muted re-small">
              Sube fotos claras por fuera, por dentro, del motor y del tablero
              con el kilometraje. La primera foto es la portada del anuncio.{" "}
              {form.id
                ? "Un video corto del vehículo encendido ayuda mucho a vender o alquilar."
                : "Necesitas al menos una foto."}
            </p>
            {form.id ? (
              <>
                <strong className="media-title">
                  Fotos ({form.images.length} de {MAX_VEHICLE_IMAGES})
                </strong>
                <div className="media-grid">
                  {form.images.map((src, i) => (
                    <div key={src} className="media-item">
                      <img src={src} alt={`Foto ${i + 1}`} />
                      {i === 0 && <span className="media-cover">Portada</span>}
                      <button
                        type="button"
                        className="media-remove"
                        disabled={save.isPending}
                        onClick={() => void removeMedia("images", src)}
                        aria-label={`Quitar foto ${i + 1}`}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
                {form.images.length < MAX_VEHICLE_IMAGES && (
                  <label className="re-upload">
                    {uploading
                      ? "Subiendo…"
                      : "+ Agregar fotos (JPG, PNG o WEBP, máx. 5 MB)"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={uploading}
                      onChange={e => {
                        void upload(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                <strong className="media-title">
                  Videos ({form.videos.length} de {MAX_VEHICLE_VIDEOS})
                </strong>
                <div className="media-grid media-grid--video">
                  {form.videos.map((src, i) => (
                    <div key={src} className="media-item">
                      <video
                        src={src}
                        controls
                        preload="metadata"
                        playsInline
                        aria-label={`Video ${i + 1}`}
                      />
                      <button
                        type="button"
                        className="media-remove"
                        disabled={save.isPending}
                        onClick={() => void removeMedia("videos", src)}
                        aria-label={`Quitar video ${i + 1}`}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
                {form.videos.length < MAX_VEHICLE_VIDEOS && (
                  <label className="re-upload">
                    {uploadingVideo
                      ? "Subiendo video…"
                      : "+ Agregar video (MP4, WEBM o MOV, máx. 40 MB)"}
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      disabled={uploadingVideo}
                      onChange={e => {
                        void uploadVideo(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </>
            ) : (
              <>
                <strong className="media-title">
                  Fotos ({pending.length} de {MAX_VEHICLE_IMAGES})
                </strong>
                {pending.length > 0 && (
                  <div className="media-grid">
                    {pending.map((p, i) => (
                      <div key={p.url} className="media-item">
                        <img src={p.url} alt={`Foto ${i + 1}`} />
                        {i === 0 && (
                          <span className="media-cover">Portada</span>
                        )}
                        <button
                          type="button"
                          className="media-remove"
                          onClick={() => {
                            URL.revokeObjectURL(p.url);
                            setPending(list => list.filter(x => x !== p));
                          }}
                          aria-label={`Quitar foto ${i + 1}`}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {pending.length < MAX_VEHICLE_IMAGES && (
                  <label className="re-upload">
                    + {pending.length ? "Agregar más fotos" : "Subir fotos"}{" "}
                    (JPG, PNG o WEBP, máx. 5 MB)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={e => {
                        pickPending(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                <p className="re-muted re-small">
                  Los videos los puedes agregar después de crear el anuncio.
                </p>
              </>
            )}
          </fieldset>
          <fieldset>
            <legend>Anuncio y precio</legend>
            <label>
              Título
              <Input
                value={form.title}
                onChange={e => set("title", e.target.value)}
                maxLength={120}
                required
                placeholder="Ej.: Toyota Corolla 2020 automático, un solo dueño"
              />
            </label>
            <label>
              Descripción
              <textarea
                rows={5}
                value={form.description}
                onChange={e => set("description", e.target.value)}
                maxLength={4000}
                required
                placeholder="Estado, mantenimientos, detalles, por qué lo vendes…"
              />
            </label>
            <div className="re-row">
              <label>
                {rent ? "Precio de alquiler (US$)" : "Precio de venta (US$)"}
                <Input
                  inputMode="decimal"
                  value={form.price}
                  onChange={e => set("price", e.target.value)}
                  required
                />
              </label>
              {rent && (
                <label>
                  Por
                  <select
                    value={form.rentPeriod}
                    onChange={e =>
                      set("rentPeriod", e.target.value as RentPeriod)
                    }
                    required
                  >
                    <option value="">Elige</option>
                    {rentPeriods.map(p => (
                      <option key={p} value={p}>
                        {rentPeriodLabels[p]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {rent && (
                <label>
                  Depósito (US$)
                  <Input
                    inputMode="decimal"
                    value={form.deposit}
                    onChange={e => set("deposit", e.target.value)}
                  />
                </label>
              )}
              {rent && (
                <label>
                  Edad mínima del conductor
                  <Input
                    inputMode="numeric"
                    value={form.minDriverAge}
                    onChange={e => set("minDriverAge", e.target.value)}
                    placeholder="Ej.: 25"
                  />
                </label>
              )}
            </div>
            {!rent && (
              <div className="re-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={form.negotiable}
                    onChange={e => set("negotiable", e.target.checked)}
                  />{" "}
                  Precio negociable
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.titleInSellerName}
                    onChange={e => set("titleInSellerName", e.target.checked)}
                  />{" "}
                  El vehículo está a mi nombre
                </label>
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend>Ubicación y contacto</legend>
            <div className="re-row">
              <label>
                Provincia
                <select
                  value={form.province}
                  onChange={e => set("province", e.target.value)}
                >
                  {provinceOptions.map(p => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Distrito
                <Input
                  value={form.district}
                  onChange={e => set("district", e.target.value)}
                  required
                />
              </label>
              <label>
                Tu celular (WhatsApp y llamadas)
                <Input
                  inputMode="tel"
                  value={form.contactPhone}
                  onChange={e => set("contactPhone", e.target.value)}
                  required
                  placeholder="6123-4567"
                />
              </label>
              <label>
                Publicas como
                <select
                  value={form.sellerType}
                  onChange={e =>
                    set("sellerType", e.target.value as Form["sellerType"])
                  }
                >
                  <option value="particular">Particular</option>
                  <option value="concesionario">Concesionario</option>
                  <option value="rentadora">Rentadora</option>
                </select>
              </label>
            </div>
          </fieldset>
          <div className="re-form-actions">
            <button
              className="btn btn-gold"
              type="submit"
              disabled={save.isPending || uploading}
            >
              {save.isPending || uploading
                ? uploading
                  ? "Subiendo fotos…"
                  : "Guardando…"
                : form.id
                  ? "Guardar cambios"
                  : "Crear anuncio"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="re-page container">
      <div className="re-hero">
        <div>
          <p className="eyebrow">AUTOS</p>
          <h1>Mis autos</h1>
        </div>
        <button
          className="btn btn-gold"
          onClick={() => setForm({ ...emptyForm })}
        >
          + Nuevo anuncio
        </button>
      </div>
      {plan && (
        <div className={`re-plan ${plan.active ? "re-plan--ok" : ""}`}>
          {plan.active ? (
            <p>
              <strong>
                Plan activo
                {plan.featured
                  ? " · Mayor Visibilidad (tus anuncios salen destacados)"
                  : ""}
              </strong>{" "}
              hasta el{" "}
              {new Date(plan.endsAt!).toLocaleDateString("es-PA", {
                timeZone: "America/Panama",
              })}
              .
            </p>
          ) : (
            <p>
              <strong>Para publicar necesitas un plan:</strong> Normal (US$19.99
              al mes) o Mayor Visibilidad (US$39.99 al mes, tus anuncios salen
              primero y destacados). El mismo plan te sirve para autos y bienes
              raíces. Paga por Yappy y escríbenos con el correo o celular de tu
              cuenta para activarlo.
            </p>
          )}
        </div>
      )}
      {mine.isLoading && <p role="status">Cargando…</p>}
      {mine.data && mine.data.vehicles.length === 0 && (
        <div className="re-empty">
          <h2>Aún no tienes autos publicados</h2>
          <p>Crea tu primer anuncio de venta o alquiler.</p>
        </div>
      )}
      <ul className="re-mine">
        {mine.data?.vehicles.map(v => (
          <li key={v.id}>
            {v.images[0] ? (
              <img src={v.images[0]} alt="" />
            ) : (
              <div className="re-card-nophoto">Sin foto</div>
            )}
            <div>
              <strong>{v.title}</strong>
              <span className="re-muted">
                {vehiclePriceLabel(v)} · {v.makeName} {v.model} {v.year} ·{" "}
                {v.province}
              </span>
              <span className={`re-status re-status--${v.status}`}>
                {vehicleStatusLabels[v.status]}
              </span>
            </div>
            <div className="re-mine-actions">
              <button
                className="btn btn-outline"
                onClick={() => setForm(formFrom(v))}
              >
                Editar
              </button>
              {v.status !== "published" && (
                <button
                  className="btn btn-gold"
                  onClick={() => void changeStatus(v.id, "published")}
                >
                  Publicar
                </button>
              )}
              {v.status === "published" && (
                <Link className="btn btn-outline" href={`/autos/${v.slug}`}>
                  Ver
                </Link>
              )}
              {v.status === "published" && (
                <button
                  className="btn btn-outline"
                  onClick={() => void changeStatus(v.id, "paused")}
                >
                  Pausar
                </button>
              )}
              {v.status === "published" && (
                <button
                  className="btn btn-outline"
                  onClick={() => void changeStatus(v.id, "closed")}
                >
                  Marcar vendido o alquilado
                </button>
              )}
              <button
                className="btn btn-outline"
                onClick={async () => {
                  if (confirm("¿Borrar este anuncio?")) {
                    await remove.mutateAsync({ id: v.id });
                    await utils.vehicles.mine.invalidate();
                  }
                }}
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
