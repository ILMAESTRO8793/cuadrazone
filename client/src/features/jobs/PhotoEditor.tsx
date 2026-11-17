import { useEffect, useRef, useState } from "react";
import { RotateCw, Sun, ZoomIn, Contrast } from "lucide-react";

/** Lado de la foto final (cuadrada; en el CV se ve redonda). */
const OUTPUT = 640;
/** Lado del recuadro de vista previa en pantalla. */
const VIEW = 280;

type Props = {
  file: File;
  onCancel: () => void;
  onDone: (file: File) => void;
};

/**
 * Editor de la foto del CV: mover, acercar, girar y ajustar luz y contraste.
 * Todo pasa en el navegador; solo se sube la foto ya recortada.
 */
export function PhotoEditor({ file, onCancel, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Cierra con Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  /** Dibuja la foto en un lienzo de `size` px con los ajustes actuales. */
  function draw(canvas: HTMLCanvasElement, size: number) {
    if (!img) return;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    const turned = rotation % 180 !== 0;
    const w = turned ? img.height : img.width;
    const h = turned ? img.width : img.height;
    // La foto cubre todo el recuadro con zoom 1.
    const scale = (Math.max(size / w, size / h) * zoom);
    const k = size / VIEW;
    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.translate(size / 2 + offset.x * k, size / 2 + offset.y * k);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, VIEW * 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, zoom, rotation, brightness, contrast, offset]);

  /** Mantiene la foto dentro del recuadro al moverla. */
  function clampOffset(x: number, y: number) {
    if (!img) return { x, y };
    const turned = rotation % 180 !== 0;
    const w = turned ? img.height : img.width;
    const h = turned ? img.width : img.height;
    const scale = Math.max(VIEW / w, VIEW / h) * zoom;
    const maxX = Math.max(0, (w * scale - VIEW) / 2);
    const maxY = Math.max(0, (h * scale - VIEW) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  useEffect(() => {
    setOffset(o => clampOffset(o.x, o.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, rotation, img]);

  async function save() {
    setSaving(true);
    const out = document.createElement("canvas");
    draw(out, OUTPUT);
    const blob = await new Promise<Blob | null>(resolve =>
      out.toBlob(resolve, "image/jpeg", 0.9)
    );
    setSaving(false);
    if (blob) onDone(new File([blob], "foto-cv.jpg", { type: "image/jpeg" }));
  }

  const nudge = (dx: number, dy: number) =>
    setOffset(o => clampOffset(o.x + dx, o.y + dy));

  return (
    <div className="photo-editor-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="photo-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-editor-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="photo-editor-title">Ajusta tu foto</h2>
        <p className="re-muted re-small">
          Arrastra la foto para centrar tu cara. Usa los controles para
          acercar, girar y mejorar la luz.
        </p>
        <div
          className="photo-editor-stage"
          tabIndex={0}
          aria-label="Vista previa. Usa las flechas para mover la foto."
          onPointerDown={e => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={e => {
            if (!drag.current) return;
            // En pantallas angostas el recuadro se ve más chico que VIEW.
            const k = VIEW / e.currentTarget.getBoundingClientRect().width;
            setOffset(
              clampOffset(
                drag.current.ox + (e.clientX - drag.current.x) * k,
                drag.current.oy + (e.clientY - drag.current.y) * k
              )
            );
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={e => {
            const step = 8;
            if (e.key === "ArrowLeft") nudge(-step, 0);
            else if (e.key === "ArrowRight") nudge(step, 0);
            else if (e.key === "ArrowUp") nudge(0, -step);
            else if (e.key === "ArrowDown") nudge(0, step);
            else return;
            e.preventDefault();
          }}
        >
          <canvas ref={canvasRef} />
          <span className="photo-editor-ring" aria-hidden="true" />
        </div>
        <div className="photo-editor-controls">
          <label>
            <span><ZoomIn size={16} aria-hidden="true" /> Acercar</span>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          </label>
          <label>
            <span><Sun size={16} aria-hidden="true" /> Luz</span>
            <input type="range" min={60} max={150} value={brightness} onChange={e => setBrightness(Number(e.target.value))} />
          </label>
          <label>
            <span><Contrast size={16} aria-hidden="true" /> Contraste</span>
            <input type="range" min={60} max={150} value={contrast} onChange={e => setContrast(Number(e.target.value))} />
          </label>
          <div className="photo-editor-row">
            <button type="button" className="btn btn-outline" onClick={() => setRotation(r => (r + 90) % 360)}>
              <RotateCw size={16} aria-hidden="true" /> Girar
            </button>
            <button
              type="button"
              className="re-back"
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setBrightness(100);
                setContrast(100);
                setOffset({ x: 0, y: 0 });
              }}
            >
              Volver a la original
            </button>
          </div>
        </div>
        <div className="photo-editor-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-gold" disabled={!img || saving} onClick={() => void save()}>
            {saving ? "Guardando…" : "Usar esta foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
