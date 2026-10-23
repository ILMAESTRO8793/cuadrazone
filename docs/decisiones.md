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
