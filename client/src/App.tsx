import { StoreDirectoryPage } from "./features/commerce/StoreDirectoryPage";
import {
  PublicCatalogProvider,
  type PublicSnapshot,
} from "./contexts/PublicCatalogContext";
import {
  LiveCatalogPage,
  LiveStorePage,
} from "./features/commerce/PublicCatalogPages";
import { RealDetailPage } from "./features/commerce/RealDetailPage";
import {
  RealCartPage,
  RealWishlistPage,
  RealCheckoutPage,
  OrdersPage,
  OrderDetailPage,
} from "./features/commerce/BuyerPages";
import {
  MessagesPage,
  NotificationsPage,
} from "./features/commerce/CommunicationPages";
import { SellerCatalogPage } from "./features/catalog/SellerCatalogPage";
import { useEffect } from "react";
import { Link, Route, Switch, useLocation, useSearch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MarketProvider } from "./contexts/MarketContext";
import MarketLayout from "./components/marketplace/MarketLayout";
import Home from "./pages/Home";
import CatalogPage from "./pages/marketplace/CatalogPage";
import DetailPage from "./pages/marketplace/DetailPage";
import {
  StorePage,
  SubscriptionsPage,
  SellPage,
  CartPage,
  WishlistPage,
  CheckoutPage,
  HelpPage,
  LegalPage,
} from "./pages/marketplace/SupportingPages";
import { getPageMeta } from "./lib/pageMeta";
import { AccountPage } from "./features/membership/AccountPage";
import { SellerApplicationPage } from "./features/membership/SellerApplicationPage";
import { SellerPlanPage } from "./features/membership/SellerPlanPage";
import { SellerStatusPage } from "./features/membership/SellerStatusPage";
import { AdminVerificationPage } from "./features/membership/AdminVerificationPage";

function PageMetadata() {
  const [location] = useLocation();
  const search = useSearch();
  useEffect(() => {
    const meta = getPageMeta(
      `${location}${search ? `?${search.replace(/^\?/, "")}` : ""}`
    );
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", meta.description);
  }, [location, search]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}
function NotFound() {
  return (
    <div className="container not-found">
      <span className="eyebrow">404 · RUTA NO DISPONIBLE</span>
      <h1>Este camino aún no existe.</h1>
      <p>Regresa al marketplace y descubre algo nuevo.</p>
      <Link className="btn btn-gold" href="/">
        Ir al inicio
      </Link>
    </div>
  );
}
function Router() {
  const search = useSearch();
  return (
    <>
      <PageMetadata />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/mercado" component={LiveCatalogPage} />
        <Route path="/articulo/:slug">
          {p => <RealDetailPage key={p.slug} slug={p.slug} />}
        </Route>
        <Route path="/tiendas">
          {() => <StoreDirectoryPage key={search} />}
        </Route>
        <Route path="/tiendas/:slug">
          {p => <LiveStorePage key={p.slug} slug={p.slug} />}
        </Route>
        <Route path="/mi-carrito" component={RealCartPage} />
        <Route path="/mi-lista" component={RealWishlistPage} />
        <Route path="/comprar" component={RealCheckoutPage} />
        <Route path="/pedidos">{() => <OrdersPage />}</Route>
        <Route path="/pedidos/:id">
          {p => <OrderDetailPage key={p.id} id={Number(p.id)} />}
        </Route>
        <Route path="/mensajes" component={MessagesPage} />
        <Route path="/notificaciones" component={NotificationsPage} />
        <Route path="/vendedor/plan" component={SellerPlanPage} />
        <Route path="/vendedor/productos">{() => <SellerCatalogPage />}</Route>
        <Route path="/vendedor/tienda">
          {() => <SellerCatalogPage tab="store" />}
        </Route>
        <Route path="/vendedor/pedidos">{() => <OrdersPage seller />}</Route>
        <Route path="/vendedor/mensajes" component={MessagesPage} />
        <Route path="/catalogo">{() => <CatalogPage />}</Route>
        <Route path="/libros">
          {() => <CatalogPage initialKind="libro" />}
        </Route>
        <Route path="/eventos">
          {() => <CatalogPage initialKind="evento" />}
        </Route>
        <Route path="/servicios">
          {() => <CatalogPage initialKind="servicio" />}
        </Route>
        <Route path="/producto/:slug">
          {params => <DetailPage slug={params.slug} key={params.slug} />}
        </Route>
        <Route path="/evento/:slug">
          {params => <DetailPage slug={params.slug} key={params.slug} />}
        </Route>
        <Route path="/servicio/:slug">
          {params => <DetailPage slug={params.slug} key={params.slug} />}
        </Route>
        <Route path="/tienda/:slug">
          {params => <StorePage slug={params.slug} />}
        </Route>
        <Route path="/suscripciones" component={SubscriptionsPage} />
        <Route path="/vender" component={SellPage} />
        <Route path="/carrito" component={CartPage} />
        <Route path="/deseos" component={WishlistPage} />
        <Route path="/favoritos" component={WishlistPage} />
        <Route path="/checkout" component={CheckoutPage} />
        <Route path="/mi-cuenta" component={AccountPage} />
        <Route path="/solicitud-vendedor" component={SellerApplicationPage} />
        <Route path="/vendedor" component={SellerStatusPage} />
        <Route path="/admin/verificaciones">
          {() => <AdminVerificationPage />}
        </Route>
        <Route path="/admin/suscripciones">
          {() => <AdminVerificationPage key="suscripciones" initialTab="suscripciones" />}
        </Route>
        <Route path="/admin/denominaciones">
          {() => (
            <AdminVerificationPage
              key="denominaciones"
              initialTab="denominaciones"
            />
          )}
        </Route>
        <Route path="/admin">{() => <AdminVerificationPage />}</Route>
        <Route path="/ayuda" component={HelpPage} />
        <Route path="/legal/:topic">
          {params => <LegalPage topic={params.topic} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </>
  );
}
const LOGIN_ERRORS: Record<string, string> = {
  cancelado: "Cancelaste el inicio de sesión con Google.",
  estado: "La sesión de inicio expiró. Vuelve a intentarlo.",
  correo_no_verificado: "Tu cuenta de Google no tiene el correo verificado.",
  fallo: "No pudimos completar el inicio de sesión. Inténtalo de nuevo.",
};

/** Muestra el motivo cuando Google devuelve al usuario con ?login_error=. */
function LoginErrorNotice() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("login_error");
    if (!code) return;
    toast.error(LOGIN_ERRORS[code] ?? LOGIN_ERRORS.fallo);
    url.searchParams.delete("login_error");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}

export default function App({ snapshot }: { snapshot?: PublicSnapshot }) {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <PublicCatalogProvider snapshot={snapshot}>
            <MarketProvider>
              <Toaster />
              <LoginErrorNotice />
              <MarketLayout>
                <Router />
              </MarketLayout>
            </MarketProvider>
          </PublicCatalogProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
