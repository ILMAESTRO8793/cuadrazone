import type { ReactNode } from "react";
import { Link } from "wouter";
import { Lock } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import "./sellerAccessGate.css";

/**
 * No hay plan gratis para vendedores: si el plan venció (o la tienda está
 * retenida por comisión o suspendida), el vendedor no puede entrar a su tienda
 * y sus productos y servicios no se ven. En cuanto se confirma el pago, la
 * tienda se reactiva sola y esta pantalla desaparece.
 */
export function SellerAccessGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const sub = trpc.membership.subscription.mine.useQuery(undefined, {
    enabled: !auth.loading && Boolean(auth.user),
    refetchOnWindowFocus: true,
    retry: false,
  });
  const s = sub.data?.subscription;
  const blocked =
    Boolean(s) && s!.status !== "active" && auth.user?.role !== "admin";
  // Mientras esté bloqueado, revisa cada minuto: al confirmarse el pago se abre solo.
  trpc.membership.subscription.mine.useQuery(undefined, {
    enabled: blocked,
    refetchInterval: 60_000,
  });

  if (auth.loading || (auth.user && sub.isLoading))
    return (
      <p className="container seller-gate-loading" role="status">
        Cargando tu tienda…
      </p>
    );
  if (!blocked) return <>{children}</>;

  const hold = (s!.holdReason ?? null) as string | null;
  const title =
    hold === "suspended"
      ? "Tu tienda está suspendida"
      : hold === "commission"
        ? "Tu tienda está en pausa por una comisión pendiente"
        : s!.status === "cancelled"
          ? "Tu tienda está desactivada"
          : "Tu plan ha vencido";
  const body =
    hold === "suspended"
      ? "El equipo de CuadraZone suspendió tu tienda. Escríbenos para saber cómo reactivarla."
      : hold === "commission"
        ? "Para entrar a tu tienda o a tus servicios, paga la comisión de tus ventas del mes pasado."
        : "Para entrar a tu tienda o a tus servicios, paga tu plan. Puedes pagar por mes o el año completo con 10 % de descuento.";

  return (
    <div className="container seller-gate">
      <section className="seller-gate-card" role="alert">
        <span className="seller-gate-icon" aria-hidden="true">
          <Lock size={28} />
        </span>
        <h1>{title}</h1>
        <p>{body}</p>
        <ul>
          <li>
            Mientras tanto, tus productos y servicios no se muestran a los
            compradores.
          </li>
          <li>No se borra nada: todo queda guardado tal como lo dejaste.</li>
          <li>
            En cuanto confirmemos tu pago, tu tienda se reactiva sola y vuelve a
            verse.
          </li>
        </ul>
        {hold !== "suspended" && (
          <div className="seller-gate-actions">
            <Link href="/vendedor" className="btn btn-gold">
              Pagar y avisar que pagué
            </Link>
            <Link href="/vendedor/plan" className="btn btn-outline">
              Ver planes: mensual o anual
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
