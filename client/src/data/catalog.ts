export type ListingKind = "producto" | "libro" | "evento" | "servicio";
export type Listing = {
  id: string;
  slug: string;
  title: string;
  kind: ListingKind;
  category: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  sellerId: string;
  province: string;
  image: string;
  tag?: string;
  description: string;
  details: [string, string][];
};
// Fotos de demostración con licencia de Unsplash (uso comercial libre, sin atribución obligatoria).
// Créditos: mercado: Giri; auriculares: Petr Macháček; bolso: Kouji Tsuru;
// Biblia: Sixteen Miles Out; alabanza: Kevin Wright; herramientas: benjamin lehman.
// Al tener fotos reales de la comunidad, reemplaza estas URLs por rutas en /assets/.
export const assets = {
  logo: "/assets/logo-carrito-blanco.png",
  hero: "https://images.unsplash.com/photo-1770129157442-5f080cacf11c?auto=format&fit=crop&w=1600&q=75",
  headphones: "https://images.unsplash.com/photo-1553774661-0651f14b2da4?auto=format&fit=crop&w=1200&q=75",
  tote: "https://images.unsplash.com/photo-1766634001794-b3003f486954?auto=format&fit=crop&w=1200&q=75",
  book: "https://images.unsplash.com/photo-1628257228852-a285d25296a6?auto=format&fit=crop&w=1200&q=75",
  event: "https://images.unsplash.com/photo-1724885794747-f4fb4dd8d0f2?auto=format&fit=crop&w=1200&q=75",
  service: "https://images.unsplash.com/photo-1645651964715-d200ce0939cc?auto=format&fit=crop&w=1200&q=75",
};
export const provinces = [
  "Panamá",
  "Panamá Oeste",
  "Chiriquí",
  "Colón",
  "Coclé",
  "Herrera",
  "Los Santos",
  "Veraguas",
  "Bocas del Toro",
  "Darién",
];
export const categories = [
  "Tecnología",
  "Moda y accesorios",
  "Hogar",
  "Libros cristianos",
  "Eventos",
  "Servicios",
];
export const sellers = [
  {
    id: "luz-hogar",
    name: "Luz & Hogar",
    initials: "LH",
    city: "Ciudad de Panamá",
    province: "Panamá",
    church: "Iglesia Cuadrangular · ejemplo",
    tagline: "Detalles para disfrutar cada día.",
    about:
      "Tienda ilustrativa de productos para el hogar y la vida diaria. Este perfil muestra cómo se presentarán los vendedores cuando hayan completado su verificación.",
    color: "#e6ede5",
  },
  {
    id: "semilla",
    name: "Librería Semilla",
    initials: "LS",
    city: "La Chorrera",
    province: "Panamá Oeste",
    church: "Asambleas de Dios · ejemplo",
    tagline: "Lecturas que acompañan tu camino.",
    about:
      "Perfil de demostración de una librería cristiana. Los productos, opiniones y datos de la tienda son ilustrativos y no representan una empresa verificada real.",
    color: "#f2eadb",
  },
  {
    id: "manos",
    name: "Manos de Panamá",
    initials: "MP",
    city: "David",
    province: "Chiriquí",
    church: "Iglesia de Dios · ejemplo",
    tagline: "Hecho con cuidado, hecho con propósito.",
    about:
      "Tienda de ejemplo para artesanías y accesorios. Sirve para revisar el diseño público del vendedor y su catálogo.",
    color: "#eadfe2",
  },
  {
    id: "encuentro",
    name: "Encuentro de Fe",
    initials: "EF",
    city: "Ciudad de Panamá",
    province: "Panamá",
    church: "Iglesia Cuadrangular · ejemplo",
    tagline: "Momentos para compartir en comunidad.",
    about:
      "Organizador ficticio utilizado para presentar el diseño de conciertos y boletos. No hay un evento ni entradas reales a la venta.",
    color: "#e7e1ef",
  },
  {
    id: "oficios",
    name: "Oficios con Propósito",
    initials: "OP",
    city: "Ciudad de Panamá",
    province: "Panamá",
    church: "Iglesia de Dios · ejemplo",
    tagline: "Soluciones para tu hogar.",
    about:
      "Perfil profesional de demostración. No se envían cotizaciones ni se confirman reservas reales en esta primera etapa.",
    color: "#dce8ec",
  },
];
export const listings: Listing[] = [
  {
    id: "auriculares",
    slug: "auriculares-inalambricos-crema",
    title: "Auriculares inalámbricos · edición negra",
    kind: "producto",
    category: "Tecnología",
    price: 45,
    oldPrice: 59,
    rating: 4.8,
    reviews: 24,
    sellerId: "luz-hogar",
    province: "Panamá",
    image: assets.headphones,
    tag: "Favorito de la comunidad",
    description:
      "Tu música, tus llamadas y tus momentos de calma. Diseño ligero, acabado mate y conexión inalámbrica para acompañarte durante el día. Producto ficticio de demostración.",
    details: [
      ["Color", "Negro"],
      ["Conectividad", "Bluetooth"],
      ["Estado", "Nuevo · demostración"],
      ["Entrega", "Envío o retiro en Panamá"],
    ],
  },
  {
    id: "biblia",
    slug: "biblia-de-estudio-lino",
    title: "Biblia de estudio · cubierta de lino",
    kind: "libro",
    category: "Libros cristianos",
    price: 32,
    rating: 4.9,
    reviews: 18,
    sellerId: "semilla",
    province: "Panamá Oeste",
    image: assets.book,
    tag: "Lectura destacada",
    description:
      "Un diseño cuidado para tus tiempos de lectura y estudio. Cubierta de lino, páginas con canto dorado y marcador de cinta. Libro ficticio mostrado para revisar el catálogo cristiano.",
    details: [
      ["Autor", "Edición de demostración"],
      ["Editorial", "Datos por completar"],
      ["ISBN", "Sin ISBN real · ejemplo"],
      ["Idioma", "Español"],
      ["Formato", "Tapa dura"],
      ["Estado", "Nuevo"],
    ],
  },
  {
    id: "bolso",
    slug: "bolso-artesanal-tejido",
    title: "Bolso artesanal tejido con asas de cuero",
    kind: "producto",
    category: "Moda y accesorios",
    price: 29.5,
    rating: 4.7,
    reviews: 12,
    sellerId: "manos",
    province: "Chiriquí",
    image: assets.tote,
    tag: "Hecho a mano",
    description:
      "Texturas naturales y un estilo sencillo para llevar tus esenciales. Un accesorio que muestra el espacio que tendrán las creaciones artesanales en CuadraZone. Artículo de demostración.",
    details: [
      ["Material", "Fibra natural y asas de cuero"],
      ["Tamaño", "Único"],
      ["Estado", "Nuevo · demostración"],
      ["Origen", "Perfil ilustrativo de Panamá"],
    ],
  },
  {
    id: "concierto",
    slug: "noche-de-alabanza",
    title: "Noche de alabanza · encuentro en comunidad",
    kind: "evento",
    category: "Eventos",
    price: 15,
    rating: 4.9,
    reviews: 9,
    sellerId: "encuentro",
    province: "Panamá",
    image: assets.event,
    tag: "Evento de ejemplo",
    description:
      "Una noche para compartir música, esperanza y comunidad. Evento ficticio utilizado para presentar la compra de boletos y el futuro acceso con QR.",
    details: [
      ["Fecha", "15 de noviembre de 2026 · ejemplo"],
      ["Hora", "6:00 p. m."],
      ["Lugar", "Auditorio de demostración, Panamá"],
      ["Artista", "Encuentro de Alabanza · ejemplo"],
    ],
  },
  {
    id: "plomeria",
    slug: "plomeria-para-tu-hogar",
    title: "Servicio de plomería para tu hogar",
    kind: "servicio",
    category: "Servicios",
    price: 25,
    rating: 4.8,
    reviews: 16,
    sellerId: "oficios",
    province: "Panamá",
    image: assets.service,
    tag: "Agenda a tu medida",
    description:
      "Mantenimiento y soluciones para instalaciones de agua de tu hogar. Este servicio de ejemplo permite explorar el diseño de cotizaciones y citas; ninguna reserva es real en esta etapa.",
    details: [
      ["Modalidad", "Servicio a domicilio"],
      ["Zona", "Panamá"],
      ["Precio", "Visita desde USD 25.00 · ejemplo"],
      ["Disponibilidad", "Calendario ilustrativo"],
    ],
  },
];
export const kindLabel: Record<ListingKind, string> = {
  producto: "Producto",
  libro: "Libro cristiano",
  evento: "Evento",
  servicio: "Servicio",
};
export const money = (amount: number) =>
  new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(
    amount
  );
export function listingPath(item: Listing) {
  return item.kind === "evento"
    ? `/evento/${item.slug}`
    : item.kind === "servicio"
      ? `/servicio/${item.slug}`
      : `/producto/${item.slug}`;
}
export function getSeller(id: string) {
  return sellers.find(seller => seller.id === id)!;
}

export function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
export function listingSearchText(item: Listing) {
  return normalizeSearch(
    `${item.title} ${item.category} ${item.description} ${item.tag || ""} ${getSeller(item.sellerId).name}`
  );
}
