import { CommerceNav } from "@/features/commerce/BuyerPages";
import { getSellerPlan, sellerPlanLabel } from "@shared/pricing";
import { AuthGate } from "@/features/membership/AuthGate";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Heart, LoaderCircle, LogOut, Save, ShieldCheck, ShoppingCart, Store, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { statusLabels } from "@shared/membership";

type ProfileForm = { displayName: string; email: string; phone: string };
const emptyForm: ProfileForm = { displayName: "", email: "", phone: "" };

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function AccountContent() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const membership = trpc.membership.me.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const profileSave = trpc.membership.profile.save.useMutation();
  const verifyEmail = trpc.membership.verification.emailWithGoogle.useMutation();
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const initialized = useRef(false);
  const profile = membership.data?.profile;
  const application = membership.data?.application;
  const preference = membership.data?.planSelection;
  const contactLocked = application?.status === "pending" || application?.status === "approved";
  const accountEmail = (user?.email ?? "").toLowerCase();
  const profileMatchesAccount = Boolean(profile && accountEmail && profile.email.toLowerCase() === accountEmail);
  const emailVerified = Boolean(profile?.emailVerifiedAt);
  const phoneVerified = Boolean(profile?.phoneVerifiedAt);

  useEffect(() => {
    if (initialized.current || membership.isLoading || !membership.data) return;
    initialized.current = true;
    setForm(profile ? {
      displayName: profile.displayName,
      email: profile.email,
      phone: profile.phone,
    } : emptyForm);
  }, [membership.isLoading, profile]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await profileSave.mutateAsync(form);
      await utils.membership.me.invalidate();
      toast.success("Perfil guardado");
    } catch (error) {
      toast.error("No se pudo guardar el perfil", { description: errorText(error, "Revisa los datos e inténtalo de nuevo.") });
    }
  };

  const verifyWithGoogle = async () => {
    try {
      await verifyEmail.mutateAsync();
      await utils.membership.me.invalidate();
      toast.success("Correo verificado");
    } catch (error) {
      toast.error("No se pudo verificar el correo", { description: errorText(error, "Inténtalo de nuevo.") });
    }
  };

  const doLogout = async () => {
    try {
      await logout();
      toast.success("Sesión cerrada");
    } catch (error) {
      toast.error("No se pudo cerrar la sesión", { description: errorText(error, "Inténtalo de nuevo.") });
    }
  };

  if (membership.isLoading) {
    return <div className="member-page"><div className="member-card member-loading-card"><LoaderCircle className="member-spin" size={25} /> Cargando tu membresía…</div></div>;
  }
  if (membership.error || !membership.data) {
    return (
      <div className="member-page">
        <div className="member-card member-error-card" role="alert">
          <h1>No pudimos cargar tu cuenta</h1>
          <p>{errorText(membership.error, "La información no está disponible ahora.")}</p>
          <button className="member-button member-button--gold" type="button" onClick={() => void membership.refetch()}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="member-page">
      <div className="member-page-heading">
        <div>
          <p className="member-eyebrow">MI CUADRAZONE</p>
          <h1>Mi cuenta</h1>
          <p>Gestiona tus datos persistentes y consulta el estado real de tu membresía.</p>
        </div>
        <button className="member-button member-button--outline" type="button" onClick={() => void doLogout()}>
          <LogOut size={16} aria-hidden="true" /> Cerrar sesión
        </button>
      </div>

      <div className="member-grid member-grid--account">
        <section className="member-card">
          <div className="member-card-heading"><div><p className="member-eyebrow">PERFIL</p><h2>Datos de contacto</h2></div><UserRound size={22} aria-hidden="true" /></div>
          <p className="member-muted">El correo y teléfono se guardan en tu perfil de CuadraZone. Entras con Google, con tu correo o con tu celular.</p>
          <form className="member-form" onSubmit={save}>
            <label className="member-field"><span>Nombre completo</span><Input value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} required minLength={2} maxLength={100} /></label>
            <label className="member-field"><span>Correo electrónico</span><Input type="email" value={form.email} readOnly={contactLocked} onChange={event => setForm({ ...form, email: event.target.value })} required maxLength={320} /><small>{contactLocked ? "Bloqueado mientras la solicitud está pendiente o aprobada." : accountEmail ? `Si usas ${accountEmail} (el correo con el que entras) quedará verificado al guardar.` : "Si no es el correo con el que entras, podrás verificarlo con un código."}</small></label>
            <label className="member-field"><span>Teléfono de Panamá <small>(+507 y 8 dígitos)</small></span><Input value={form.phone} readOnly={contactLocked} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+50760000000" pattern="^$|\+507\d{8}" /><small>Opcional para compradores; necesario para una solicitud de vendedor.</small></label>
            <div className="member-form-actions"><button className="member-button member-button--gold" type="submit" disabled={profileSave.isPending}><Save size={16} /> {profileSave.isPending ? "Guardando…" : "Guardar perfil"}</button></div>
          </form>
        </section>

        <aside className="member-card member-card--soft">
          <div className="member-card-heading"><div><p className="member-eyebrow">VERIFICACIONES</p><h2>Estado de contacto</h2></div><CheckCircle2 size={22} aria-hidden="true" /></div>
          <div className="member-status-list">
            <div className="member-status-row"><span>Correo</span><strong className={emailVerified ? "member-status member-status--ok" : "member-status member-status--pending"}>{emailVerified ? "Verificado" : "Pendiente"}</strong></div>
            <div className="member-status-row"><span>Teléfono</span><strong className={phoneVerified ? "member-status member-status--ok" : "member-status member-status--pending"}>{phoneVerified ? "Verificado" : "Pendiente"}</strong></div>
          </div>
          <p className="member-muted"><strong>Correo:</strong> si es el mismo con el que entras a CuadraZone, queda verificado al guardar tu perfil. Si es otro, verifícalo con un código.</p>
          {!emailVerified && profile && (
            profileMatchesAccount ? (
              <div className="member-actions member-actions--stack">
                <button className="member-button member-button--gold" type="button" onClick={() => void verifyWithGoogle()} disabled={verifyEmail.isPending}>
                  {verifyEmail.isPending ? "Verificando…" : "Verificar con mi cuenta"}
                </button>
              </div>
            ) : (
              <ContactCodeVerifier channel="email" label={profile.email} onVerified={() => utils.membership.me.invalidate()} />
            )
          )}
          <p className="member-muted"><strong>Teléfono:</strong> verifícalo tú mismo con un código por SMS. Si no puedes recibirlo, el equipo de CuadraZone lo confirma por llamada o WhatsApp al revisar tu solicitud.</p>
          {!phoneVerified && profile?.phone && (
            <ContactCodeVerifier channel="phone" label={profile.phone} onVerified={() => utils.membership.me.invalidate()} />
          )}
        </aside>
      </div>

      <section className="member-card">
        <div className="member-card-heading"><div><p className="member-eyebrow">MEMBRESÍA</p><h2>Tu recorrido</h2></div><Store size={22} aria-hidden="true" /></div>
        {application ? <p className="member-notice member-notice--info">Solicitud: <strong>{statusLabels[application.status]}</strong>{application.status === "approved" ? ` · La activación de tienda requiere pago mensual de vendedor (${sellerPlanLabel(preference?.planId ?? "normal")}/mes), todavía pendiente.` : ""}</p> : <p className="member-muted">Eres comprador gratuito. Puedes explorar CuadraZone sin mensualidad.</p>}
        <p className="member-muted">{preference ? `Preferencia: ${getSellerPlan(preference.planId).name} · ${sellerPlanLabel(preference.planId)}/mes. No equivale a pago o beneficios activos.` : "No has guardado un plan. Puedes elegir Normal o Mayor Visibilidad sin realizar un cobro."}</p>
        <div className="member-link-grid">
          <Link className="member-link-card" href="/vendedor/plan"><Store size={18} /> Mi plan <span>Elegir o consultar</span></Link>
          <Link className="member-link-card" href="/favoritos"><Heart size={18} /> Favoritos <span>Prototipo</span></Link>
          <Link className="member-link-card" href="/carrito"><ShoppingCart size={18} /> Carrito <span>Prototipo</span></Link>
          <Link className="member-link-card" href="/solicitud-vendedor"><Store size={18} /> Solicitud de vendedor <span>{application ? "Ver solicitud" : "Comenzar"}</span></Link>
          <Link className="member-link-card" href="/vendedor"><Store size={18} /> Estado de vendedor <span>{application ? statusLabels[application.status] : "Sin solicitud"}</span></Link>
          {user?.role === "admin" && <Link className="member-link-card" href="/admin"><ShieldCheck size={18} /> Revisión administrativa <span>Panel protegido</span></Link>}
        </div>
      </section>
    </div>
  );
}

export function AccountPage() {
  return <AuthGate><AccountContent /></AuthGate>;
}

/** Envía un código al correo o celular del perfil y lo confirma (Mi cuenta). */
function ContactCodeVerifier({ channel, label, onVerified }: { channel: "email" | "phone"; label: string; onVerified: () => Promise<unknown> }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [sent, setSent] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/auth/methods", { credentials: "include" }).then(r => r.json()).then(m => setAvailable(Boolean(m[channel]))).catch(() => setAvailable(false));
  }, [channel]);
  async function call(url: string, body: unknown) {
    const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-cz-request": "1" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Ocurrió un error.");
    return data;
  }
  async function send() {
    setBusy(true); setError("");
    try { const r = await call("/api/account/contact/request", { channel }); setSent(r.masked); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo enviar."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    setBusy(true); setError("");
    try { await call("/api/account/contact/verify", { channel, code }); toast.success(channel === "phone" ? "Celular verificado" : "Correo verificado"); await onVerified(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo verificar."); }
    finally { setBusy(false); }
  }
  if (!available) return null;
  return (
    <div className="member-actions member-actions--stack">
      {!sent ? (
        <button className="member-button member-button--gold" type="button" disabled={busy} onClick={() => void send()}>
          {busy ? "Enviando…" : `Enviar código a ${label}`}
        </button>
      ) : (
        <>
          <p>Escribe el código que enviamos a <strong>{sent}</strong>.</p>
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-label="Código de verificación" />
          <button className="member-button member-button--gold" type="button" disabled={busy || code.length !== 6} onClick={() => void confirm()}>
            {busy ? "Verificando…" : "Verificar"}
          </button>
        </>
      )}
      {error && <p className="member-error" role="alert">{error}</p>}
    </div>
  );
}
