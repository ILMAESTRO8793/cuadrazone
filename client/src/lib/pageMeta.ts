import type { PublicSnapshot } from "../contexts/PublicCatalogContext";
import { listings, sellers } from "@/data/catalog";
export function getPageMeta(url: string, snapshot: PublicSnapshot = {}) {
  const path = new URL(url, "https://route-parser.invalid").pathname;
  let title = "CuadraZone | Comunidad, compras y propósito en Panamá";
  let description =
    "Descubre productos, libros cristianos, eventos y servicios de emprendedores en Panamá. Vista previa del marketplace CuadraZone, sin cobros activos.";
  let status = 200;
  const titles: Record<string, string> = {
    "/mercado": "Catálogo de tiendas activas",
    "/tiendas": "Tiendas por categoría y especialidad",
    "/mi-carrito": "Mi carrito guardado",
    "/mi-lista": "Mi lista de deseos",
    "/comprar": "Registro del pedido",
    "/pedidos": "Mis pedidos",
    "/mensajes": "Mensajes privados",
    "/notificaciones": "Notificaciones",
    "/vendedor/productos": "Mis productos y libros",
    "/vendedor/tienda": "Mi tienda",
    "/vendedor/pedidos": "Pedidos de mi tienda",
    "/vendedor/mensajes": "Mensajes de mi tienda",
    "/catalogo": "Catálogo de ejemplo",
    "/libros": "Libros cristianos",
    "/eventos": "Eventos y conciertos",
    "/servicios": "Servicios profesionales",
    "/suscripciones": "Planes Normal US$19.99 y Mayor Visibilidad US$39.99",
    "/vendedor/plan": "Mi selección de plan",
    "/vender": "Vende en CuadraZone",
    "/carrito": "Carrito de demostración",
    "/deseos": "Tus favoritos",
    "/favoritos": "Tus favoritos",
    "/checkout": "Checkout de demostración",
    "/mi-cuenta": "Mi cuenta",
    "/vendedor": "Mi estado de vendedor",
    "/admin": "Administración protegida",
    "/solicitud-vendedor": "Solicitud de vendedor",
    "/admin/verificaciones": "Revisión de vendedores",
    "/admin/denominaciones": "Administrar denominaciones",
    "/ayuda": "Centro de ayuda",
  };
  if (titles[path]) title = `${titles[path]} | CuadraZone Panamá`;
  else if (path.startsWith("/articulo/")) {
    if (snapshot.product) {
      title = `${snapshot.product.title} | CuadraZone`;
      description = snapshot.product.description;
    } else if ("product" in snapshot) status = 404;
  } else if (path.startsWith("/tiendas/")) {
    if (snapshot.store) {
      title = `${snapshot.store.store.name} | CuadraZone`;
      description = snapshot.store.store.description;
    } else if ("store" in snapshot) status = 404;
  } else if (/^\/pedidos\/\d+$/.test(path)) {
    title = "Detalle de pedido | CuadraZone";
  } else if (/^\/(producto|evento|servicio)\//.test(path)) {
    const item = listings.find(item => item.slug === path.split("/")[2]);
    if (item) {
      title = `${item.title} | CuadraZone`;
      description = item.description;
    } else status = 404;
  } else if (path.startsWith("/tienda/")) {
    const seller = sellers.find(seller => seller.id === path.split("/")[2]);
    if (seller) {
      title = `${seller.name} | Tienda de ejemplo CuadraZone`;
      description = seller.about;
    } else status = 404;
  } else if (
    path.startsWith("/legal/") &&
    !["terminos", "privacidad", "conducta", "reclamos", "fe"].includes(
      path.split("/")[2]
    )
  ) {
    status = 404;
  } else if (path.startsWith("/legal/")) {
    title = "Borradores legales | CuadraZone Panamá";
    description =
      "Estructura de documentos de CuadraZone, pendiente de revisión jurídica y pastoral. No constituye asesoría legal.";
  } else if (path !== "/") status = 404;
  if (snapshot.badRequest) status = 400;
  if (snapshot.failed) status = 503;
  if (status === 404) {
    title = "Página no encontrada | CuadraZone";
    description =
      "Esta ruta o publicación no existe en la vista previa de CuadraZone.";
  }
  return {
    title,
    description,
    status,
    private:
      path.startsWith("/pedidos/") ||
      [
        "/mercado-privado",
        "/mi-carrito",
        "/mi-lista",
        "/comprar",
        "/pedidos",
        "/mensajes",
        "/notificaciones",
        "/vendedor/plan",
        "/vendedor/productos",
        "/vendedor/tienda",
        "/vendedor/pedidos",
        "/vendedor/mensajes",
        "/carrito",
        "/checkout",
        "/deseos",
        "/favoritos",
        "/mi-cuenta",
        "/vendedor",
        "/admin",
        "/solicitud-vendedor",
        "/admin/verificaciones",
        "/admin/denominaciones",
      ].includes(path),
  };
}
