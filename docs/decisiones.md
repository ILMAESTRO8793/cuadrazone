# Decisiones vigentes de CuadraZone

Estas decisiones sustituyen las partes correspondientes de `requisitos-originales.md`, que se conserva como registro histórico.

## Identidad visual — 7 de octubre de 2026

El usuario pidió: **«quiero que el logo sea Dorado y que la plataforma sea blanca»**.

El texto y el contorno del logo se recolorean a dorado, conservando la misma tipografía y el carrito pequeño orientado a la izquierda, arriba y a la derecha de la última e. Los cuatro emblemas conservan sus colores. La cabecera, el contenido y el pie de la plataforma son blancos, con acentos dorados.

## Compradores — 7 de octubre de 2026

El usuario pidió: **«quitame el pago de 2.99 dolares de los compradores»**.

La cuenta de comprador es **gratuita, sin cuota mensual ni suscripción de pago para comprar**. Se elimina el derecho de compra condicionado al pago de USD 2.99/mes. El registro/autenticación de la cuenta se implementa en la etapa 2. Los compradores siguen pagando el precio de sus productos, servicios y boletos, y los cargos de entrega o de la pasarela que correspondan a una transacción; no se presenta como gratuidad de los artículos.

La suscripción de vendedores permanece en **USD 10.00/mes**. CuadraZone mantiene **cero comisión propia por venta**. Los flujos de verificación, aprobación, primera mensualidad y ocultación por impago se aplican a los vendedores.

Se conserva la construcción por siete etapas con revisión entre ellas. Esta entrega es la vista previa de diseño de la etapa 1; no hay cobros activos.

- 7 de octubre: el usuario aprobó la etapa 1 y avanzar a etapa 2.
- Correo y SMS quedan pendientes por decisión explícita; no hay códigos ni verificaciones simuladas y se bloquea envío/aprobación incompletos.
- Logo nuevo: carretilla reemplazada por cruz blanca con cuatro emblemas; paloma dorada arriba, cruz roja izquierda, copa azul derecha y corona púrpura abajo; palabra dorada y plataforma blanca se conservan.

- Decisión vigente 22:32: quitar la cruz principal y restaurar el carrito pequeño de compras mirando a la izquierda, ahora blanco, con los cuatro emblemas a color dentro. Mantener la palabra dorada y la plataforma blanca. Esta decisión sustituye la propuesta de cruz con emblemas en las puntas.

- 22:59: el usuario sustituye el fondo totalmente blanco por secciones blancas alternadas con aguamarina pálido/gris suave y solicita cabecera azul marino oscura con texto blanco. Mantener logo dorado, carrito blanco y Salmo 133:1 debajo.

- 23:49: cuota mensual de vendedores cambia de USD 10.00 a USD 19.99, sin comisión propia. Compradores siguen gratis. Esta decisión sustituye todos los importes previos del plan y requisitos originales.
- 23:50: eliminar «Reina-Valera 1960» de la referencia visible bajo el logo, dejando «Salmo 133:1» y conservando la cita y su fuente.

- 23:59: autorización expresa para avanzar a etapa 3 (catálogo, carrito y pedidos), conservando pendiente correo/SMS/pagos y sin dispensar los requisitos de vendedor verificado/activo.

## Registro y búsqueda por categorías de negocios — 8 de octubre
Se conserva la lista literal suministrada (11 categorías y 96 especialidades) en `docs/categorias-negocios-originales.md`. El vendedor puede elegir varias categorías y sus especialidades opcionales; requiere al menos una categoría para guardar su solicitud. La clasificación se persiste en JSON `details.businessCategories` existente, sin migración ni reasignación de solicitudes antiguas. Se incorpora `/tiendas`, filtrable y buscable por actividad/especialidad/provincia; búsquedas generales de productos también muestran tiendas coincidentes. Se muestran únicamente negocios activos y contactos verificados, incluso si no publicaron artículos. No cambia la tarifa del vendedor, el acceso gratuito del comprador ni los proveedores pendientes.

Comprobaciones de categorías: las 96 etiquetas y los 11 grupos se comparan literalmente contra el archivo adjunto. Pruebas de filtros JSON parametrizados, frontend selector, SSR/privacidad y membresía pasan. Se mantiene la vista previa y no se publica automáticamente.

## Dos planes implementados — 10 de octubre
El usuario pidió implementar en la web dos opciones coexistentes: Normal US$19.99/mes y Mayor Visibilidad US$39.99/mes. No se sustituye ni elimina el Normal ni se suman ambas mensualidades. Cuenta compradora gratuita. Se ofrece comparación pública y selección persistente privada con confirmación no contractual. Los cobros reales y beneficios de prioridad siguen pendientes del proveedor. La insignia con cuatro emblemas exige autorización y acreditación institucional; elegir un plan no activa verificaciones ni prioridad. Se conserva clasificación de negocios, precio servidor en centavos y cabecera azul marino. No se modifica la propuesta Word en este pedido.


## Salida de Manus — 17 de octubre de 2026

El propietario decidió quitar Manus del proyecto y desplegarlo por su cuenta (Railway).

- **Login:** se reemplazó Manus OAuth por Google (OpenID Connect). La sesión es un JWT HS256 propio en la cookie `cz_session` (httpOnly, SameSite=Lax, Secure en HTTPS). Se conserva la protección CSRF del flujo con un nonce de un solo uso. El usuario se identifica como `google_<sub>`, no por correo.
- **Administrador:** se asigna desde `ADMIN_EMAILS`, solo con correo verificado por Google, y se recalcula en cada inicio de sesión. Sustituye a `OWNER_OPEN_ID`.
- **Fotos del catálogo:** se guardan en disco (`STORAGE_DIR`, volumen de Railway) y se sirven en `/media/catalog/`. Los documentos privados no cambian: siguen en MySQL y solo se sirven tras autorización.
- **Base de datos:** MySQL propio. Las migraciones 0000–0004 se aplican automáticamente al arrancar en producción. Los datos de la base de Manus no se migraron.
- **Eliminado:** módulos de IA, mapas, voz, generación de imágenes, notificaciones y telemetría de Manus, plugins de Vite y la configuración pública `__MANUS_CONFIG__`.
- **Imágenes de demostración:** las originales quedaron en el almacenamiento de Manus. Se usan marcadores en `client/public/assets/demo/` hasta reemplazarlas.
- **Pendiente relacionado con la etapa 2:** Google entrega el correo verificado. Se puede aprovechar para dar por verificado el correo del vendedor cuando coincida con el de su cuenta, pero no se hizo sin aprobación.


## Cierre de la etapa 2 — 18 de octubre de 2026

- **Correo:** se verifica con la cuenta de Google. Si el correo del perfil coincide con el de la cuenta (Google solo deja entrar con correo verificado), queda verificado al guardar el perfil o con el botón «Verificar con mi cuenta de Google». Se registra `email_verified_google`.
- **Teléfono:** no hay proveedor de SMS. Un administrador lo confirma por llamada o WhatsApp dentro del expediente, con una nota obligatoria. Se registran `phone_verified_admin` y `phone_verification_revoked` con autor, fecha y nota. Solo aplica a solicitudes pendientes y al mismo teléfono enviado.
- **Reglas:** para enviar bastan el correo verificado y un teléfono de Panamá válido. Para aprobar, ambos deben estar verificados. Los contactos siguen bloqueados mientras la solicitud está pendiente o aprobada.
- **Errores corregidos que venían de Manus:** (1) guardar la solicitud siempre fallaba con «Unrecognized key: consentVersion», porque la ruta pasaba campos de control a una validación estricta; (2) las categorías guardadas no se leían si la base devuelve JSON como texto (MariaDB). Ambos tienen prueba.
- Si más adelante se contrata un proveedor de SMS, puede sustituir la verificación manual sin cambiar las reglas de aprobación.


## Etapa 5, versión manual — 22 de octubre de 2026

- **Activación por el administrador:** el vendedor aprobado paga por Yappy, transferencia o efectivo. El administrador confirma el dinero y lo registra en `/admin/suscripciones` (plan, meses, método, comprobante, fecha). La tienda queda activa hasta el fin del período.
- **Reglas:** el monto debe coincidir exactamente con plan × meses (1 a 12). Un comprobante no puede registrarse dos veces con el mismo método. La fecha de pago no puede ser futura ni de hace más de 120 días. Si la suscripción sigue vigente, los meses se suman desde el vencimiento; si venció, empiezan el día del registro.
- **Vencimiento automático:** al arrancar y cada 15 minutos, las suscripciones con período terminado pasan a «vencida» y la tienda y sus productos dejan de mostrarse.
- **Desactivación anticipada:** con motivo obligatorio (pago revertido, falta grave).
- **Historial:** tabla `cz_subscription_payments` y eventos `subscription_payment_recorded` / `subscription_deactivated` en la auditoría.
- **Pendiente:** la pasarela automática (Yappy comercial, PagueloFácil o Tilopay) podrá registrar pagos por la misma vía. Los beneficios del plan Mayor Visibilidad (espacios destacados) aún no están implementados; hoy ambos planes publican igual.
- **Corregido:** las imágenes y datos de libros guardados como JSON no se leían cuando la base los devuelve como texto (MariaDB); en MySQL 8 funcionaban.


## Prueba gratis y comisión por venta — 22 de octubre de 2026

Decisión del propietario: los primeros 3 meses son gratis con 8% de comisión por venta; después, mensualidad del plan y 5% de comisión.

- **Prueba:** al aprobar por primera vez a un vendedor, su tienda se activa sola por 3 meses (`trialEndsAt`, plan `prueba`). Se registra `trial_started`.
- **Tasa:** depende de la fecha (`commissionBpsAt`), no del pago: pagar la mensualidad por adelantado durante la prueba no baja la comisión a 5% antes de tiempo. Se fija al crear el pedido (`cz_orders.commissionBps`).
- **Base:** solo el subtotal de productos; el envío no paga comisión. Se calcula al marcar el pedido como entregado (`commissionCents`, `deliveredAt`); los cancelados no generan comisión.
- **Cobro:** el comprador paga directo al vendedor, así que la comisión es una deuda del vendedor. El administrador la registra en `/admin/suscripciones` cuando la recibe; el pago debe coincidir con el total pendiente y salda todos los pedidos entregados (`cz_commission_payments`, `commission_payment_recorded`). La deuda se conserva aunque la tienda se oculte.
- **Supuestos que el propietario puede cambiar:** base sin envío; la prueba empieza al aprobar.
- **Textos:** se reemplazaron todas las promesas de «0% de comisión». Al comprador se le indica que CuadraZone no le cobra recargos.
- **Pendiente:** actualizar los términos y condiciones con este modelo antes de abrir al público.


## Plataforma abierta a vendedores de cualquier creencia — 22 de octubre de 2026

Decisión del propietario: CuadraZone ya no exige ser cristiano ni pertenecer a una iglesia para vender.

- **Eliminado como requisito:** declaración de fe, denominación, iglesia local, nombre del pastor y carta pastoral.
- **Se conservan como opcionales:** denominación (si se indica, debe existir y estar activa), iglesia, pastor y carta pastoral. Sirven a quien quiera mostrarlos o, más adelante, para los emblemas Cuadrangulares, que siguen requiriendo acreditación institucional.
- **Requisitos vigentes:** residencia en Panamá, documento de identidad vigente, correo y teléfono verificados, datos y categoría del negocio, código de conducta y privacidad.
- **Consentimiento:** nueva versión `borrador-2026-10-22-abierto`; los borradores anteriores deben guardarse de nuevo para enviarse.
- **Base de datos:** migración 0007 vuelve opcionales `denominationId`, `churchName` y `pastorName`. Las solicitudes existentes conservan sus datos.
- **Pendiente de decidir:** los textos de presentación del inicio todavía hablan de «emprendedores evangélicos» y «hermanos en Cristo».


## Pagos por Yappy — 22 de octubre de 2026

Decisión del propietario: los pagos se manejan con Yappy, porque la mayoría de los bancos ya lo usan.

- **Comprador → vendedor:** el comprador sigue pagando directo al vendedor; CuadraZone no recibe ese dinero ni necesita pasarela. Cada tienda registra su celular de Yappy (+507) y, si tiene Yappy Comercial, su nombre en el Directorio (`cz_stores.yappyPhone`, `yappyDirectory`, migración 0008).
- **Al comprar con Yappy:** solo se permite si todas las tiendas del carrito tienen Yappy registrado. El detalle del pedido muestra al comprador el Yappy del vendedor, el total y el número de pedido para escribirlo en el mensaje. Los pedidos por transferencia o contra entrega no exponen el Yappy del vendedor.
- **Vendedor → CuadraZone:** mensualidad y comisión se pagan al Yappy Comercial de CuadraZone (variable `PAYMENT_CONTACT`), escribiendo el nombre de la tienda en el mensaje. El administrador lo registra manualmente en `/admin/suscripciones`.
- **Costos de referencia (oct. 2026, confirmar al afiliarse):** Yappy Comercial cobra 1% + ITBMS por pago recibido, mínimo US$0.02. Una persona que recibe más de 50 pagos y más de US$10,000 al mes durante dos meses pasa a pagar esa misma comisión.
- **Futuro:** con las credenciales del Botón de Pago de Yappy Comercial se podrá confirmar los pagos de mensualidad y comisión automáticamente, sin registro manual.


## Pagos con tarjeta de crédito y débito — 22 de octubre de 2026

Se mantiene el pago directo al vendedor: CuadraZone no procesa tarjetas, no recibe ese dinero y no guarda datos de tarjeta.

- **Link de pago (`card_link`):** el vendedor registra un link https de Tilopay, PagueloFácil o PayPal (`cz_stores.cardPaymentUrl`). Solo se aceptan esos dominios y sus subdominios, sin usuario, contraseña ni puerto, para impedir links falsos que roben datos. El comprador ve el link en el detalle del pedido, con el total y el número de pedido.
- **Datáfono al recibir (`card_on_delivery`):** el vendedor lo activa (`cz_stores.cardOnDelivery`). Solo se permite con retiro o entrega a domicilio, no con envío por courier.
- **Reglas al comprar:** cada tienda del carrito debe aceptar el método elegido. Si el vendedor retira su link, el pedido deja de mostrarlo.
- **Costos:** los cobra la plataforma del vendedor (p. ej., Tilopay en Panamá 3.75% + US$0.50 según su publicación). La comisión de CuadraZone (8% o 5%) se calcula igual que con cualquier otro método.
- **Migración 0009:** amplía `cz_orders.paymentMethod` y agrega los campos de tarjeta a `cz_stores`.


## Solo vendedores cristianos evangélicos — 23 de octubre de 2026

Decisión del propietario (revierte la apertura del 22 de octubre): CuadraZone es para vendedores cristianos evangélicos y la aprobación la hace personalmente el administrador.

- **Obligatorio para enviar y aprobar:** nombre de la iglesia evangélica, nombre del pastor y la confesión de fe: «Soy cristiano evangélico, pertenezco a la iglesia evangélica que indiqué y confieso que Cristo es Rey y que Jesús es Dios» (`FAITH_CONFESSION`, registrada en `faithAccepted` con la versión `borrador-2026-10-23-confesion`).
- **Sigue opcional:** denominación de la lista y carta pastoral (el propietario no las pidió como requisito).
- **Aprobación:** manual por el administrador, quien puede confirmar con el pastor indicado. Sin cambios de base de datos (las columnas ya existían).
- Los textos del inicio («emprendedores evangélicos», «hermanos en Cristo») vuelven a ser exactos; no requieren cambio.
- Los borradores guardados con versiones anteriores deben guardarse de nuevo para aceptar la confesión.
- La declaración de fe es definitiva: el propietario indicó que no necesita revisión de un pastor del Concilio. Conducta y privacidad siguen como borradores pendientes de revisión jurídica.

## Conducta y privacidad definitivas — 23 de octubre de 2026

- El propietario pidió que el código de conducta y la política de privacidad sean definitivos. Se redactaron completos a partir de lo que el sitio hace realmente (datos de Google, perfil, solicitud de vendedor, tienda, pedidos, pagos, cookies, proveedores Google y Railway, derechos de la Ley 81 de 2019). Rigen desde el 23/10/2026; versión de consentimiento `2026-10-23`.
- Términos de uso y Reclamos siguen como borradores.
- Pendiente: nombre legal del responsable y correo de contacto para ejercer derechos, que hoy remiten a la sección de Ayuda.

## Los servicios no pagan comisión — 23 de octubre de 2026

Decisión del propietario: la comisión (8% en la prueba, 5% después) aplica solo a las tiendas que venden productos físicos. Quienes ofrecen servicios (clases, cursos, trabajos a domicilio, consultas) no pagan comisión: solo la mensualidad del plan después de los 3 meses gratis. Textos del sitio actualizados. Al construir la etapa 4, los servicios no deben generar `commissionCents`.

## Correos automáticos — 23 de octubre de 2026

- **Proveedor:** Brevo por su API HTTPS (plan gratis: 300 correos al día). Railway no permite SMTP en el plan Hobby. Resend no se usa (rechazado el 7 de octubre). Variables: `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`; sin ellas no se encola nada.
- **Bandeja de salida (`cz_email_outbox`, migración 0010):** cada correo se guarda en la misma transacción del evento y se envía cada 30 segundos, con hasta 5 intentos y espera creciente. `dedupeKey` evita duplicados aunque el servidor se reinicie.
- **Correos:** solicitud recibida (vendedor) y nueva solicitud (administradores); aprobación con prueba gratis o rechazo con motivo; pedido registrado (comprador, con datos de pago) y nuevo pedido (vendedor); cambio de estado del pedido; recibo de mensualidad y de comisión; recordatorio 7 días antes del vencimiento de la prueba o la mensualidad; aviso de tienda oculta al vencer.
- **Seguridad:** todo el texto se escapa en el HTML y los enlaces solo apuntan a rutas del propio sitio.
- **Privacidad:** se agregó Brevo a la lista de proveedores con los que se comparten datos.
- **No incluido por ahora:** correo por cada mensaje del chat (se sigue avisando con la campana dentro del sitio).

## Entrar con correo o celular — 24 de octubre de 2026

Decisión del propietario: además de Google, poder entrar con cualquier correo o solo con el número de celular, porque hay personas sin Gmail.

- **Página `/entrar`:** Continuar con Google, Entrar con mi correo (código por Brevo) y Entrar con mi celular (código por SMS). Cada opción aparece solo si está configurada (`/api/auth/methods`). Todas las pantallas que piden sesión llevan a `/entrar`.
- **Códigos (`cz_auth_codes`, migración 0011):** 6 dígitos, 10 minutos, 5 intentos; un código por minuto, 5 por hora por destino y 20 por hora por conexión. Solo se guarda el HMAC con `SESSION_SECRET`. Solo celulares de Panamá (+507 6…).
- **Una cuenta por persona:** el correo con código abre la cuenta de Google del mismo correo, y Google abre la cuenta creada antes con código. El celular verificado (`users.phone`, único) permite entrar con él. Los administradores siguen definidos por `ADMIN_EMAILS`.
- **Verificación de contactos en Mi cuenta:** el vendedor verifica su celular con SMS y cualquier correo con un código; la verificación por el administrador queda como respaldo.
- **SMS:** por defecto, un celular Android con la app gratuita SMS Gateway for Android en modo nube (`SMS_GATEWAY_USER`/`SMS_GATEWAY_PASSWORD`); se cambia a Twilio solo con variables (`SMS_PROVIDER=twilio`). Riesgos aceptados del modo Android: el teléfono debe estar encendido y con señal, y las operadoras pueden limitar envíos automáticos desde líneas personales.
- **Corregido:** `/admin/suscripciones` daba 404 al abrirse directamente o al refrescar (faltaba en la lista de páginas del servidor).
- Privacidad actualizada (métodos de entrada y proveedor de SMS).

## Abierto a cristianos y no cristianos, con valores cristianos — 24 de octubre de 2026

Decisión del propietario (reemplaza la del 23 de octubre): CuadraZone está abierto a vendedores y compradores cristianos y no cristianos, pero los valores cristianos no se negocian.

- **Obligatorio:** aceptar el compromiso `VALUES_COMMITMENT` (honestidad, respeto, trato justo, nada contrario a la fe cristiana; incumplirlo puede cerrar la tienda), registrado en `faithAccepted` con la versión `2026-10-24`.
- **Opcional:** iglesia, pastor, denominación y carta pastoral.
- **Textos:** la página «Declaración de fe» pasa a «Nuestra fe y valores» (fe de CuadraZone, abierto a todos, valores que no se negocian, aceptación). El inicio dice «emprendedores en Panamá, en un espacio con valores cristianos». El código de conducta prohíbe además el ocultismo. Correos y metadatos ajustados.

## Portada: elegir Marketplace o Servicios — 28 de octubre de 2026

- La portada pregunta «¿Qué estás buscando hoy?» con tres botones grandes apilados: **COMERCIOS** (antes «Marketplace») (productos físicos y libros) , **SERVICIOS** (clases, tutorías, trabajos a domicilio, consultas y eventos) y **CREAR TU TIENDA** (lleva a /vender). Los eventos van con Servicios porque son experiencias que se reservan, no productos físicos.
- Debajo quedan las colecciones reales del Marketplace (solo productos y libros); se quitaron el feed de ejemplo que mezclaba todo y la sección de servicios.
- El menú superior cambia según el mundo (`sectionFor`): en el Marketplace solo productos, libros y tiendas; en Servicios solo servicios y eventos; cada lado tiene un botón para pasar al otro. El catálogo de ejemplo filtra por mundo.
- El directorio de tiendas sigue mostrando todos los negocios registrados.

## Verificación inmediata y países — 29 de octubre de 2026

Decisión del propietario: aprobar al instante si los documentos coinciden, sin costo; residencia = elegir el país; selector de país en la portada.

- **OCR gratuito y local:** Tesseract (`tesseract.js` + `@tesseract.js-data/spa`) corre en el propio servidor; las imágenes no salen de CuadraZone. Se rechazó una IA de pago (Claude API) por costo.
- **Cómo compara:** el vendedor escribe nombres, apellidos y número tal como en su cédula; se buscan en el texto leído (tolera tildes y un error de lectura en palabras de 5+ letras). En la captura de Yappy o banco debe haber una línea que empiece con el primer nombre, contenga el primer apellido (completo o inicial) y no tenga palabras ajenas: acepta «SALEM J PIERRE D», rechaza otro nombre o un apellido extra.
- **Aprobación inmediata:** al enviar, si cédula ✓, Yappy/banco ✓, correo y celular verificados y consentimientos aceptados, la solicitud queda aprobada y arranca la prueba (`auto_approved`). Si algo no coincide, el vendedor ve ✗ roja con el motivo, puede corregir y reintentar; si envía igual, queda pendiente para revisión del administrador. Los PDF van a revisión manual.
- **Formulario:** nombres y apellidos legales, país (solo Panamá activo), captura de Yappy o banco (`payout`), lista de verificación con ✓ verde y ✗ roja que parpadean (sin animación si el sistema pide reducir movimiento).
- **Países:** 18 países en `shared/countries.ts`; solo Panamá activo. En la portada, «¿En qué país estás?»; en los demás se deja el correo (`cz_country_waitlist`, migración 0013, límite por IP).
- **Requisitos públicos:** se quitó «Aprobación personal del equipo de CuadraZone» y «Residencia en Panamá».
- **Riesgo aceptado:** una captura editada podría pasar la comparación; lo mitigan el celular verificado por SMS, el historial y la posibilidad de cerrar tiendas.

## Logo oficial — 29 de octubre de 2026

- Logo original del propietario (letras blancas «Cuadra», «Zone» dorado y carrito dorado con cruz). En el encabezado azul se usa sin el fondo (`logo-cuadrazone.png`, recortado y con el fondo azul vuelto transparente, sin alterar el diseño); en el pie claro, con su fondo azul original (`logo-cuadrazone-fondo.png`).
- Favicon: el carrito con la cruz sobre azul. Imagen para redes (`og-image.png`) a partir del original.

## Portada cinematográfica — 30 de octubre de 2026

- Portada en dos columnas en escritorio: botones a la izquierda y un mosaico de fotos a la derecha (una grande y dos chicas). Cada foto hace un zoom lento («Ken Burns») y se funde con otra a su propio ritmo; marco azul con brillo dorado y el Salmo 133:1 flotando. Fotos de Unsplash (licencia libre): mercado, bolso artesanal, clase, herramientas, alabanza y Biblia.
- En celular el mosaico va debajo de los botones, más bajo y sin el versículo. Sin animación si el sistema pide reducir movimiento.
- Para usar fotos reales de CuadraZone, cambiar las URLs de `mosaicTiles` en `client/src/pages/Home.tsx`.

## Portada con video de fondo — 30 de octubre de 2026 (reemplaza el mosaico)

- El propietario prefirió el video al mosaico. La portada tiene un video sin sonido y en bucle de fondo, con un velo azul marino más oscuro a la izquierda (donde están el título y los botones) y más transparente a la derecha. Título y textos en blanco y dorado.
- Video (cambiado el 30/10 por uno digital): «Woman exploring an online sales page on her cell phone» de Mixkit (antes, un mercado de frutas) (licencia gratuita de Mixkit, uso comercial). Fuentes en orden: `client/public/assets/video/portada.mp4` (si existe, video propio), luego el de Mixkit en 720p y 360p.
- No se reproduce si el sistema pide reducir movimiento o ahorrar datos: se muestra una foto fija.

## Envío por provincia — 30 de octubre de 2026

- Cada tienda define un precio de envío por provincia (`cz_stores.shippingFeesByProvince`, migración 0014); la cobertura son esas provincias. Las tiendas con tarifa única siguen funcionando (`shippingFeeFor`, `coveredProvinces`). La entrega a domicilio queda como tarifa de la propia provincia.
- Las tarjetas y la ficha del producto muestran «Desde [provincia de la tienda]» y «Envío a [provincia del comprador]: US$X» o «No envía a …». La provincia del comprador es la de «Explorar en» del encabezado y se usa por defecto al comprar; el servidor recalcula y rechaza totales con el envío de otra provincia.
- La provincia del vendedor ya se pide en la solicitud y en la tienda. Los servicios (etapa 4) usarán la misma regla.

## Bienes raíces, y botones de Autos y Empleo — 31 de octubre de 2026

Decisiones del propietario: publicar en Bienes raíces, Autos y Empleos es pagado con uno de los dos planes; cualquier persona con cuenta puede publicar (sin verificación de vendedor); se construye primero Bienes raíces.

- **Portada:** seis botones en dos columnas: Comercios, Servicios, Bienes raíces, Autos, Buscar empleo y Crear tu tienda. Autos y Buscar empleo llevan a una página «Próximamente».
- **Anuncios (`cz_properties`, migración 0015):** venta o alquiler de casa, apartamento, terreno, local u oficina. Campos según el tipo: habitaciones y baños (casa y apartamento), metros de construcción o de terreno, piso, estacionamientos, amueblado, mascotas (alquiler), uso de suelo, título, agua y luz (terreno), comodidades, depósito y contrato mínimo (alquiler). Ubicación aproximada, hasta 15 fotos (`/media/catalog/properties/…`), celular de contacto con WhatsApp y llamada.
- **Plan para publicar:** vale el plan activo de la tienda (incluida la prueba) o un plan de anunciante (`cz_advertiser_plans` y `cz_advertiser_payments`) que el administrador registra con el correo o celular de la cuenta, con el monto exacto. Publicar exige plan activo y al menos una foto. Si el plan vence, los anuncios dejan de mostrarse sin borrarse. Mayor Visibilidad: «Destacado» y primero en la búsqueda.
- **Búsqueda:** Comprar o Alquilar, tipo, provincia, precio, habitaciones, amueblado, mascotas y texto. Menú propio de la sección.
- **Pendiente:** Autos y Buscar empleo (CV, postulaciones y publicación de vacantes), con las mismas reglas de plan.

- 31/10/2026: se quitó el video de fondo de la portada a pedido del propietario; la portada queda con fondo blanco.

- 31/10/2026: en pantallas de 1500 px o más el contenedor usa hasta el 92% del ancho (máx. 2100 px) para que el logo quede a la izquierda; los botones de la portada usan todo el ancho (2 columnas en laptop, 3 en pantallas grandes).

## Autos — 2 de noviembre de 2026

- Venta y alquiler de sedán, SUV, pickup, hatchback, coupé, van, moto y camión (`cz_vehicles`, migración 0016). Mismas reglas que bienes raíces: cualquier persona con cuenta prepara anuncios; publicar exige plan activo (tienda o anunciante) y al menos una foto; Mayor Visibilidad = «Destacado» y primero; si vence el plan, se ocultan. El plan de anunciante sirve para bienes raíces y autos.
- Campos: marca (lista de las más comunes en Panamá u «Otra» escrita), modelo, año, condición, kilometraje (un nuevo no puede pasar de 1,000 km), transmisión, combustible, color, motor, puertas, equipamiento, precio negociable y si está a nombre del vendedor (venta); período por día, semana o mes, depósito y edad mínima del conductor (alquiler); provincia y distrito; particular, concesionario o rentadora; celular con WhatsApp y llamada; hasta 12 fotos (`/media/catalog/vehicles/…`).
- Filtros: Comprar o Alquilar, tipo, marca, provincia, año desde y hasta, precio, kilometraje máximo, transmisión, combustible, condición y texto.

## Buscar empleo — 2 de noviembre de 2026

- **Quien busca (gratis):** CV en CuadraZone (`cz_resumes`): nombre, oficio, resumen, celular, correo, provincia, disponibilidad, experiencia, estudios, habilidades e idiomas; vista previa y «Descargar PDF» (impresión del navegador que solo imprime la hoja del CV). Aplica con un clic y un mensaje opcional; ve el estado en «Mis postulaciones».
- **Quien publica (con plan):** vacantes (`cz_jobs`) con cargo, empresa, área, jornada, modalidad, provincia, salario (rango y período) o «a convenir», descripción, requisitos, beneficios y fecha de cierre. Publicar exige plan activo (tienda o anunciante) y fecha de cierre futura; las vencidas o con plan vencido no se muestran ni reciben postulaciones. Mayor Visibilidad = «Destacada».
- **Postulaciones (`cz_job_applications`, migración 0017):** guardan una copia del CV al aplicar; una por vacante; no se puede aplicar a la propia. La empresa ve los candidatos, los marca vista (automático al abrir el CV), entrevista o no seleccionado, y los contacta por WhatsApp, llamada o correo.
- **Correos:** a la empresa por cada candidato; al candidato cuando pasa a entrevista o no es seleccionado.
- **Privacidad:** el CV solo lo ve la empresa a la que se aplicó.

## Respaldo de la base de datos — 2 de noviembre de 2026

- Botón «Descargar respaldo de la base de datos» en /admin (ruta `GET /api/admin/respaldo.sql`, solo administradores; 401 sin sesión, 403 si no es admin). Genera un único .sql con la estructura y todos los datos de todas las tablas, incluidos documentos binarios y el registro de migraciones. Probado: restaurado en una base vacía, las 34 tablas quedan idénticas (CHECKSUM TABLE) y el sitio funciona sobre ella.

## Solo correo para registrarse — 3 de noviembre de 2026

- Decisión del propietario: basta el correo verificado (Google o código por correo). El celular se pide como contacto para los compradores, pero ya no se verifica por SMS ni se exige verificado para enviar la solicitud, para la aprobación inmediata ni para que el administrador apruebe.
- `ADMIN_EMAILS` tolera comillas, espacios, mayúsculas y separadores con coma, punto y coma o espacio.
- El trabajo de «varias tiendas por cuenta» quedó guardado aparte (git stash) para retomarlo.
- 3/11/2026: el administrador va directo a /admin al entrar (si no tenía página pendiente), ve un enlace «Administración» en el menú y un aviso en Mi cuenta. El perfil nuevo se precarga con el nombre, correo y celular de la cuenta. El saludo del encabezado usa el nombre de la persona.

## Comercio y Servicios separados por completo — 4 de noviembre de 2026

Decisión del propietario: cada tienda vende cosas tangibles (comercio) o servicios, nunca los dos; se elige al abrir la tienda.

- **Tipo de tienda** (`cz_membership_applications.storeKind` y copia en `cz_stores.storeKind`, migración 0018; las existentes quedan «comercio»). La solicitud obliga a elegir: Comercio usa categorías de productos (`catalogCategories`, sin «Servicios»); Servicios usa las 11 categorías de servicio. Se puede cambiar el tipo solo mientras la tienda no tenga publicaciones.
- **Comercio:** productos con datos tangibles (condición nuevo/usado/reacondicionado, marca, peso, medidas, garantía), inventario, envíos por provincia y hasta 3 videos por producto (MP4/WEBM/MOV, 40 MB, se verifica la firma del archivo; `/api/catalog/products/:id/videos`). El catálogo público de Comercios solo muestra tiendas de comercio.
- **Servicios:** `cz_services` (tipo: clase, curso, a domicilio, consulta, eventos, otro; precio fijo, por hora, desde o a cotizar; duración; modalidad a domicilio/en local/en línea; provincias de cobertura; horario; hasta 8 fotos). Sin envíos, inventario, carrito, pedidos ni comisión. Solicitudes (`cz_service_requests`) con correo al proveedor y estados nueva/contactada/cerrada; límite de 3 por día por persona y servicio. Páginas públicas reales `/servicios` y `/servicio/:slug` (reemplazan el catálogo de ejemplo).
- **Celular:** el catálogo y el directorio ya no exigen celular verificado para mostrar tiendas (coherente con el registro solo con correo del 3/11).

## Prueba gratis visible y entrada directa a la tienda — 5 de noviembre de 2026

- El estado «Aprobado · pago pendiente» era un texto fijo para cualquier solicitud aprobada, aun en la prueba gratis. Ahora `sellerStatus` decide: en prueba → «Aprobado · prueba gratis hasta el …» y aviso de que no hay nada pendiente; pagado → «tienda activa hasta el …»; solo vencido → «pago pendiente». La solicitud expone `subscriptionStatus`, `subscriptionPlanId`, `subscriptionEndsAt` y `trialEndsAt`.
- Al entrar (código por correo o Google) sin página pendiente: administrador → /admin; vendedor aprobado con tienda activa (incluida la prueba) → /vendedor/productos (agregar productos o servicios según su tipo), o /vendedor/tienda si aún no creó la tienda; los demás → portada. Acceso directo «Agregar productos/servicios» en Mi cuenta.

## Eliminar la tienda por completo — 5 de noviembre de 2026

Decisiones del propietario: las ventas pasadas y los pagos se conservan sin datos del vendedor; no se puede eliminar con pedidos en curso o comisiones sin pagar; solo se borra la tienda (bienes raíces, autos y empleos se quedan en la cuenta).

- «Zona de peligro» en Mi tienda: muestra qué se borra y qué se conserva; exige escribir el nombre exacto de la tienda y marcar que es permanente. Rutas `services.deletionCheck` y `services.deleteStore`.
- Se borra para siempre: tienda, productos, variantes, fotos y videos (también del disco), servicios y sus solicitudes, reseñas, preguntas, favoritos, carritos, conversaciones y mensajes del vendedor, la solicitud de vendedor, sus documentos (cédula, Yappy), su historial y el plan elegido. Correo de confirmación.
- Se conserva: los pedidos pasados como «Tienda eliminada» (migración 0019: `cz_orders.storeId` y `cz_order_items.productId/variantId` pasan a admitir vacío, `cz_orders.storeName`), con título y precio; solo los ve el comprador. Los pagos de mensualidades y comisiones quedan como registro contable. La cuenta sigue y puede abrir una tienda nueva desde cero.
- Arreglo encontrado en las pruebas: las solicitudes de comercio exigían categorías de servicio (validación vieja); ahora cada tipo valida sus propias categorías.

## Videos en autos — 6 de noviembre de 2026

- Los anuncios de autos (venta y alquiler) aceptan hasta 3 videos además de las 12 fotos (`cz_vehicles.videos`, migración 0020). MP4, WEBM o MOV, máximo 40 MB, con verificación de la firma del archivo (`/api/vehicles/:id/videos`); solo el dueño del anuncio puede subir.
- En el editor, sección «Fotos y videos del vehículo»: la primera foto es la portada y cada foto o video tiene «Quitar» (guarda al instante). En la ficha pública los videos van debajo de las fotos; en la búsqueda, etiqueta «Con video».
- Al borrar un anuncio de autos se borran también sus fotos y videos del disco.
