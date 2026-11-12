import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PANAMA_CENTER, type ApproxPlace, type Point } from "@shared/location";

export type CanvasMarker = Point & { label: string; color: string };

/**
 * Mapa de OpenStreetMap. Se carga aparte (React.lazy) para no pesar en las
 * páginas que no lo usan. Los marcadores son círculos, así no dependen de
 * imágenes de Leaflet.
 */
export default function LeafletCanvas({
  markers = [],
  area,
  pick,
  onPick,
  height = 260,
  label,
}: {
  markers?: CanvasMarker[];
  /** Zona aproximada (lo que ve el público). */
  area?: ApproxPlace | null;
  /** Punto que se puede mover tocando el mapa o arrastrándolo. */
  pick?: Point | null;
  onPick?: (p: Point) => void;
  height?: number;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, {
      center: [PANAMA_CENTER.lat, PANAMA_CENTER.lng],
      zoom: 8,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on("click", e =>
      pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    );
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    if (area) {
      L.circle([area.lat, area.lng], {
        radius: area.radiusM,
        color: "#5b7a1e",
        fillColor: "#5b7a1e",
        fillOpacity: 0.22,
        weight: 2,
      }).addTo(g);
      bounds.push([area.lat, area.lng]);
    }
    for (const mk of markers) {
      L.circleMarker([mk.lat, mk.lng], {
        radius: 9,
        color: "#fff",
        weight: 3,
        fillColor: mk.color,
        fillOpacity: 1,
      })
        .bindTooltip(mk.label, {
          permanent: markers.length > 1,
          direction: "top",
        })
        .addTo(g);
      bounds.push([mk.lat, mk.lng]);
    }
    if (pick) {
      const marker = L.marker([pick.lat, pick.lng], {
        draggable: true,
        icon: L.divIcon({
          className: "cz-map-pin",
          html: "<span></span>",
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        }),
        keyboard: true,
        title: "Arrastra para mover el punto",
      }).addTo(g);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        pickRef.current?.({ lat: ll.lat, lng: ll.lng });
      });
      bounds.push([pick.lat, pick.lng]);
    }
    if (bounds.length === 1) m.setView(bounds[0]!, area && !pick ? 14 : 16);
    else if (bounds.length > 1)
      m.fitBounds(L.latLngBounds(bounds), { padding: [36, 36] });
    // Se compara por contenido: un arreglo nuevo con los mismos puntos no mueve el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(markers), JSON.stringify(area), JSON.stringify(pick)]);

  return (
    <div
      ref={box}
      className="cz-map"
      style={{ height }}
      role="application"
      aria-label={label}
    />
  );
}
