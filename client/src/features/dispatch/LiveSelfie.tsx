import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";

/** Lado de la selfie que se sube (cuadrada). */
const SIZE = 720;

/** ¿Es un celular o tableta? La selfie en vivo se toma con el celular. */
export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    navigator.maxTouchPoints > 0 &&
    window.matchMedia?.("(pointer: coarse)").matches === true
  );
}

/**
 * Selfie en vivo con la cámara de frente del celular. No deja elegir una foto
 * de la galería: así comprobamos que quien se registra es quien va a manejar.
 */
export function LiveSelfie({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);

  function stop() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setReady(false);
  }

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch {
      setError(
        "No pudimos abrir la cámara. Permite el uso de la cámara para CuadraZone en tu celular y vuelve a intentar."
      );
    }
  }

  useEffect(() => {
    void start();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  async function take() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const side = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas
      .getContext("2d")!
      .drawImage(
        video,
        (video.videoWidth - side) / 2,
        (video.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        SIZE,
        SIZE
      );
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return;
    stop();
    setShot({ url: URL.createObjectURL(blob), blob });
  }

  async function retake() {
    setShot(null);
    await start();
  }

  return (
    <div className="selfie-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="selfie-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="selfie-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="selfie-head">
          <h2 id="selfie-title">Selfie en vivo</h2>
          <button type="button" className="selfie-close" aria-label="Cerrar" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        <p className="re-muted re-small">
          Mira a la cámara, con buena luz y sin gorra ni lentes oscuros. Tu cara
          debe verse completa dentro del círculo.
        </p>
        <div className="selfie-stage">
          {shot ? (
            <img src={shot.url} alt="Tu selfie" />
          ) : (
            <video ref={videoRef} playsInline muted aria-label="Vista de tu cámara" />
          )}
          <span className="selfie-ring" aria-hidden="true" />
        </div>
        {error && (
          <p className="dz-doc-missing" role="alert">
            {error}
          </p>
        )}
        <div className="selfie-actions">
          {shot ? (
            <>
              <button type="button" className="btn btn-outline" onClick={() => void retake()}>
                <RefreshCw size={16} aria-hidden="true" /> Repetir
              </button>
              <button
                type="button"
                className="btn btn-gold"
                onClick={() => onDone(new File([shot.blob], "selfie-en-vivo.jpg", { type: "image/jpeg" }))}
              >
                Usar esta selfie
              </button>
            </>
          ) : error ? (
            <button type="button" className="btn btn-gold" onClick={() => void start()}>
              Intentar de nuevo
            </button>
          ) : (
            <button type="button" className="btn btn-gold" disabled={!ready} onClick={() => void take()}>
              <Camera size={16} aria-hidden="true" /> {ready ? "Tomar selfie" : "Abriendo cámara…"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
