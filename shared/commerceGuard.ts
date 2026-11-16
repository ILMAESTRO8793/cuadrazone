/*
 * Comercios es para todo, menos restaurantes, bienes raíces, autos y vacantes
 * de empleo (16/11/2026): cada uno tiene su propia sección y su propio plan.
 * Si alguien intenta publicar uno de esos en Comercios, se rechaza solo y se le
 * dice dónde registrarlo. Se mira el título, la descripción y la categoría.
 * Las piezas, repuestos y accesorios de autos sí son de Comercios, igual que
 * los juguetes, maquetas y alimentos empacados o de repostería.
 */
export type MisplacedKind = "inmueble" | "auto" | "vacante" | "restaurante";

export type MisplacedListing = {
  kind: MisplacedKind;
  message: string;
  href: string;
};

const norm = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palabras que dicen que es un objeto pequeño, una pieza o un juguete. */
const PRODUCT_HINTS =
  /\b(juguete|munec[ao]s?|miniatura|maqueta|escala|a control remoto|de control remoto|rc|lego|figura|llavero|repuestos?|piezas?|llantas?|rines?|aros?|filtros?|bateria|accesorios?|forros?|tapetes?|alfombras? para|cubreasientos?|ambientador|lubricante|aceite de motor|retrovisor|faros?|bombillos?|pegatinas?|calcomanias?|stickers?|cuadro|poster|afiche|libro|cuento|disfraz)\b/;

/** «Cargador para auto», «decoración para la casa»: es un producto para algo. */
const MADE_FOR =
  /\b(para|de) (la |el |tu |su |mi )?(casa|hogar|auto|carro|moto|vehiculo|camioneta|apartamento|oficina|cuarto|habitacion)\b/;

const SELL_OR_RENT =
  /\b(venta|vendo|se vende|alquiler|alquilo|se alquila|renta|rento|se renta|arriendo|arrienda|traspaso)\b/;

const PROPERTY =
  /\b(casa|casas|apartamento|apartamentos|apto|aptos|terreno|terrenos|lote|lotes|finca|fincas|local comercial|locales comerciales|oficina|oficinas|bodega|galera|penthouse|townhouse|duplex|habitacion|habitaciones|cuarto|recamaras?|inmueble|inmuebles|propiedad|propiedades|hectareas?)\b/;
const PROPERTY_DETAIL =
  /\b(\d+\s?(m2|mts2|metros cuadrados)|recamaras?|banos? completos?|estacionamientos?|titulo de propiedad)\b/;

const VEHICLE =
  /\b(carro|carros|auto|autos|automovil|automoviles|vehiculo|vehiculos|camioneta|camionetas|pick ?up|sedan|suv|moto|motos|motocicleta|motocicletas|camion|camiones|bus|buses|cuatrimoto|scooter electrico)\b/;
const VEHICLE_BRAND =
  /\b(toyota|honda|nissan|hyundai|kia|mazda|mitsubishi|suzuki|chevrolet|ford|jeep|bmw|mercedes|audi|volkswagen|subaru|isuzu|yamaha|lexus|peugeot|renault|chery|geely|jac|great wall|changan)\b/;
const VEHICLE_DETAIL =
  /\b(kilometraje|\d[\d.,]*\s?km|transmision|automatico|mecanico|4x4|cilindrada|motor \d|placa|traspaso|ano (19|20)\d{2}|modelo (19|20)\d{2}|(19|20)\d{2})\b/;

const JOB =
  /\b(vacante|vacantes|se busca personal|buscamos personal|se solicita|se solicitan|se necesita personal|oferta de empleo|oferta de trabajo|empleo disponible|plaza disponible|contratamos|estamos contratando|trabajo de medio tiempo|trabajo de tiempo completo)\b/;

const RESTAURANT =
  /\b(restaurante|restaurantes|fonda|menu del dia|plato del dia|platos del dia|almuerzos? (del dia|ejecutivos?|a domicilio)|comida a domicilio|comida para llevar|comida rapida|delivery de comida)\b/;

const MESSAGES: Record<MisplacedKind, MisplacedListing> = {
  inmueble: {
    kind: "inmueble",
    message:
      "Esto parece un inmueble (casa, apartamento, terreno o local). Comercios no acepta bienes raíces: regístralo debidamente en Bienes raíces, en «Mis anuncios».",
    href: "/bienes-raices/mis-anuncios",
  },
  auto: {
    kind: "auto",
    message:
      "Esto parece un vehículo (carro, moto o camioneta). Comercios no acepta autos: regístralo debidamente en Autos, en «Mis autos». Los repuestos y accesorios sí van en Comercios.",
    href: "/autos/mis-anuncios",
  },
  vacante: {
    kind: "vacante",
    message:
      "Esto parece una vacante de empleo. Comercios no acepta vacantes: regístrala debidamente en Empleos, en «Mis vacantes».",
    href: "/empleos/mis-vacantes",
  },
  restaurante: {
    kind: "restaurante",
    message:
      "Esto parece comida de restaurante. Comercios no acepta restaurantes: registra tu restaurante debidamente en Restaurantes.",
    href: "/solicitud-vendedor?tipo=restaurante",
  },
};

/**
 * ¿Este producto en realidad es un inmueble, un vehículo, una vacante o comida
 * de restaurante? Devuelve el aviso o null si sí es de Comercios.
 */
export function misplacedListing(input: {
  title: string;
  description?: string | null;
  category?: string | null;
}): MisplacedListing | null {
  const title = norm(input.title);
  const text = norm(`${input.title} ${input.description ?? ""}`);
  const category = norm(input.category ?? "");
  if (JOB.test(text)) return MESSAGES.vacante;
  if (RESTAURANT.test(title)) return MESSAGES.restaurante;
  // Lo pequeño, las piezas y los juguetes son de Comercios, y también lo que
  // es «para» una casa o un auto, si el título no empieza por el inmueble o
  // el vehículo («Cargador para auto» sí; «Casa para estrenar» no).
  if (PRODUCT_HINTS.test(title)) return null;
  const firstWord = title.trim().split(/\s+/)[0] ?? "";
  if (
    MADE_FOR.test(title) &&
    !PROPERTY.test(firstWord) &&
    !VEHICLE.test(firstWord)
  )
    return null;
  if (
    PROPERTY.test(title) &&
    (SELL_OR_RENT.test(text) || PROPERTY_DETAIL.test(text))
  )
    return MESSAGES.inmueble;
  const vehicleWord = VEHICLE.test(title);
  const brand = VEHICLE_BRAND.test(title);
  if (
    (vehicleWord &&
      (SELL_OR_RENT.test(text) || VEHICLE_DETAIL.test(text) || brand)) ||
    (brand && VEHICLE_DETAIL.test(title)) ||
    (category.includes("autos") &&
      vehicleWord &&
      !category.includes("repuesto"))
  )
    return MESSAGES.auto;
  return null;
}
