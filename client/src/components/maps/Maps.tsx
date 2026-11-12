import { lazy, Suspense, useEffect, useState } from "react";
import { Crosshair, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import {
  directionsLinks,
  inPanama,
  type Point,
  type PublicPlaceKind,
} from "@shared/location";
import { trpc } from "@/lib/trpc";
import type { CanvasMarker } from "./LeafletCanvas";
import "./maps.css";

const LeafletCanvas = lazy(() => import("./LeafletCanvas"));

function Canvas(props: React.ComponentProps<typeof LeafletCanvas>) {
  return (
    <Suspense
      fallback={
        <div
          className="cz-map cz-map--loading"
          style={{ height: props.height ?? 260 }}
        >
          Cargando mapa…
        </div>
      }
    >
      <LeafletCanvas {...props} />
    </Suspense>
  );
}

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

/** Pide la ubicación del teléfono o la computadora. */
function useMyLocation(onPoint: (p: Point) => void) {
  const [busy, setBusy] = useState(false);
  function locate() {
    if (!("geolocation" in navigator)) {
      toast.error(
        "Tu navegador no comparte la ubicación. Toca el mapa para marcar el punto."
      );
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBusy(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inPanama(p)) {
          toast.error(
            "Esa ubicación está fuera de Panamá. Toca el mapa para marcar el punto."
          );
          return;
        }
        onPoint(p);
      },
      () => {
        setBusy(false);
        toast.error(
          "No pudimos leer tu ubicación. Toca el mapa para marcar el punto."
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }
  return { locate, busy };
}

/** Elegir un punto: «Usar mi ubicación», tocar el mapa o arrastrar el pin. */
export function PlacePicker({
  value,
  onChange,
  label,
}: {
  value: Point | null;
  onChange: (p: Point | null) => void;
  label: string;
}) {
  const { locate, busy } = useMyLocation(onChange);
  return (
    <div className="cz-place-picker">
      <Canvas
        label={label}
        pick={value}
        onPick={p =>
          inPanama(p)
            ? onChange(p)
            : toast.error("Marca un punto dentro de Panamá.")
        }
      />
      <div className="cz-map-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={locate}
          disabled={busy}
        >
          <Crosshair size={16} aria-hidden="true" />{" "}
          {busy ? "Buscando…" : "Usar mi ubicación"}
        </button>
        {!value && (
          <span className="cz-map-hint">
            o toca el mapa donde está el punto exacto.
          </span>
        )}
        {value && (
          <span className="cz-map-hint">Arrastra el pin para ajustarlo.</span>
        )}
      </div>
    </div>
  );
}

function SavePlace({
  title,
  help,
  point,
  loading,
  save,
}: {
  title: string;
  help: string;
  point: Point | null | undefined;
  loading: boolean;
  save: (p: Point | null) => Promise<unknown>;
}) {
  const [value, setValue] = useState<Point | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (point !== undefined) setValue(point);
  }, [point?.lat, point?.lng, point === null]);
  if (loading) return null;
  async function run(p: Point | null, ok: string) {
    setBusy(true);
    try {
      await save(p);
      toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const changed = JSON.stringify(value) !== JSON.stringify(point ?? null);
  return (
    <section className="cz-place-editor">
      <h3>
        <MapPin size={18} aria-hidden="true" /> {title}
      </h3>
      <p className="cz-map-hint">{help}</p>
      <PlacePicker value={value} onChange={setValue} label={title} />
      <div className="cz-map-actions">
        <button
          type="button"
          className="btn btn-gold"
          disabled={busy || !value || !changed}
          onClick={() => run(value, "Ubicación guardada")}
        >
          {busy ? "Guardando…" : "Guardar ubicación"}
        </button>
        {point && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => run(null, "Ubicación quitada")}
          >
            Quitar ubicación
          </button>
        )}
      </div>
    </section>
  );
}

const PUBLIC_HELP =
  "En tu página pública solo se ve la zona aproximada (unos 500 m), nunca el punto exacto.";

/** «Mi tienda»: el punto exacto del negocio (comercio o servicios). */
export function StorePlaceEditor() {
  const utils = trpc.useUtils();
  const q = trpc.places.myStore.useQuery();
  const save = trpc.places.setMyStore.useMutation();
  if (!q.data?.hasStore) return null;
  return (
    <SavePlace
      title="Ubicación de tu negocio"
      help={`${PUBLIC_HELP} Quien te compre verá el punto exacto en su pedido.`}
      point={q.data.point}
      loading={q.isLoading}
      save={async p => {
        await save.mutateAsync({ point: p });
        await Promise.all([
          utils.places.myStore.invalidate(),
          utils.places.publicPlace.invalidate(),
        ]);
      }}
    />
  );
}

/** Editor de un anuncio de autos, bienes raíces o empleos. */
export function ListingPlaceEditor({
  kind,
  id,
}: {
  kind: "inmueble" | "auto" | "empleo";
  id: number | null | undefined;
}) {
  const utils = trpc.useUtils();
  const q = trpc.places.myListing.useQuery(
    { kind, id: id ?? 0 },
    { enabled: Boolean(id) }
  );
  const save = trpc.places.setMyListing.useMutation();
  if (!id)
    return (
      <p className="cz-map-hint">
        <MapPin size={14} aria-hidden="true" /> Guarda el anuncio para marcar su
        ubicación en el mapa.
      </p>
    );
  return (
    <SavePlace
      title="Ubicación en el mapa"
      help={PUBLIC_HELP}
      point={q.data}
      loading={q.isLoading}
      save={async p => {
        await save.mutateAsync({ kind, id, point: p });
        await Promise.all([
          utils.places.myListing.invalidate(),
          utils.places.publicPlace.invalidate(),
        ]);
      }}
    />
  );
}

/** Mapa público: zona aproximada de una tienda, servicio o anuncio. No muestra nada sin ubicación. */
export function PublicPlaceMap({
  kind,
  id,
  slug,
  title = "Ubicación",
}: {
  kind: PublicPlaceKind;
  id?: number;
  slug?: string;
  title?: string;
}) {
  const q = trpc.places.publicPlace.useQuery(
    { kind, ...(id ? { id } : {}), ...(slug ? { slug } : {}) },
    { staleTime: 5 * 60_000, enabled: Boolean(id || slug) }
  );
  if (!q.data) return null;
  return (
    <section className="cz-public-map">
      <h2>{title}</h2>
      <Canvas label={`${title}: zona aproximada`} area={q.data} height={220} />
      <p className="cz-map-hint">
        Zona aproximada. La dirección exacta se comparte al hacer un pedido o al
        contactar al anunciante.
      </p>
    </section>
  );
}

function Directions({ to, label }: { to: Point; label: string }) {
  const links = directionsLinks(to);
  return (
    <p className="cz-map-actions">
      <Navigation size={16} aria-hidden="true" /> {label}:
      <a
        className="btn btn-outline"
        href={links.google}
        target="_blank"
        rel="noopener noreferrer"
      >
        Google Maps
      </a>
      <a
        className="btn btn-outline"
        href={links.waze}
        target="_blank"
        rel="noopener noreferrer"
      >
        Waze
      </a>
    </p>
  );
}

/** En un pedido: el comprador y la tienda ven el punto exacto del otro. */
export function OrderPlacesMap({ orderId }: { orderId: number }) {
  const q = trpc.places.order.useQuery({ id: orderId });
  const d = q.data;
  if (!d || (!d.buyer && !d.store)) return null;
  const markers: CanvasMarker[] = [];
  if (d.store) markers.push({ ...d.store, label: "Tienda", color: "#0b2a4a" });
  if (d.buyer) markers.push({ ...d.buyer, label: "Entrega", color: "#c0583a" });
  const other = d.viewer === "seller" ? d.buyer : d.store;
  return (
    <section className="cz-public-map">
      <h2>Mapa de la entrega</h2>
      <Canvas label="Mapa de la entrega" markers={markers} height={280} />
      {other && (
        <Directions
          to={other}
          label={d.viewer === "seller" ? "Ir al comprador" : "Ir a la tienda"}
        />
      )}
      {!d.store && d.viewer === "seller" && (
        <p className="cz-map-hint">
          Marca la ubicación de tu negocio en «Mi tienda» para que el comprador
          la vea.
        </p>
      )}
    </section>
  );
}
