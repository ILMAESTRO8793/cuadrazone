# CuadraZone — Plan de implementación y dirección visual

**Estado:** etapa 1 aprobada por el usuario el 7 de octubre de 2026; etapa 3 implementada y en cierre de pendientes autorizado el 8 de octubre; etapa 2 mantiene correo/SMS y cuenta administrativa pendientes. Dirección vigente: logo dorado con carrito blanco, cabecera azul marino con texto blanco, secciones blancas alternadas con aguamarina pálido y cuenta de comprador gratuita sin mensualidad. El proyecto tiene servidor y base de datos; todavía no hay cobros activos.

**Fuente de alcance:** `docs/requisitos-originales.md`. Se conservan las siete etapas y los requisitos del documento original salvo los cambios posteriores recogidos en `docs/decisiones.md`, que prevalecen: logo dorado, plataforma blanca y cuenta de comprador sin mensualidad. Cada etapa se mostrará antes de pasar a la siguiente.

## 1. Producto y reglas de negocio

CuadraZone es un marketplace en español para vendedores evangélicos verificados que residen en Panamá. Cualquier visitante puede navegar y buscar libremente. La cuenta de comprador es **gratuita, sin cuota mensual ni suscripción de pago para comprar**. Tras registrarse, el comprador podrá comprar productos y boletos o reservar servicios; paga los artículos y cargos de cada transacción, no una cuota de acceso. Los vendedores pagan **USD 19.99 al mes**; **CuadraZone no cobra comisión propia por venta**. Las comisiones del proveedor de pago se muestran por separado. País de operación: Panamá; moneda: USD; zona horaria de citas y eventos: `America/Panama`.

Los cuatro actores son visitante, comprador, vendedor y administrador. Las autorizaciones se verifican en el servidor; ocultar un botón en el navegador no equivale a un permiso. Una persona podrá tener capacidades de comprador y vendedor con cuenta de comprador gratuita y cumplimiento de la verificación/suscripción exigida al vendedor; el rol de administración se asigna de manera controlada.

### Vendedores

La solicitud incluye datos personales o de empresa, teléfono y correo verificados, cédula panameña o carné de residente vigente, residencia en Panamá, denominación de una lista cerrada editable (inicialmente Iglesia Cuadrangular, Iglesia de Dios y Asambleas de Dios), iglesia local, ciudad, pastor, carta pastoral firmada PDF/imagen y aceptación de la declaración de fe y del código de conducta.

Flujo: **Pendiente → Aprobado o Rechazado con motivo**. Tras la aprobación, el pago de la primera mensualidad activa la tienda. El impago oculta automáticamente la tienda hasta regularizar. La suspensión administrativa tiene prioridad sobre una suscripción pagada. No se mostrará una insignia de verificación por rellenar un formulario.

### Publicaciones

- **Productos físicos:** hogar, ropa, tecnología, alimentos, belleza, artesanías y categorías generales; variantes de talla/color, inventario, múltiples fotos y precio.
- **Libros cristianos destacados:** autor, editorial, ISBN, idioma, formato y estado nuevo/usado.
- **Boletos:** nombre de evento, artista, fecha/hora, lugar/mapa, tipos General/VIP y otros, precios y capacidad. Boleto digital con QR único en la cuenta y por correo. Escaneo por organizador autorizado, validación de un solo uso y control de aforo en tiempo real.
- **Servicios y oficios:** abogacía, contabilidad, salud, educación, construcción, plomería, electricidad, belleza, eventos, tecnología, transporte y otras empresas; solicitud de cotización o reserva mediante disponibilidad del vendedor.

## 2. Dirección visual

### Movimiento de diseño

**Comercio editorial contemporáneo:** navegación familiar y utilitaria de un marketplace, con una identidad cálida propia. La referencia funcional es Amazon, sin copiar su logotipo, su flecha ni su presentación exacta.

### Principios

1. **Confianza visible:** precio, vendedor, verificación, entrega y condiciones junto a la acción de compra.
2. **Claridad comercial:** búsqueda protagonista, jerarquía de información y lectura rápida en celulares.
3. **Calidez sobria:** superficies claras, fotografías útiles y color aplicado con moderación.
4. **Identidad propia:** conservar la tipografía y el carrito aprobados, recolorear el texto y el trazo del logo a dorado y utilizar los cuatro colores de los emblemas como acentos, no como decoración excesiva.

### Paleta y filosofía del color

- Dorado antiguo `#B58C3C`: logo y acentos de marca. Es el **color distintivo principal** de la dirección revisada.
- Azul marino `#071F3B`: cabecera oscura, texto blanco e iconos claros; navegación en `#05172C`.
- Blanco `#FFFFFF`: tarjetas, formularios y secciones de contenido, no toda la plataforma.
- Aguamarina pálido `#EAF5F2` y gris pálido `#F3F6F6`: fondos alternados y separación visible entre bloques.
- Blanco `#FFFFFF`: tarjetas y formularios.
- Dorado `#F4B52E`: acciones principales y énfasis cálido.
- Rojo `#E72A31`, azul `#1D7AE4` y púrpura `#6D39B6`: acentos secundarios vinculados a los emblemas, usados de manera puntual.
- Texto carbón `#17233A` y grises neutros: lectura; los estados de éxito/error tendrán color y etiqueta, no solo color.

Se comprobará el contraste de textos y botones. No se utilizará blanco hueso sobre fondos claros para contenido legible.

### Composición

Cabecera azul marino con texto blanco, densa pero ordenada: logo, provincia de entrega, búsqueda extensa, cuenta, favoritos y carrito. Segunda fila de navegación por categorías y tipos de publicación. Inicio con hero horizontal asimétrico: mensaje a la izquierda y una composición de productos a la derecha; después, filas curadas y secciones alternadas. El catálogo emplea una barra lateral de filtros en escritorio y un panel deslizable en móvil. La cuadrícula de productos se reserva para listados, no se aplica a toda la página.

En móvil: buscador accesible, navegación compacta, tarjetas de dos columnas, formularios de una columna, filtros en panel y acción de compra fija en páginas de detalle.

### Motivos de marca

- Cartucho dorado de acción y etiquetas suaves con esquinas redondeadas.
- Líneas finas y pequeños acentos de los cuatro emblemas para separar secciones.
- Insignia de vendedor verificado junto al nombre, con explicación accesible.

### Interacciones y animación

Estados claros para cargar, vacío, error y éxito. Las acciones destructivas piden confirmación en la aplicación. Transiciones de 160–220 ms para paneles y tarjetas; desplazamientos discretos de 4–8 px; sin animaciones continuas que compitan con el catálogo. Se respeta `prefers-reduced-motion` y la navegación por teclado.

### Tipografía

**Manrope** para titulares y cifras; **DM Sans** para navegación, formularios y texto. Jerarquía compacta de 14–16 px en interfaz, 24–32 px en secciones y 40–56 px en hero de escritorio, adaptada a móvil. El logo no se sustituye por texto con una fuente parecida: se usa la imagen aprobada.

### Esencia y voz

**Posicionamiento:** el marketplace de Panamá que conecta a la comunidad con vendedores evangélicos verificados, sin comisión propia por venta.

**Personalidad:** confiable, cercana, práctica.

**Ejemplos:** “Descubre lo que nuestra comunidad tiene para ti.” / “Tu tienda, tu trabajo, nuevas oportunidades.” Las etiquetas de compra son directas: “Añadir al carrito”, “Solicitar cotización”, “Reservar cita”, “Ver boletos”. No se atribuyen apoyos oficiales de iglesias que no hayan sido autorizados.

### Logo

Usar la tipografía y el carrito aprobados, ahora con el texto y el contorno en dorado según la última solicitud. El carrito pequeño mira a la izquierda y se ubica arriba y a la derecha de la última e. Conservar la disposición aprobada. Preparar una exportación web recortada y optimizada sin deformar el contenido, sobre cabecera azul marino. Los cuatro emblemas del carrito conservan rojo, dorado, azul y púrpura.

## 3. Mapa de páginas

### Públicas

- `/`: inicio con banners, categorías, destacados, más vendidos y novedades.
- `/catalogo`: resultados con autocompletado y filtros por categoría, precio, provincia, calificación y tipo.
- `/producto/:slug`: galería, descripción, precio, variantes, entrega, vendedor, reseñas, preguntas/respuestas y relacionados.
- `/libros`, `/eventos`, `/servicios`: entradas destacadas de los tipos de publicación.
- `/evento/:slug`: evento, mapa, tipos de boleto y capacidad disponible.
- `/servicio/:slug`: perfil, cotización y calendario de reserva.
- `/tienda/:slug`: perfil público, iglesia, calificación, insignia y catálogo del vendedor.
- `/suscripciones`: cuenta de comprador gratuita y vendedor USD 19.99/mes, con condiciones y sin comisión de CuadraZone.
- `/vender`: explicación y acceso a la solicitud.
- `/ayuda` y páginas legales: términos, privacidad, conducta, fe, reclamos/devoluciones.

### Comprador autenticado

Cuenta gratuita, carrito multivendedor, deseos, checkout, historial/detalle de pedidos, mensajes, notificaciones, boletos y citas. El carrito se agrupa por vendedor y muestra envío, retiro o domicilio según provincia. Los pedidos tienen estados Pendiente, Confirmado, Enviado, Entregado y Cancelado.

### Vendedor y organizador

Solicitud y estado de verificación; tienda; publicaciones e inventario; pedidos; eventos/boletos; citas y cotizaciones; mensajes; reseñas; suscripción y reportes de ventas. El escaneo de boletos se restringe al organizador autorizado del evento.

### Administrador

Solicitudes con visor de documentos protegido; denominaciones/categorías/banners; moderación de publicaciones/reseñas; suspensión de vendedores; reclamos con plazo de respuesta de **48 horas**; reportes de usuarios activos, suscripciones, ingresos mensuales y ventas por categoría. Las decisiones dejan un registro de auditoría.

## 4. Stack y arquitectura

### Elección

Se utiliza el starter instalado: **React 19 + TypeScript + Tailwind 4**, **Express + tRPC + Zod**, **MySQL administrado + Drizzle**. Esto permite reutilizar componentes accesibles, compartir tipos entre cliente/servidor, validar entradas, mantener migraciones y desplegar una única aplicación. Se conserva el package manager fijado a pnpm 10.18.0.

La autenticación utiliza **Google (OpenID Connect)** desde el 17 de octubre de 2026 (antes Manus OAuth; ver `docs/decisiones.md`), con sesiones validadas y permisos propios de la aplicación. No se inventará un usuario de prueba autenticado ni una contraseña de administrador compartida. El acceso administrativo se vincula a una identidad real autorizada. Si posteriormente se solicita otro proveedor de acceso, se revisa esa decisión antes de sustituirlo.

El servidor sirve API, webhooks, sesiones y el frontend. Para SEO, las páginas públicas tendrán contenido y metadatos significativos en el HTML inicial mediante una capa de renderizado/prerenderizado apropiada; las cuentas y paneles privados quedan fuera del índice. La URL canónica se configura con el dominio real, no con una dirección interna supuesta.

### Estructura de proyecto

- `client/src/pages/`: páginas públicas, comprador, vendedor y administración.
- `client/src/components/marketplace/`: cabecera, navegación, búsqueda, tarjetas, filtros, galerías, insignias y formularios reutilizables.
- `client/src/features/`: módulos de catálogo, carrito, pedidos, verificación, eventos, servicios, mensajes y suscripciones.
- `client/src/lib/`: clientes tRPC, formato USD/fechas, utilidades de accesibilidad.
- `server/routers/`: procedimientos públicos/protegidos organizados por dominio.
- `server/services/`: reglas de acceso, inventario, pagos, QR, disponibilidad, correo y documentos.
- `server/_core/`: servidor y autenticación base; se mantiene su contrato de sesión.
- `drizzle/schema.ts` y `drizzle/`: tablas, relaciones y migraciones versionadas.
- `shared/`: enums, validadores y tipos de negocio compartidos.
- `client/public/`: activos pequeños, manifiesto de rutas y recursos públicos apropiados.
- `docs/`: requisitos, operación, integraciones y borradores legales.

### Modelo de datos previsto

Usuarios/capacidades; perfiles y solicitudes de vendedor; denominaciones; documentos protegidos y auditoría; tiendas; categorías; publicaciones/fotos/variantes/inventario; carrito/deseos; pedidos, partidas por vendedor y pagos; reseñas y preguntas/respuestas; eventos, tipos de boleto, boletos y accesos QR; servicios, disponibilidad, citas y cotizaciones; conversaciones/mensajes/notificaciones; suscripciones y eventos procesados; reclamos/respuestas/decisiones; banners.

Precios y totales se guardan en centavos y moneda USD. Inventario, capacidad, reservas y validación de QR utilizan transacciones y restricciones para prevenir ventas excesivas o doble uso. Las reseñas solo se habilitan por una compra real del usuario sobre el artículo correspondiente.

### Seguridad y documentos

Validación del servidor, permisos por propietario/recurso, sesiones seguras, límites de carga, comprobación de tipo/tamaño, registro de auditoría y protección frente a abuso. Cookies de sesión aptas para la vista previa HTTPS: `SameSite=None; Secure`.

Las cédulas y cartas pastorales no se expondrán como imágenes públicas ni se incluirán en Git. Se seleccionará antes de recibir documentos reales un flujo de almacenamiento privado o cifrado con acceso servido por el backend y autorización de administrador/solicitante. La retención y el borrado físico se definirán con el proveedor de almacenamiento y la revisión legal; una ocultación de registro no se presentará como eliminación física.

No se almacenan números de tarjeta, códigos de seguridad ni credenciales del proveedor en tablas o navegador. Los secretos se introducen mediante el flujo protegido de configuración.

## 5. Pagos, suscripciones y dependencias reales

La integración será por adaptadores, para conservar el mismo modelo de pedidos y derechos de acceso. El proveedor definitivo para Panamá se confirma con su documentación, funciones recurrentes, habilitación comercial y credenciales antes de la etapa 5. No se sustituirá automáticamente por Stripe si no corresponde al comercio panameño.

Se mantiene la alternativa que el usuario autorizó: pago directo al vendedor por Yappy, transferencia o contra entrega, registrado en el pedido, si la liquidación directa desde una pasarela no es viable en la primera versión. Un comprobante subido o el retorno a una página de éxito no se tratarán como prueba definitiva de un pago electrónico.

Suscripción mensual SOLO del vendedor: USD 19.99, cobro recurrente, recordatorios, cancelación/impago y bloqueo de la tienda. Los webhooks se verifican y deduplican. La tienda se oculta por impago. El comprador no requiere una suscripción de pago ni una cuota mensual para comprar/reservar; únicamente una cuenta autenticada y el pago de su transacción cuando corresponda.

ITBMS se configura cuando aplique, con desglose claro, sujeto a validación fiscal del operador. Las tarifas de pasarela se muestran por separado; CuadraZone no agrega comisión propia.

**Dependencias para producción:** cuentas y aprobación comercial de pasarela/PayPal; proveedor de correo transaccional para verificación, recibos y QR; proveedor de teléfono/SMS y, opcionalmente, WhatsApp; decisiones de retención/borrado de documentos; dominio y textos legales revisados. Estas dependencias no impiden diseñar la etapa 1, pero no se simularán como servicios ya activos.

## 6. Etapas de construcción y revisión

### Etapa 1 — Diseño visual y estructura

Crear una vista previa responsive con logo real y sistema visual: inicio, navegación/búsqueda, catálogo de ejemplo de los cuatro tipos, una ficha de producto, tienda pública, página de suscripciones y entrada de vendedores. Definir las rutas y los layouts de comprador/vendedor/admin. Los datos ilustrativos estarán identificados como demostración y no se presentarán como vendedores verificados reales, ventas reales o pagos activos. Navegación y componentes de interfaz funcionarán; la lógica comercial persistente pertenece a las siguientes etapas.

**Parada de revisión:** mostrar la vista previa y pedir conformidad con diseño/estructura antes de etapa 2.

### Etapa 2 — Registro, roles y verificación

Autenticación real; capacidades/roles y protección de rutas; solicitud completa con documentos, listas cerradas editables y aceptaciones; verificación de correo/teléfono mediante proveedores configurados; estados Pendiente/Aprobado/Rechazado con motivo. Acceso protegido a documentos. Primera relación entre aprobación, suscripción y activación de tienda, preparada para el proveedor de pagos.

**Parada de revisión** antes de etapa 3.

### Etapa 3 — Catálogo, búsqueda, carrito y pedidos

Publicaciones de productos/libros persistentes con variantes/inventario/fotos/metadatos; catálogo y autocompletado/filtros; tienda pública; deseos y carrito multivendedor; pedidos y sus estados; modalidades de entrega por provincia; reseñas de compra verificada y preguntas/respuestas; mensajería y notificaciones internas. No inventar confirmaciones de pago antes de integrar el proveedor.

**Parada de revisión** antes de etapa 4.

### Etapa 4 — Boletos QR y servicios con citas

Eventos, tipos/precios/capacidad de boleto, boleto digital y correo con proveedor real; scanner por organizador, QR único y consumido una sola vez, aforo. Servicios, cotizaciones, calendario y prevención de solapamientos. Mostrar el recorrido completo en vista previa.

**Parada de revisión** antes de etapa 5.

### Etapa 5 — Pagos y suscripciones

Confirmar gateway disponible en Panamá y PayPal adicional; credenciales por canal protegido; checkout, tarifas, ITBMS, webhooks/idempotencia, compras y liquidación directa o fallback autorizado. Suscripción del vendedor con cobro mensual de USD 19.99, recordatorios, bloqueo/ocultación por impago y regularización. No se implementa cobro mensual ni bloqueo por suscripción para el comprador. Mantener pruebas del proveedor separadas de cobros reales.

**Parada de revisión** antes de etapa 6.

### Etapa 6 — Paneles completos

Consolidar vendedor: publicaciones, inventario, pedidos, eventos/boletos, citas, mensajes, reseñas, suscripción y ventas. Consolidar administrador: cola/visor, denominaciones/categorías/banners, moderación/suspensión, reclamos y plazo de 48 horas, reportes solicitados. Auditoría y permisos.

**Parada de revisión** antes de etapa 7.

### Etapa 7 — Pruebas, despliegue y documentación

Corregir errores de integración y funcionamiento, comprobar controles sensibles, responsive, SEO y rendimiento. Revisar borradores legales con el operador/abogado. Desplegar la versión aprobada; entregar URL de prueba/publicación confirmada, acceso administrativo real autorizado y manual para operar, configurar proveedores, gestionar vendedores, documentos, reclamos y datos. No llamar «lista para producción» a una versión con pagos/verificación sin conectar o controles críticos pendientes.

## 7. Borradores legales

Términos y condiciones, privacidad considerando la Ley 81 de 2019 de Panamá, código de conducta, declaración de fe y política de reclamos/devoluciones. Se etiquetan expresamente como **borradores para revisión de un abogado**, no como certificación de cumplimiento legal. Los plazos, base de tratamiento, retención, transferencias y responsabilidades se ajustan con datos del operador.

## 8. Implementación vigente de la etapa 2

El usuario aprobó diseño y avance a registro, roles y verificación. Se preservan las cuentas gratuitas de comprador, logo dorado y plataforma blanca.

- Acceso real Manus OAuth y perfil persistente. Comprador gratuito; privilegios administrativos vinculados solo a la identidad de propietario configurada, nunca a un campo público del formulario.
- Solicitud de vendedor con datos individuales/empresa, identificación, residencia en Panamá, denominación cerrada, iglesia/pastor y consentimientos versionados. Correo/teléfono no se consideran verificados solo por rellenarlos o iniciar sesión.
- Documentos pequeños privados en una tabla MySQL BLOB, hasta 5 MiB por archivo (identidad y carta pastoral), servidos únicamente a solicitante o administrador después de autorización del servidor. Nunca se usan URLs públicas `/manus-storage/` para estos archivos. Se valida firma del formato, tipo y tamaño. No se afirma un cifrado de almacenamiento que no se haya comprobado. La evolución a almacenamiento privado especializado y política de retención se revisará antes de producción.
- Cambios de contacto invalidan sus verificaciones; contactos de solicitudes en revisión/aprobadas quedan protegidos frente a cambios que alterarían la evidencia. Revisión administrativa con motivo para rechazar, control de versión y auditoría. Aprobar no activa la tienda: queda pendiente del primer pago de USD 19.99, etapa 5.
- El 7 de octubre se rechazó la propuesta de conectar Resend. No se habilitan sus servicios ni se reintenta esa autorización por otra vía. Correo/SMS se mantienen pendientes de la elección del usuario; sin proveedor real configurado, envío de códigos y aprobación de solicitudes incompletas fallan de forma explícita. Se puede preparar el módulo sin simular entregas ni verificaciones.
- La etapa 2 no se marcará íntegramente completa mientras no pueda demostrarse el recorrido requerido de correo y teléfono verificados. Se mostrará el trabajo implementado y la dependencia pendiente, antes de avanzar a etapa 3.


### Marca vigente — actualización 7 de octubre, 22:32

El usuario retiró la propuesta de cruz principal y pidió regresar al carrito de compras de la versión anterior: pequeño, blanco, orientado a la izquierda, arriba a la derecha de la última e, con paloma dorada, cruz roja, copa azul y corona púrpura dentro. Se conserva la palabra dorada, sin puntos sobre la e, y la plataforma blanca. El contorno dorado fino hace visible el carrito blanco sobre la cabecera blanca.

### Estado de la etapa 2

Registro OAuth, perfil, solicitud privada y revisión por roles implementados. El usuario dejó correo/SMS pendientes; no se simulan verificaciones ni se aprueban solicitudes incompletas. La cuenta administrativa debe elegirse y autorizarse expresamente; no se asigna al primer visitante. Revisión con cuenta real y etapas 3–7 pendientes.

### Mensaje bíblico bajo el logo — 7 de octubre, 22:53

Mostrar en la cabecera, directamente debajo de la imagen de CuadraZone, Salmo 133:1 (Reina-Valera 1960): «¡Mirad cuán bueno y cuán delicioso es Habitar los hermanos juntos en armonía!», con referencia y enlace a la fuente. Se conserva el logo dorado con carrito blanco y la plataforma blanca. La conexión con el crecimiento de emprendimientos se expresa como misión propia en el inicio, separada de la cita; no se añade al texto bíblico ni se presenta como garantía económica.

### Contraste visual vigente — 7 de octubre, 22:59

El usuario pidió que la página no sea blanca en todas partes: mantener superficies blancas y alternarlas con aguamarina pálido y gris suave, usando cabecera azul marino oscura con texto blanco. Hero, destacados, confianza, invitaciones y pie se diferencian mediante bandas de fondo. El logo dorado, carrito blanco con cuatro emblemas y Salmo 133:1 bajo el logo se conservan.

### Cuota y referencia visibles vigentes — 7 de octubre, 23:49

Cuota mensual de vendedores USD 19.99 (1999 centavos), sin comisión propia por venta. El comprador permanece gratuito. El importe se centraliza en shared/pricing.ts para que inicio, planes, solicitud, cuenta y revisión administrativa usen el mismo valor. No se activan cobros ni se cambian suscripciones reales. Bajo el logo se muestra únicamente «Salmo 133:1», sin «Reina-Valera 1960» en la etiqueta visible; se conservan versículo y enlace de fuente.

## 9. Implementación de etapa 3 autorizada — 7 de octubre, 23:59

El usuario solicita avanzar después de ver precios y cabecera. Se implementan catálogo real, borradores de tiendas/productos, búsqueda y detalles, deseos/carrito persistentes, pedidos multivendedor, inventario transaccional, reseñas de compra real, preguntas y mensajería con notificaciones internas. Se conserva todo el diseño aprobado y la cuota USD 19.99; comprador gratuito.

- Módulos de catálogo en `shared/marketplace.ts`, `drizzle/catalog-schema.ts`, `server/services/catalog.ts`, `server/routers/catalog.ts`; tiendas por propietario, productos/libros con variantes, precios en centavos, imágenes públicas y stock. Los borradores pueden prepararse con perfil y solicitud propios; publicar/ver/vender en catálogo real requiere aprobación y suscripción activa. No hay bypass por entorno ni promoción de roles.
- Módulos de compra en `shared/commerce.ts`, `drizzle/commerce-schema.ts`, `server/services/commerce.ts`, `server/routers/commerce.ts`; comprador autenticado gratuito, carrito/deseos privados, pedidos por vendedor con entrega y totales calculados en servidor, transición de estados y restitución de stock al cancelar una sola vez. Idempotencia y bloqueo transaccional evitan compras repetidas o sobreventa. Los pagos se registran como pendientes/directos al vendedor, nunca como cobro electrónico confirmado.
- Esquemas separados con migraciones aditivas; no modificar documentos privados ni identidades. Sin semillas que creen personas, vendedores verificados o suscripciones pagadas. Las publicaciones ilustrativas existentes conservan etiqueta de demostración y no generan pedidos reales; el catálogo real puede estar vacío mientras faltan verificación y pagos.
- UI nueva en `client/src/features/commerce/` y `client/src/features/catalog/`, con acceso desde vendedor/cuenta y rutas dedicadas para catálogo real, ficha/tienda real, carrito guardado, checkout, pedidos, deseos y mensajes. Se mantiene accesible el diseño de muestra; se distinguen sus datos de la actividad persistente.
- Contenido inicial de rutas públicas reales se sirve desde una instantánea pública de DB; solo productos publicados de tiendas activas. Ninguna dirección, contacto privado, documento ni sesión entra en esa instantánea. Páginas privadas no se indexan. Nuevas rutas se agregan al manifiesto.
- Los eventos/servicios ilustrativos siguen sin boletos QR/citas reales hasta etapa 4. Correo/SMS externos siguen pendientes por elección del usuario; notificaciones internas sí se persisten. La activación recurrente y pago electrónico pertenecen a etapa 5. Detenerse para revisión después de entregar etapa 3, sin avanzar a etapa 4.

### Etapa 3 implementada para revisión — 8 de octubre de 2026
- Catálogo público persistente en `/mercado`, artículos `/articulo/:slug` y tiendas `/tiendas/:slug`, con filtros, cursor estable, calificaciones de compras entregadas y orden por ventas reales. Las rutas `/catalogo`, `/producto/:slug`, `/carrito` y otras del diseño siguen explícitamente como ejemplos.
- Borradores de tienda/productos/libros, variantes/SKU e inventario con revisión optimista; fotos públicas vinculadas a producto y propietario. Guardar el borrador antes de subir fotos evita fotos sin propietario y conflictos de revisión.
- Tarifas planas explícitas de envío y domicilio por tienda y cobertura provincial configurable. Vacío significa no configurado, cero significa oferta gratuita expresa; retiro personal es gratuito. El checkout solo ofrece una modalidad común a los artículos de cada tienda y verifica el total estimado contra el servidor.
- Carrito, deseos, checkout y pedidos privados, inventario transaccional, clave idempotente, restauración una sola vez al cancelar antes del envío; pedidos con pago directo pendiente, sin gateway ni cobro electrónico.
- Reseñas solo tras entrega, preguntas/respuestas, mensajes vinculados a pedido y notificaciones internas. DTOs públicos sin contacto/identidad; pedidos comparten rol derivado, no ID interno del comprador.
- HTML inicial con snapshot público serializado de forma segura y metadatos dinámicos. La vista previa continúa noindex intencionalmente; las rutas públicas en producción no reciben ese bloqueo, y las cuentas/errores sí. Caché privada de cuentas/pedidos.
- Migración 0003 aditiva aplicada: catorce tablas nuevas sin modificar ni eliminar los datos anteriores. Publicaciones visibles solo con aprobación, contactos verificados y suscripción activa.
- Correo/SMS y activación por pago siguen pendientes por decisión del usuario; no se simulan vendedores aprobados para probar una venta completa. La plataforma permanece en vista previa, no producción. No se inicia etapa 4 antes de revisión.

Las consultas/mutaciones privadas rechazan el acceso anónimo antes de tocar pedidos o inventario (regresiones del router). El encabezado conserva #0b203b y el precio del vendedor sigue centralizado en 1999 centavos.

### Continuación autorizada de etapa 3 — 8 de octubre, 10:36
El usuario pide avanzar con la tercera etapa, no con la cuarta. Completar colecciones públicas de novedades/más vendidos/libros en inicio a partir de DB y en HTML inicial, sin mezclar ejemplos; búsqueda por tienda y metadata de libros; elegibilidad de reseñas consultada por producto sin depender de los últimos 100 pedidos y con estado de reseña previa; total de checkout obligatorio coincidente con servidor y rechazar entregas duplicadas desde el contrato; respetar límite de historial solicitado y enlaces útiles de notificación de preguntas. No se habilitan correo/SMS, cuotas/cobros reales, tiendas no verificadas ni datos de clientes ficticios. No hay nuevas tablas ni migraciones necesarias.

Cierre implementado: además de las colecciones y elegibilidad previstas, las ediciones de publicaciones activas se validan dentro de la transacción antes de guardar y los deseos reflejan su estado en tarjeta. Más vendidos de inicio exige al menos una unidad entregada. Se mantiene el tono existente #071f3b (no se reemplaza la cabecera). No se cambian esquemas/DB ni se crean clientes de prueba. Se entrega el recorrido en `docs/etapa-3-revision.md`.

## Categorías del negocio y directorio — 8 de octubre, 10:59
Petición: durante el registro vendedor escoger categorías para registrar el negocio bajo ellas y encontrar sus tiendas por categoría. Fuente literal `docs/categorias-negocios-originales.md`: 11 categorías, 96 especialidades, sin sustituir categorías de productos. Se pueden escoger varias categorías y opcionalmente varias especialidades dentro de cada categoría; requieren al menos una categoría antes de guardar solicitud. Contrato central `shared/businessCategories.ts` con IDs estables y etiquetas literales. Persistir selecciones en JSON `czApplications.details.businessCategories` ya existente, con validación de pertenencia/duplicados del servidor, DTO normalizado para solicitudes anteriores, guardas de revisión/propiedad sin cambios. Directorio público `/tiendas`: filtros categoría/especialidad/provincia y texto de negocio/especialidades; resultados tarjetas de tienda, no artículos, paginación estable; lista solo vendedores aprobados/activos con contactos verificados, sin crear tiendas ficticias. Consultas SQL proyectan únicamente datos públicos; no devolver details completa, identidad, teléfono, correo ni documentos. SSR de directorio y etiquetas de tienda pública; enlaces desde cabecera y búsqueda, vista de categorías accesible sin sesión. Permitir preparar borrador sin activar tienda ni pagar. No nuevas tablas ni migraciones necesarias porque JSON details ya existe.

Implementación de categorías conectada: `shared/storeDirectory.ts` establece filtros/DTO exclusivamente público; `server/services/storeDirectory.ts` usa JSON_CONTAINS parametrizado en clasificación con guardas de aprobación/suscripción/contactos vigentes y paginación descendente por ID. `BusinessCategoryPicker` guarda selecciones en expediente, revisión y estado del vendedor; `StoreDirectoryPage`/`StoreSearchMatches` muestran tiendas filtradas en directorio y búsqueda general. Se hidrata HTML inicial con proyección exclusiva de categorías, no detalles del expediente. Solicitudes antiguas no reciben categorías ficticias. Error de categoría se muestra bajo su selector; formulario normaliza campos al guardar para evitar falsos cambios pendientes.

## Dos planes de vendedor — implementación autorizada 10 de octubre

Catálogo central en `shared/pricing.ts`: Normal (`normal`, 1999 centavos/mes) y Mayor Visibilidad (`mayor_visibilidad`, 3999 centavos/mes), ambos disponibles como opciones; el segundo no elimina ni modifica el Normal y cada tienda elige uno. Mostrar comprador gratis por separado, cero comisión propia, condiciones de futuro destaque rotativo/patrocinado e identidad institucional sujeta a acreditación y licencia. Conservar cabecera azul marino, logo, versículo y categorías.

Persistir únicamente la preferencia explícita del propietario en una tabla aditiva de selección, con revisión optimista y auditoría. Endpoint protegido con cabecera anti-CSRF; entradas estrictas y precio derivado del catálogo servidor. Página pública `/suscripciones` y gestión privada `/vendedor/plan` con selección, confirmación y estado guardado; consulta en cuenta, solicitud, estado vendedor y revisión administrativa. Leer un parámetro URL no guarda ni cobra automáticamente. No migrar vendedores existentes, ni cambiar `subscriptionStatus`, verificación o prioridad por elegir/pagar un precio. No activar gateway aún pendiente en Panamá. La suscripción cobrada y la autorización de destaque/emblemas requerirán proveedor, eventos verificados y licencia; esa parte queda abierta, no se presenta como cobro real implementado. Tests sin insertar personas ni suscripciones ficticias en la base compartida.
