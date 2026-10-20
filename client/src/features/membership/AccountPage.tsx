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
      toast.success("Correo verificado con tu cuenta de Google");
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
          <p className="member-muted">El correo y teléfono se guardan en tu perfil de CuadraZone. Tu sesión proviene de tu cuenta de Google.</p>
          <form className="member-form" onSubmit={save}>
            <label className="member-field"><span>Nombre completo</span><Input value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} required minLength={2} maxLength={100} /></label>
            <label className="member-field"><span>Correo electrónico</span><Input type="email" value={form.email} readOnly={contactLocked} onChange={event => setForm({ ...form, email: event.target.value })} required maxLength={320} /><small>{contactLocked ? "Bloqueado mientras la solicitud está pendiente o aprobada." : accountEmail ? `Usa ${accountEmail} (tu cuenta de Google) y quedará verificado al guardar.` : "Usa el correo de tu cuenta de Google para verificarlo automáticamente."}</small></label>
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
          <p className="member-muted"><strong>Correo:</strong> se verifica con tu cuenta de Google. Debe ser el mismo correo con el que iniciaste sesión.</p>
          {!emailVerified && (
            profileMatchesAccount ? (
              <div className="member-actions member-actions--stack">
                <button className="member-button member-button--gold" type="button" onClick={() => void verifyWithGoogle()} disabled={verifyEmail.isPending}>
                  {verifyEmail.isPending ? "Verificando…" : "Verificar con mi cuenta de Google"}
                </button>
              </div>
            ) : (
              <p className="member-notice member-notice--warning">
                {profile ? `El correo del perfil (${profile.email}) no coincide con tu cuenta de Google${accountEmail ? ` (${accountEmail})` : ""}. Cámbialo y guarda el perfil para verificarlo.` : "Guarda tu perfil con el correo de tu cuenta de Google para verificarlo."}
              </p>
            )
          )}
          <p className="member-muted"><strong>Teléfono:</strong> lo confirma el equipo de CuadraZone por llamada o WhatsApp cuando revisa tu solicitud de vendedor. No necesitas hacer nada más que guardarlo correctamente.</p>
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
