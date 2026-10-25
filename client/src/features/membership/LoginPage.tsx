import { useEffect, useState } from "react";
import { Mail, Smartphone } from "lucide-react";
import { safeReturnPath } from "@shared/const";
import { Input } from "@/components/ui/input";

type Methods = { google: boolean; email: boolean; phone: boolean };
type Channel = "email" | "phone";

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-cz-request": "1" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Ocurrió un error. Inténtalo de nuevo.");
  return data;
}

function returnToFromUrl() {
  if (typeof window === "undefined") return "/";
  return safeReturnPath(new URL(window.location.href).searchParams.get("returnTo"));
}

export function LoginPage() {
  const [methods, setMethods] = useState<Methods | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [destination, setDestination] = useState("");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    fetch("/api/auth/methods", { credentials: "include" })
      .then(r => r.json())
      .then(setMethods)
      .catch(() => setMethods({ google: false, email: false, phone: false }));
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    if (!channel) return;
    setBusy(true); setError("");
    try {
      const result = await post("/api/auth/code/request", { channel, destination });
      setMasked(result.masked); setCode(""); setWait(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el código.");
    } finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!channel) return;
    setBusy(true); setError("");
    try {
      const result = await post("/api/auth/code/verify", { channel, destination, code, returnTo: returnToFromUrl() });
      window.location.href = safeReturnPath(result.returnTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo verificar el código.");
      setBusy(false);
    }
  }

  const choose = (next: Channel) => { setChannel(next); setDestination(""); setMasked(""); setCode(""); setError(""); };
  const googleHref = `/api/auth/google?returnTo=${encodeURIComponent(returnToFromUrl())}`;

  return (
    <div className="member-page container">
      <section className="member-card member-auth-card">
        <p className="eyebrow">CuadraZone</p>
        <h1>Entra o crea tu cuenta</h1>
        <p className="member-muted">Si es tu primera vez, tu cuenta se crea gratis al instante.</p>

        {!methods && <p role="status">Cargando opciones…</p>}

        {methods && !masked && (
          <div className="member-actions member-actions--stack">
            {methods.google && (
              <a className="member-button member-button--gold" href={googleHref}>Continuar con Google</a>
            )}
            {methods.email && (
              <button type="button" className={`member-button ${channel === "email" ? "member-button--active" : ""}`} onClick={() => choose("email")}>
                <Mail size={18} aria-hidden="true" /> Entrar con mi correo
              </button>
            )}
            {methods.phone && (
              <button type="button" className={`member-button ${channel === "phone" ? "member-button--active" : ""}`} onClick={() => choose("phone")}>
                <Smartphone size={18} aria-hidden="true" /> Entrar con mi celular
              </button>
            )}
            {!methods.google && !methods.email && !methods.phone && (
              <p className="member-notice member-notice--warning">La entrada todavía no está configurada. Vuelve a intentarlo más tarde.</p>
            )}
          </div>
        )}

        {channel && !masked && (
          <form className="member-form" onSubmit={sendCode}>
            <label className="member-field">
              <span>{channel === "email" ? "Tu correo (Gmail, Hotmail, Yahoo u otro)" : "Tu celular de Panamá"}</span>
              <Input
                type={channel === "email" ? "email" : "tel"}
                inputMode={channel === "email" ? "email" : "tel"}
                autoComplete={channel === "email" ? "email" : "tel"}
                placeholder={channel === "email" ? "nombre@correo.com" : "6123-4567"}
                value={destination}
                onChange={e => setDestination(e.target.value)}
                required
                autoFocus
              />
            </label>
            <button className="member-button member-button--gold" type="submit" disabled={busy || !destination.trim()}>
              {busy ? "Enviando…" : channel === "email" ? "Enviarme un código por correo" : "Enviarme un código por SMS"}
            </button>
          </form>
        )}

        {masked && (
          <form className="member-form" onSubmit={verify}>
            <p>Te enviamos un código de 6 dígitos a <strong>{masked}</strong>. Vence en 10 minutos.</p>
            <label className="member-field">
              <span>Código</span>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
              />
            </label>
            <button className="member-button member-button--gold" type="submit" disabled={busy || code.length !== 6}>
              {busy ? "Verificando…" : "Entrar"}
            </button>
            <div className="member-actions">
              <button type="button" className="member-button" disabled={busy || wait > 0} onClick={() => void sendCode()}>
                {wait > 0 ? `Reenviar en ${wait} s` : "Reenviar código"}
              </button>
              <button type="button" className="member-button" disabled={busy} onClick={() => { setMasked(""); setError(""); }}>
                Cambiar {channel === "email" ? "correo" : "número"}
              </button>
            </div>
          </form>
        )}

        {error && <p className="member-error" role="alert">{error}</p>}

        <p className="member-muted">Nunca te pediremos contraseñas. No compartas tu código con nadie, ni siquiera con alguien que diga ser de CuadraZone.</p>
      </section>
    </div>
  );
}
