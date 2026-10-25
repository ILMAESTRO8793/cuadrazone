import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { LoaderCircle, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";

function LoginAction({ label }: { label: string }) {
  const login = () => {
    try {
      startLogin();
    } catch (error) {
      toast.error("No se pudo iniciar sesión", {
        description: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
    }
  };
  return (
    <button className="member-button member-button--gold" type="button" onClick={login}>
      <UserRound size={17} aria-hidden="true" />
      {label}
    </button>
  );
}

function Shell({ children, busy = false }: { children: React.ReactNode; busy?: boolean }) {
  return <div className="member-shell" aria-busy={busy}>{children}</div>;
}

export function AuthGate({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, ready, loading, isAuthenticated } = useAuth();

  // Mantiene el primer render igual al SSR mientras se resuelve la sesión.
  if (!ready || loading) {
    return (
      <Shell busy>
        <div className="member-state member-state--loading">
          <LoaderCircle className="member-spin" size={30} aria-hidden="true" />
          <h1>Preparando tu cuenta</h1>
          <p>Estamos comprobando tu sesión de CuadraZone.</p>
        </div>
      </Shell>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Shell>
        <div className="member-state">
          <span className="member-state-icon" aria-hidden="true"><UserRound size={28} /></span>
          <p className="member-eyebrow">CUADRAZONE</p>
          <h1>Inicia sesión para continuar</h1>
          <p>Entra con Google, con tu correo o con tu celular. Si es tu primera vez, tu cuenta de comprador se crea gratis al instante, sin mensualidad.</p>
          <div className="member-actions member-actions--center">
            <LoginAction label="Entrar o crear cuenta" />
          </div>
        </div>
      </Shell>
    );
  }

  if (requireAdmin && user.role !== "admin") {
    return (
      <Shell>
        <div className="member-state member-state--forbidden" role="alert">
          <span className="member-state-icon" aria-hidden="true"><ShieldAlert size={28} /></span>
          <p className="member-eyebrow">403 · ACCESO RESTRINGIDO</p>
          <h1>No tienes permiso para ver esta sección</h1>
          <p>La revisión administrativa está disponible únicamente para cuentas con rol administrador.</p>
        </div>
      </Shell>
    );
  }

  return <>{children}</>;
}

export default AuthGate;
