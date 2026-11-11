import type { PublicSnapshot } from "../contexts/PublicCatalogContext";
import { listings, sellers } from "@/data/catalog";
import { isLegalTopic, legalDocs } from "@/data/legal";
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
    "/mis-boletos": "Mis boletos",
    "/vendedor/eventos": "Mis eventos",
    "/vendedor/panel": "Resumen de mi tienda",
    "/mis-citas": "Mis citas",
    "/vendedor/agenda": "Mi agenda",
    "/servicios": "Servicios en Panamá",
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
    "/admin/suscripciones": "Suscripciones y comisiones",
    "/admin/reclamos": "Reclamos",
    "/admin/moderacion": "Moderación",
    "/admin/reportes": "Reportes",
    "/admin/portada": "Portada",
    "/entrar": "Entrar o crear cuenta",
    "/bienes-raices": "Bienes raíces: venta y alquiler",
    "/bienes-raices/mis-anuncios": "Mis anuncios de bienes raíces",
    "/autos": "Autos: venta y alquiler",
    "/autos/mis-anuncios": "Mis autos",
    "/empleos": "Buscar empleo en Panamá",
    "/empleos/mi-cv": "Mi CV",
    "/empleos/mis-postulaciones": "Mis postulaciones",
    "/empleos/mis-vacantes": "Mis vacantes",
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
  } else if (/^\/servicio\/[a-z0-9-]{1,180}$/.test(path)) {
    // Servicio real de una tienda de servicios: se carga en el navegador.
    title = "Servicio | CuadraZone Panamá";
    description = "Servicios de emprendedores en Panamá: clases, reparaciones, consultas y más. Solicítalo y te contactan.";
  } else if (/^\/evento\/[a-z0-9-]{1,180}$/.test(path)) {
    // Evento real de una tienda: se carga en el navegador.
    title = "Evento | CuadraZone Panamá";
    description = "Conciertos, conferencias y encuentros en Panamá. Aparta tus boletos con código QR.";
  } else if (/^\/vendedor\/escanear\/\d+$/.test(path)) {
    title = "Escanear boletos | CuadraZone";
  } else if (/^\/producto\//.test(path)) {
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
  } else if (path.startsWith("/legal/") && !isLegalTopic(path.split("/")[2] ?? "")) {
    status = 404;
  } else if (path.startsWith("/legal/")) {
    const doc = legalDocs[path.split("/")[2]];
    title = `${doc.title} | CuadraZone Panamá`;
    description = doc.intro.slice(0, 155);
  } else if (/^\/empleos\/[a-z0-9-]{1,160}$/.test(path)) {
    title = "Vacante de empleo | CuadraZone Panamá";
    description = "Vacantes de empleo en Panamá. Crea tu CV gratis y aplica con un clic.";
  } else if (/^\/autos\/[a-z0-9-]{1,160}$/.test(path)) {
    title = "Auto en venta o alquiler | CuadraZone Panamá";
    description = "Autos y motos en venta o alquiler en Panamá.";
  } else if (/^\/bienes-raices\/[a-z0-9-]{1,160}$/.test(path)) {
    // Ficha de un inmueble: se carga en el navegador.
    title = "Propiedad en venta o alquiler | CuadraZone Panamá";
    description = "Casas, apartamentos, terrenos y locales en venta o alquiler en Panamá.";
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
      path.startsWith("/vendedor/escanear/") ||
      [
        "/mis-boletos",
        "/mis-citas",
        "/vendedor/agenda",
        "/vendedor/eventos",
        "/vendedor/panel",
        "/admin/reclamos",
        "/admin/moderacion",
        "/admin/reportes",
        "/admin/portada",
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
        "/admin/suscripciones",
        "/entrar",
        "/bienes-raices/mis-anuncios",
        "/autos/mis-anuncios",
        "/empleos/mi-cv",
        "/empleos/mis-postulaciones",
        "/empleos/mis-vacantes",
      ].includes(path),
  };
}
