/*
 * Documentos legales de CuadraZone.
 *
 * Cada documento tiene su fecha de vigencia. Si se cambia un texto, se
 * actualiza su `updated`. Los importes de los planes salen de shared/pricing
 * para que nunca se contradigan con lo que se cobra.
 *
 * Nota interna: estos textos se redactaron con base en la legislación
 * panameña vigente (Ley 81 de 2019 y su reglamento, Ley 45 de 2007 y Ley 51
 * de 2008) y en cómo funciona hoy la plataforma. Deben ser revisados por un
 * abogado idóneo en Panamá antes de considerarse definitivos.
 */
import { sellerPlanLabel } from "@shared/pricing";

export type LegalSection = {
  title: string;
  /** Párrafos del apartado. */
  body?: string[];
  /** Lista de puntos, después de los párrafos. */
  list?: string[];
};

export type LegalDoc = {
  title: string;
  /** Nombre corto para el pie de página. */
  short: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
};

const NORMAL = sellerPlanLabel("normal");
const MAYOR = sellerPlanLabel("mayor_visibilidad");
const CONTACT =
  "Puedes escribirnos por los canales de contacto publicados en el Centro de ayuda (cuadrazone.com/ayuda), indicando el correo o el celular con el que usas tu cuenta.";

export const legalDocs: Record<string, LegalDoc> = {
  terminos: {
    title: "Condiciones de uso",
    short: "Condiciones de uso",
    updated: "6 de noviembre de 2026",
    intro:
      "Estas condiciones regulan el uso de CuadraZone (cuadrazone.com) por parte de visitantes, compradores y vendedores. Al navegar, crear una cuenta, publicar o comprar en CuadraZone aceptas estas condiciones y los demás documentos legales enlazados en esta página. Si no estás de acuerdo, no uses la plataforma.",
    sections: [
      {
        title: "Quiénes somos y qué hacemos",
        body: [
          "CuadraZone es una plataforma digital operada en la República de Panamá que conecta a vendedores independientes —tiendas, emprendedores, profesionales y anunciantes de inmuebles, autos y empleos— con compradores. En estos documentos, «CuadraZone», «nosotros» o «la plataforma» se refiere a CuadraZone y a quienes la operan; «usuario» es toda persona que la usa.",
          "CuadraZone actúa como intermediario tecnológico. No fabricamos, vendemos, almacenamos, transportamos ni prestamos los productos o servicios que publican los vendedores, y no somos parte de los contratos de compraventa, servicio, arrendamiento o empleo que celebran los usuarios entre sí. Los únicos servicios que CuadraZone presta y cobra son los planes y comisiones de los vendedores descritos más abajo.",
        ],
      },
      {
        title: "Quién puede usar CuadraZone",
        list: [
          "Debes tener al menos 18 años y capacidad legal para contratar. Un menor solo puede usar la plataforma bajo la supervisión de su padre, madre o tutor, quien responde por sus actos.",
          "La información que registres debe ser verdadera, completa y estar al día.",
          "Tu cuenta es personal. Eres responsable de lo que se haga con ella y de proteger el acceso a tu correo, tu celular y tu cuenta de Google. Avísanos de inmediato si sospechas un uso no autorizado.",
          "Podemos rechazar o cerrar cuentas creadas con datos falsos, duplicadas o usadas para fines contrarios a estas condiciones.",
        ],
      },
      {
        title: "Cuenta de comprador",
        body: [
          "La cuenta de comprador es gratuita y no tiene mensualidad. Como comprador pagas al vendedor el precio de lo que adquieres y, cuando correspondan, los cargos de entrega u otros cargos que el vendedor indique en su publicación o en su tienda.",
        ],
      },
      {
        title: "Cuenta de vendedor, planes y comisiones",
        body: [
          "Para vender es necesario enviar una solicitud y superar la verificación de identidad y de contacto. CuadraZone puede aprobar o rechazar una solicitud según sus criterios de confianza y sus valores, indicando el motivo cuando la rechace.",
          `Los vendedores aprobados disfrutan de 3 meses sin mensualidad. Después pagan el plan elegido: Normal (${NORMAL} al mes) o Mayor Visibilidad (${MAYOR} al mes). Además, por los productos físicos se paga una comisión por venta entregada del 8% durante los 3 meses de prueba y del 5% después, calculada solo sobre el precio de los productos, sin el envío. Los servicios no pagan comisión.`,
          "Podemos cambiar los precios de los planes o las comisiones avisándote con al menos 30 días de anticipación; los cambios no afectan los periodos ya pagados. Si no pagas la mensualidad o las comisiones a tiempo, podemos ocultar tu tienda y tus publicaciones hasta que regularices el pago. Los pagos hechos a CuadraZone no son reembolsables, salvo error nuestro o cuando la ley disponga otra cosa. Desactivar una tienda no cancela las comisiones pendientes.",
          "Cada vendedor es el único responsable de sus obligaciones legales y fiscales: aviso de operación y permisos de su actividad, emisión de facturas o comprobantes, declaración y pago de impuestos —incluido el ITBMS cuando corresponda— y el cumplimiento de las normas de protección al consumidor.",
        ],
      },
      {
        title: "Publicaciones y contenido de los usuarios",
        body: [
          "El vendedor o anunciante es el único responsable de lo que publica: descripciones, fotos, precios, existencias, condiciones de entrega, garantías y la legalidad de lo que ofrece. Debe describir cada producto o servicio tal como es, con fotos reales y precios claros, y cumplir la Ley 45 de 2007 de protección al consumidor y las demás normas aplicables.",
          "Al publicar contenido (textos, fotos, reseñas, mensajes) declaras que tienes los derechos necesarios sobre él y concedes a CuadraZone una licencia gratuita, no exclusiva y mundial para alojarlo, reproducirlo, adaptarlo en formato y mostrarlo con el fin de operar, mejorar y dar a conocer la plataforma, mientras el contenido permanezca publicado y durante el tiempo razonable necesario para retirarlo de las copias de seguridad.",
          "CuadraZone no revisa previamente todo lo que se publica, pero puede retirar, ocultar o editar en su formato cualquier contenido que incumpla estas condiciones, el Código de conducta o la ley, sin necesidad de aviso previo.",
        ],
      },
      {
        title: "Compras, pagos y entregas",
        body: [
          "La compra o contratación es un acuerdo directo entre el comprador y el vendedor. El comprador paga directamente al vendedor por los métodos que este registra en su tienda (Yappy, transferencia, link de pago de una plataforma permitida, tarjeta con datáfono al entregar o efectivo).",
          "CuadraZone no procesa pagos con tarjeta, no guarda datos de tarjetas y no recibe ni custodia el dinero de los compradores. Por eso, la entrega, la calidad, las garantías, los cambios y las devoluciones son responsabilidad del vendedor, conforme a la ley y a lo que haya ofrecido.",
          "Por tu seguridad: paga solo por los métodos que figuran en la tienda, verifica el pedido antes de pagar y nunca compartas contraseñas, códigos de verificación ni datos completos de tarjetas por mensaje.",
        ],
      },
      {
        title: "Bienes raíces, autos y empleos",
        body: [
          "Las secciones de bienes raíces, autos y empleos son anuncios clasificados. CuadraZone no es corredor de bienes raíces, concesionario, agencia de empleo ni intermediario en esas operaciones, y no verifica títulos de propiedad, gravámenes, el estado mecánico o legal de los vehículos, ni la veracidad de las ofertas de trabajo.",
          "Cada usuario debe comprobar por su cuenta la información, la identidad de la otra parte y la documentación antes de pagar, firmar o entregar datos. Quien ejerza una actividad que requiera licencia o idoneidad (por ejemplo, el corretaje de bienes raíces) debe contar con ella. Nunca pagues anticipos por un empleo.",
        ],
      },
      {
        title: "Lo que no está permitido",
        list: [
          "Publicar o vender productos o servicios ilegales, robados, falsificados o que infrinjan derechos de terceros, así como los demás contenidos prohibidos en el Código de conducta.",
          "Engañar, suplantar a otra persona o empresa, o dar información falsa sobre ti, tu negocio o lo que ofreces.",
          "Usar la plataforma para enviar publicidad no solicitada, estafas o enlaces maliciosos, o para acosar, amenazar o discriminar a otros usuarios.",
          "Desviar fuera de CuadraZone las ventas iniciadas en la plataforma con el fin de evitar las comisiones.",
          "Extraer datos de forma masiva (scraping), usar robots, alterar, sobrecargar o intentar acceder sin autorización a la plataforma, a sus sistemas o a cuentas ajenas.",
          "Copiar, revender o explotar comercialmente la plataforma o su contenido sin nuestra autorización escrita.",
        ],
      },
      {
        title: "Propiedad intelectual",
        body: [
          "La marca CuadraZone, su logotipo, el diseño del sitio, sus textos propios y su software pertenecen a sus titulares y están protegidos por la ley. No se pueden usar sin autorización previa y por escrito. Los contenidos publicados por los usuarios pertenecen a sus respectivos titulares.",
          "Si consideras que una publicación infringe tus derechos de autor o de marca, envíanos un aviso con tus datos de contacto, la descripción del derecho afectado, el enlace a la publicación y una declaración de que la información es exacta. Revisaremos el aviso y, si procede, retiraremos el contenido.",
        ],
      },
      {
        title: "Suspensión y cierre de cuentas",
        body: [
          "Podemos advertir, limitar, suspender o cerrar una cuenta, tienda o publicación —de forma temporal o definitiva— si se incumplen estas condiciones, el Código de conducta o la ley; si hay indicios de fraude o riesgo para otros usuarios; o si lo ordena una autoridad competente. Cuando sea posible, te informaremos el motivo.",
          "Puedes dejar de usar CuadraZone y pedir el cierre de tu cuenta en cualquier momento. Las obligaciones pendientes, como pedidos en curso, mensualidades o comisiones, se mantienen después del cierre.",
        ],
      },
      {
        title: "La plataforma se ofrece «tal como está»",
        body: [
          "En la medida en que la ley lo permita, CuadraZone se ofrece «tal como está» y «según disponibilidad». Trabajamos para que funcione bien, pero no garantizamos que esté libre de errores o interrupciones, ni que los resultados de búsqueda o la información de terceros sean exactos.",
          "La verificación de vendedores busca dar más confianza, pero no es una garantía sobre la calidad, la seguridad o la legalidad de lo que se ofrece, ni sobre la conducta o la solvencia de ningún usuario.",
        ],
      },
      {
        title: "Limitación de responsabilidad",
        body: [
          "En la máxima medida permitida por la ley panameña, CuadraZone no será responsable por: (a) los productos, servicios, anuncios, pagos, entregas, garantías ni por los actos u omisiones de compradores, vendedores, anunciantes o terceros; (b) daños indirectos, lucro cesante, pérdida de oportunidades, de datos o de reputación; ni (c) fallas causadas por proveedores externos, cortes de internet o casos de fuerza mayor.",
          "Cuando la ley permita limitarla, la responsabilidad total de CuadraZone frente a un usuario por cualquier reclamo relacionado con la plataforma no superará la mayor de estas cantidades: lo que ese usuario haya pagado a CuadraZone en los 3 meses anteriores al hecho que origina el reclamo, o cien dólares (US$100.00).",
          "Nada de lo anterior limita la responsabilidad que por ley no pueda limitarse, como la derivada del dolo o la culpa grave, ni los derechos irrenunciables que la ley reconoce a los consumidores.",
        ],
      },
      {
        title: "Indemnidad",
        body: [
          "Te comprometes a mantener indemne a CuadraZone, y a quienes la operan y colaboran con ella, frente a cualquier reclamo, demanda, sanción, daño o gasto —incluidos honorarios razonables de abogados— que presente un tercero o una autoridad y que se derive de tu contenido, de tus ventas o compras, de tu incumplimiento de estas condiciones o de la ley, o de la infracción de derechos de terceros.",
        ],
      },
      {
        title: "Reclamos entre usuarios",
        body: [
          "Los problemas con un pedido se atienden según el procedimiento de Reclamos y devoluciones. CuadraZone puede ayudar a mediar de forma voluntaria y tomar medidas sobre las cuentas, pero su intervención no sustituye a las autoridades. Los consumidores conservan siempre su derecho de acudir a la Autoridad de Protección al Consumidor y Defensa de la Competencia (ACODECO).",
        ],
      },
      {
        title: "Comunicaciones electrónicas",
        body: [
          "Aceptas recibir comunicaciones de CuadraZone por correo electrónico, SMS o dentro de la plataforma, y que las aceptaciones, avisos y registros que hagas por medios electrónicos tengan plena validez, conforme a la Ley 51 de 2008 sobre documentos y firmas electrónicas. Los avisos comerciales opcionales podrás desactivarlos cuando quieras.",
        ],
      },
      {
        title: "Cambios en estas condiciones",
        body: [
          "Podemos actualizar estas condiciones para reflejar cambios en la plataforma o en la ley. Publicaremos la nueva versión en esta página con su fecha. Si el cambio es importante, lo avisaremos con antelación razonable por la plataforma o por correo. Si sigues usando CuadraZone después de la fecha de vigencia, se entiende que aceptas la nueva versión.",
        ],
      },
      {
        title: "Ley aplicable y jurisdicción",
        body: [
          "Estas condiciones se rigen por las leyes de la República de Panamá. Antes de iniciar cualquier acción, las partes intentarán resolver la controversia de buena fe durante al menos 30 días a partir del aviso escrito de una de ellas. Si no se logra un acuerdo, la controversia se someterá a los tribunales competentes de la ciudad de Panamá, sin perjuicio de los derechos del consumidor de acudir a ACODECO o a los tribunales que la ley le permita.",
        ],
      },
      {
        title: "Disposiciones generales",
        list: [
          "Estas condiciones, junto con la Política de privacidad, el Aviso de datos sensibles, la Política de cookies, el Código de conducta, Fe y valores y Reclamos y devoluciones, forman el acuerdo completo entre tú y CuadraZone sobre el uso de la plataforma.",
          "Si alguna cláusula se declara inválida, las demás siguen vigentes.",
          "Que CuadraZone no exija en algún momento el cumplimiento de una cláusula no significa que renuncie a ella.",
          "No puedes ceder tu cuenta ni estas condiciones sin nuestra autorización. CuadraZone puede cederlas en caso de reorganización, fusión o venta de la plataforma, manteniendo tus derechos.",
          "La versión en español de estos documentos es la que prevalece.",
        ],
      },
      { title: "Contacto", body: [CONTACT] },
    ],
  },

  privacidad: {
    title: "Política de privacidad",
    short: "Aviso de privacidad",
    updated: "6 de noviembre de 2026",
    intro:
      "Qué datos personales recopila CuadraZone, para qué los usa, con quién los comparte y cómo puedes ejercer tus derechos según la Ley 81 de 26 de marzo de 2019 de Protección de Datos Personales y su reglamento, el Decreto Ejecutivo 285 de 28 de mayo de 2021.",
    sections: [
      {
        title: "Responsable",
        body: [
          "CuadraZone, plataforma operada en Panamá, es responsable del tratamiento de los datos que se describen aquí. " + CONTACT,
        ],
      },
      {
        title: "Datos de tu cuenta",
        body: [
          "Puedes entrar con Google, con tu correo o con tu celular. Con Google recibimos tu nombre, tu correo verificado y un identificador de tu cuenta, nunca tu contraseña. Con correo o celular guardamos ese dato, verificado con un código de un solo uso; del código solo guardamos una huella cifrada. En tu perfil guardas además tu nombre visible y tu teléfono.",
        ],
      },
      {
        title: "Datos de los vendedores",
        body: [
          "Para revisar una solicitud de vendedor guardamos el tipo y nombre del negocio, sus categorías, el tipo y número de identificación, tus nombres y apellidos como aparecen en ella y su vencimiento, el país, provincia y ciudad, la iglesia, el pastor y la denominación si los indicas, la aceptación de los valores cristianos de CuadraZone, del Código de conducta y de esta política, y los documentos que subes: foto de tu cédula o carné, captura de tu Yappy o banco con tu nombre y, si la agregas, carta pastoral.",
          "Para la verificación inmediata, un programa de lectura de texto que corre en nuestros propios servidores compara los nombres que aparecen en esas imágenes; no se envían a terceros ni se usan para reconocimiento facial. De tu tienda guardamos su descripción, fotos, tarifas de entrega, tu Yappy y tu link de pago con tarjeta.",
          "Algunos de estos datos revelan creencias religiosas y la ley los considera datos sensibles. Cómo los tratamos se explica en el Aviso de datos sensibles.",
        ],
      },
      {
        title: "Datos de compras y anuncios",
        body: [
          "Al comprar guardamos el nombre de quien recibe, teléfono, dirección y provincia de entrega, los productos, el método de pago elegido, el estado del pedido, los mensajes con el vendedor y las reseñas que publiques. De los pagos a CuadraZone guardamos monto, método, fecha y número de comprobante. Nunca guardamos datos de tarjetas: los pagos con tarjeta se hacen en la plataforma del vendedor o en su datáfono.",
          "Si creas un CV, aplicas a una vacante o publicas un anuncio de empleo, inmueble o auto, guardamos los datos que incluyas en ellos.",
        ],
      },
      {
        title: "Datos técnicos",
        body: [
          "Como cualquier sitio web, nuestros servidores registran datos técnicos de cada visita —dirección IP, fecha y hora, páginas solicitadas, tipo de navegador y dispositivo, y errores— para mantener el sitio funcionando, detectar abusos y protegerlo. Estos registros se conservan por un tiempo limitado.",
        ],
      },
      {
        title: "Por qué podemos tratar tus datos",
        list: [
          "Porque los necesitamos para darte el servicio que pides: tu cuenta, tu tienda, tus pedidos y tus anuncios.",
          "Porque nos das tu consentimiento, por ejemplo al enviar una solicitud de vendedor o al aceptar esta política. Puedes retirarlo cuando quieras, sin efecto sobre lo ya hecho.",
          "Para cumplir obligaciones legales, contables o requerimientos de autoridades.",
          "Por nuestro interés legítimo en prevenir fraudes y mantener la seguridad de la plataforma y de sus usuarios.",
        ],
      },
      {
        title: "Para qué los usamos",
        body: [
          "Para crear tu cuenta e iniciar sesión; revisar y aprobar vendedores, incluida la verificación del correo y del teléfono; mostrar tiendas y publicaciones; gestionar pedidos, entregas y mensajes; cobrar mensualidades y comisiones; enviarte avisos sobre tu cuenta; atender reclamos; prevenir fraudes y mantener la seguridad del sitio. No vendemos tus datos, no los alquilamos y no los usamos para publicidad de terceros.",
        ],
      },
      {
        title: "Qué es público",
        body: [
          "El nombre de la tienda, su descripción, provincia y ciudad, el nombre de la iglesia si el vendedor lo indicó, sus publicaciones con fotos y precios, y las reseñas. El Yappy o el link de pago del vendedor solo lo ven los compradores con un pedido pagado por ese método.",
          "Tu CV de empleo no es público: solo lo ve la empresa a la que aplicas, que recibe una copia con tu nombre, celular, correo y experiencia. Si publicas una vacante, ves los CV de quienes aplicaron a ella. En los anuncios de bienes raíces y autos son públicos el precio, la ubicación aproximada (provincia y distrito, nunca la dirección exacta), las fotos y el celular que el anunciante pone para que lo contacten.",
          "Los documentos de identidad, la captura de Yappy o banco y la carta pastoral nunca son públicos: solo los ve el equipo de CuadraZone cuando una solicitud necesita revisión.",
        ],
      },
      {
        title: "Con quién compartimos datos",
        list: [
          "Con el vendedor o el comprador de tu pedido, solo lo necesario para pagar y entregar (nombre, teléfono y dirección de entrega).",
          "Con Google, para el inicio de sesión con tu cuenta de Google. El sitio también carga sus tipografías desde Google Fonts, por lo que tu navegador se conecta a los servidores de Google, que reciben tu dirección IP.",
          "Con Railway, que aloja el sitio, la base de datos y las fotos.",
          "Con Brevo, que envía en nuestro nombre los correos automáticos (tu correo, tu nombre y el contenido del aviso).",
          "Con el servicio de SMS que envía los códigos a tu celular (tu número y el código).",
          "Con las autoridades, únicamente cuando la ley lo exija o una orden competente lo requiera.",
          "Con un posible comprador o sucesor de la plataforma, si CuadraZone se reorganiza o se vende, que deberá respetar esta política.",
        ],
        body: [
          "Estos proveedores solo pueden usar los datos para prestarnos su servicio.",
        ],
      },
      {
        title: "Transferencias fuera de Panamá",
        body: [
          "Algunos de nuestros proveedores (Railway, Google y Brevo) guardan o procesan datos en servidores ubicados fuera de Panamá, principalmente en los Estados Unidos y la Unión Europea. Los elegimos porque aplican medidas de seguridad reconocidas. Al usar CuadraZone consientes estas transferencias, necesarias para prestarte el servicio.",
        ],
      },
      {
        title: "Menores de edad",
        body: [
          "CuadraZone está dirigida a personas mayores de 18 años. No recopilamos a sabiendas datos de menores sin la autorización de su padre, madre o tutor. Si sabemos que un menor nos dio datos sin esa autorización, los eliminaremos.",
        ],
      },
      {
        title: "Cookies",
        body: [
          "Usamos solo las cookies necesarias para mantener tu sesión y proteger el inicio de sesión. No usamos cookies de publicidad ni de seguimiento. Los detalles están en la Política de cookies y preferencias.",
        ],
      },
      {
        title: "Conservación",
        body: [
          "Guardamos tus datos mientras tu cuenta esté activa. Los datos de pedidos, pagos y verificación de vendedores pueden conservarse después durante el tiempo que exijan las obligaciones legales, contables o la atención de reclamos y posibles acciones legales. Al terminar ese plazo los eliminamos o los anonimizamos.",
        ],
      },
      {
        title: "Tus derechos",
        body: [
          "Según la Ley 81 de 2019 puedes solicitar el acceso a tus datos, su rectificación, su cancelación, oponerte a su tratamiento y pedir su portabilidad. También puedes retirar el consentimiento que nos diste. Para hacerlo, escríbenos indicando el correo o el celular de tu cuenta y qué derecho quieres ejercer; podremos pedirte que confirmes tu identidad. Responderemos dentro de los plazos que fija la ley.",
          "Tu nombre y teléfono puedes corregirlos en Mi cuenta, salvo mientras una solicitud de vendedor esté en revisión o aprobada. Si no quedas conforme con nuestra respuesta, puedes acudir a la Autoridad Nacional de Transparencia y Acceso a la Información (ANTAI).",
        ],
      },
      {
        title: "Seguridad",
        body: [
          "El sitio funciona con conexión cifrada (HTTPS), las sesiones están firmadas y los documentos de verificación se guardan de forma privada con acceso restringido al equipo de CuadraZone. Ningún sistema es infalible: si ocurriera un incidente que afecte tus datos, tomaremos medidas para contenerlo y lo notificaremos a ti y a la autoridad cuando la ley lo exija.",
        ],
      },
      {
        title: "Cambios",
        body: [
          "Si modificamos esta política publicaremos la nueva versión en esta página con su fecha de vigencia. Si el cambio afecta lo que aceptaste como vendedor, te pediremos aceptarlo de nuevo.",
        ],
      },
    ],
  },

  "datos-sensibles": {
    title: "Aviso de datos sensibles",
    short: "Datos sensibles",
    updated: "6 de noviembre de 2026",
    intro:
      "La Ley 81 de 2019 protege de forma especial los datos sensibles, entre ellos los que revelan creencias religiosas. Este aviso explica cuáles tratamos en CuadraZone, por qué y cómo los cuidamos. Complementa la Política de privacidad.",
    sections: [
      {
        title: "Qué datos sensibles tratamos",
        list: [
          "Iglesia, pastor y denominación, cuando el vendedor decide indicarlos en su solicitud.",
          "Carta pastoral, si el vendedor decide adjuntarla.",
          "La aceptación de la declaración de Fe y valores de CuadraZone.",
        ],
        body: [
          "Aunque la ley no los clasifique como sensibles, damos la misma protección a los documentos de identidad y a las capturas de Yappy o banco que se suben para la verificación.",
        ],
      },
      {
        title: "Qué datos sensibles no tratamos",
        body: [
          "CuadraZone no pide ni recopila datos de salud, datos genéticos o biométricos, origen racial o étnico, opiniones políticas, afiliación sindical ni datos sobre la vida u orientación sexual. La lectura de texto de los documentos solo compara nombres; no realizamos reconocimiento facial. Te pedimos no incluir este tipo de datos en tus publicaciones, mensajes o CV.",
        ],
      },
      {
        title: "Tu consentimiento",
        body: [
          "Indicar tu iglesia, tu pastor o tu denominación y adjuntar una carta pastoral es voluntario. Si los proporcionas, nos das tu consentimiento expreso para tratarlos con los fines de este aviso. Puedes vender en CuadraZone sin ser cristiano y sin pertenecer a una iglesia; lo que se pide a todos es respetar los valores de la plataforma.",
          "Puedes retirar tu consentimiento en cualquier momento escribiéndonos. Retirarlo puede hacer que tu tienda deje de mostrar la iglesia o que no puedas optar a distintivos que dependen de una acreditación institucional, pero no afecta tu derecho a comprar en la plataforma.",
        ],
      },
      {
        title: "Para qué los usamos",
        list: [
          "Revisar la solicitud del vendedor y dar confianza a la comunidad.",
          "Mostrar en la página pública de la tienda el nombre de la iglesia, solo si el vendedor lo indicó.",
          "Otorgar distintivos que requieren acreditación y autorización institucional.",
        ],
        body: [
          "Nunca usamos estos datos para publicidad, para elaborar perfiles con fines comerciales ni para decidir de forma automatizada sobre ti, y nunca los vendemos ni los compartimos con terceros, salvo obligación legal.",
        ],
      },
      {
        title: "Quién puede verlos",
        body: [
          "Además del nombre de la iglesia que el vendedor decida mostrar, estos datos y documentos solo los ve el equipo autorizado de CuadraZone, y solo cuando una solicitud necesita revisión. Se guardan de forma privada, con acceso restringido y conexión cifrada.",
        ],
      },
      {
        title: "Conservación y eliminación",
        body: [
          "Los conservamos mientras la tienda esté activa o la solicitud en trámite, y después solo el tiempo necesario para cumplir obligaciones legales o atender reclamos. Puedes pedir que los eliminemos antes, salvo los que la ley nos obligue a conservar.",
        ],
      },
      { title: "Contacto y derechos", body: [CONTACT + " También puedes acudir a la ANTAI si consideras que no se respetaron tus derechos."] },
    ],
  },

  cookies: {
    title: "Política de cookies y preferencias de privacidad",
    short: "Tus opciones de privacidad",
    updated: "6 de noviembre de 2026",
    intro:
      "Qué guarda CuadraZone en tu navegador, por qué, y qué puedes decidir tú. En resumen: solo usamos lo necesario para que el sitio funcione. No hay cookies de publicidad ni de seguimiento, y no mostramos anuncios personalizados.",
    sections: [
      {
        title: "Cookies que usamos",
        list: [
          "Cookie de sesión: mantiene tu cuenta iniciada de forma segura. Dura hasta que cierras sesión o, como máximo, un año.",
          "Cookie de protección del inicio de sesión con Google: es temporal y solo existe durante ese proceso, para evitar que otro sitio inicie sesión en tu nombre.",
        ],
        body: [
          "Ambas son estrictamente necesarias: sin ellas no podrías iniciar sesión. Por eso no requieren tu consentimiento.",
        ],
      },
      {
        title: "Almacenamiento local del navegador",
        body: [
          "El sitio puede guardar en tu propio navegador preferencias como el tema visual o los favoritos y el carrito de los ejemplos de demostración. Esa información no se envía a nuestros servidores y puedes borrarla desde la configuración de tu navegador.",
        ],
      },
      {
        title: "Servicios de terceros",
        body: [
          "Las tipografías del sitio se cargan desde Google Fonts y el inicio de sesión con Google se hace en las páginas de Google. Al usarlos, Google recibe datos técnicos como tu dirección IP según su propia política de privacidad. No instalamos herramientas de analítica, píxeles de redes sociales ni publicidad de terceros.",
        ],
      },
      {
        title: "Publicidad",
        body: [
          "CuadraZone no muestra anuncios de terceros ni personaliza publicidad con tus datos. Los espacios «Destacado» del plan Mayor Visibilidad son ubicaciones pagadas por vendedores de la propia plataforma; se identifican como tales y no usan tu historial de navegación.",
        ],
      },
      {
        title: "Tus opciones",
        list: [
          "Puedes bloquear o borrar las cookies desde tu navegador; si bloqueas la de sesión, no podrás iniciar sesión.",
          "Puedes cerrar sesión en cualquier momento desde Mi cuenta, lo que elimina la cookie de sesión.",
          "Puedes ejercer tus derechos sobre tus datos personales como se indica en la Política de privacidad.",
        ],
        body: [
          "Si algún día incorporamos cookies que no sean necesarias, te pediremos tu consentimiento antes de usarlas y podrás cambiar tu decisión en esta página.",
        ],
      },
    ],
  },

  reclamos: {
    title: "Reclamos y devoluciones",
    short: "Reclamos y devoluciones",
    updated: "6 de noviembre de 2026",
    intro:
      "Cómo resolver un problema con un pedido, un servicio o una publicación, qué hace el vendedor, qué hace CuadraZone y qué derechos conservas siempre como consumidor.",
    sections: [
      {
        title: "Primero, habla con el vendedor",
        body: [
          "La mayoría de los problemas se resuelven directamente. Escribe al vendedor desde los mensajes del pedido, explica lo ocurrido y adjunta fotos si aplica. Como el pago se hace directamente al vendedor, es él quien gestiona los cambios, reparaciones, devoluciones y reembolsos.",
        ],
      },
      {
        title: "Abre un reclamo en CuadraZone",
        body: [
          "Si no llegan a un acuerdo, puedes presentar un reclamo a CuadraZone dentro de los 30 días siguientes a la entrega (o a la fecha prevista de entrega, si no llegó). Incluye:",
        ],
        list: [
          "El número de pedido y el nombre de la tienda.",
          "Qué pasó y qué solución pides (cambio, reparación, devolución, reembolso).",
          "Las pruebas que tengas: fotos, comprobante de pago y mensajes.",
        ],
      },
      {
        title: "El vendedor tiene 48 horas para responder",
        body: [
          "Avisaremos al vendedor, que debe responder y proponer una solución en un plazo de 48 horas. Si no responde o la propuesta no es razonable, el equipo de CuadraZone revisará el caso con la información de ambas partes.",
        ],
      },
      {
        title: "Qué puede hacer CuadraZone",
        list: [
          "Mediar entre las partes y recomendar una solución.",
          "Ocultar publicaciones, pedir correcciones o suspender la tienda de un vendedor que incumpla.",
          "Dejar constancia del caso en el historial del vendedor.",
        ],
        body: [
          "CuadraZone no recibe el dinero de los pedidos, por lo que no puede reembolsar directamente lo pagado al vendedor ni obligarle a hacerlo. Nuestra intervención es una ayuda voluntaria y no sustituye a las autoridades ni a los tribunales.",
        ],
      },
      {
        title: "Devoluciones y garantías",
        body: [
          "Cada vendedor debe informar en su tienda su política de cambios y devoluciones y cumplir, como mínimo, con las garantías y derechos que establece la Ley 45 de 2007 de protección al consumidor. Si un producto llega dañado, es distinto a lo publicado o no llega, el vendedor debe ofrecer una solución adecuada.",
          "Los servicios se rigen por lo acordado con el profesional. Las entradas a eventos se rigen por las condiciones del organizador, salvo cancelación del evento.",
        ],
      },
      {
        title: "Reclamos sobre CuadraZone",
        body: [
          "Si tu reclamo es sobre la plataforma —por ejemplo, un cobro de mensualidad o comisión, o una decisión sobre tu cuenta—, escríbenos con los detalles. Lo revisaremos y te responderemos en un plazo razonable.",
        ],
      },
      {
        title: "Tus derechos como consumidor",
        body: [
          "Este procedimiento no limita los derechos que te da la ley. En cualquier momento puedes presentar tu queja ante la Autoridad de Protección al Consumidor y Defensa de la Competencia (ACODECO) o acudir a las autoridades competentes.",
        ],
      },
      { title: "Contacto", body: [CONTACT] },
    ],
  },

  conducta: {
    title: "Código de conducta",
    short: "Código de conducta",
    updated: "23 de octubre de 2026",
    intro:
      "Las reglas de convivencia y de comercio honesto que aceptan todas las personas que compran y venden en CuadraZone.",
    sections: [
      { title: "A quién aplica", body: ["A todos los vendedores y compradores de CuadraZone. Los vendedores lo aceptan al enviar su solicitud y es una condición para mantener su tienda activa."] },
      { title: "Respeto", body: ["Trata a todos con respeto y cortesía, como hermanos. No se permiten insultos, amenazas, acoso, lenguaje ofensivo ni discriminación. La mensajería de CuadraZone es solo para asuntos del pedido o de la publicación."] },
      { title: "Comercio honesto", body: ["Describe tus productos y servicios tal como son, con fotos reales de lo que vendes y precios claros. Mantén tu inventario al día, cumple lo que ofreces en entrega y tiempos, y no cobres recargos que no estén indicados en la publicación o en la tienda."] },
      { title: "Pagos seguros", body: ["Cobra solo por los métodos registrados en tu tienda: Yappy, link de pago de una plataforma permitida, tarjeta con datáfono al entregar, transferencia o efectivo. Nunca pidas ni envíes datos de tarjeta, contraseñas ni códigos de verificación por mensaje. CuadraZone no procesa ni guarda datos de tarjetas."] },
      { title: "Lo que no se puede publicar", body: ["Productos o servicios ilegales, robados o falsificados; armas, drogas o medicamentos que requieran receta; contenido sexual o violento; ocultismo; publicidad engañosa; y cualquier contenido contrario a los valores cristianos de CuadraZone, que aplican a todos los vendedores, sean o no cristianos."] },
      { title: "Obligaciones del vendedor", body: ["Mantener su información y sus datos de cobro correctos, pagar la mensualidad de su plan al terminar los 3 meses gratis y, si vende productos físicos, pagar la comisión por venta entregada (8% durante la prueba y 5% después, calculada solo sobre los productos, sin el envío)."] },
      { title: "Incumplimientos", body: ["Si alguien no cumple este código, CuadraZone puede pedir correcciones, ocultar publicaciones, suspender o desactivar la tienda o la cuenta. Desactivar una tienda no cancela las comisiones pendientes."] },
      { title: "Reportes", body: ["Si ves una publicación o un trato que no cumple este código, comunícalo al equipo de CuadraZone con el nombre de la tienda y, si aplica, el número de pedido."] },
    ],
  },

  fe: {
    title: "Nuestra fe y valores",
    short: "Fe y valores",
    updated: "23 de octubre de 2026",
    intro:
      "CuadraZone nace de la comunidad cristiana de Panamá y está abierto a todos los que respeten sus valores.",
    sections: [
      { title: "Nuestra fe", body: ["Confesamos que Cristo es Rey y que Jesús es Dios, nuestro Señor y Salvador, y reconocemos la Biblia como la Palabra de Dios y fundamento de nuestra fe."] },
      { title: "Abierto a todos", body: ["Pueden comprar y vender en CuadraZone personas cristianas y no cristianas. No pedimos pertenecer a una iglesia: pedimos respetar los valores de la plataforma."] },
      { title: "Valores que no se negocian", body: ["Honestidad en lo que se ofrece y se cobra; respeto y trato justo con todos; cumplir lo prometido; y no publicar productos, servicios ni contenido contrarios a la fe cristiana, como ocultismo, contenido sexual, vicios o mensajes que ataquen la fe."] },
      { title: "Aceptación", body: ["Todo vendedor acepta estos valores al enviar su solicitud, y su aceptación queda registrada con la versión vigente. Incumplirlos puede llevar a ocultar publicaciones o cerrar la tienda."] },
    ],
  },
};

/** Orden en que se listan los documentos. */
export const legalOrder = [
  "terminos",
  "privacidad",
  "datos-sensibles",
  "cookies",
  "reclamos",
  "conducta",
  "fe",
] as const;

export function isLegalTopic(topic: string): boolean {
  return Object.prototype.hasOwnProperty.call(legalDocs, topic);
}

/** Enlaces del pie de página, como en las tiendas grandes. */
export const footerLegalLinks = [
  { href: "/legal/terminos", label: "Condiciones de uso" },
  { href: "/legal/privacidad", label: "Aviso de privacidad" },
  { href: "/legal/datos-sensibles", label: "Datos sensibles" },
  { href: "/legal/cookies", label: "Tus opciones de privacidad" },
];
