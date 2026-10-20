# CuadraZone — Resultados de construcción

Se usa este registro porque no hay una herramienta nativa de ToDo disponible en la sesión. `[ ]` pendiente, `[x]` entregado. Construcción por etapas; mostrar cada etapa y esperar revisión antes de avanzar a la siguiente. Fuente: `docs/requisitos-originales.md`, `plan.md` y cambios vigentes de `docs/decisiones.md`. Dirección visual revisada por el usuario: **logo dorado y plataforma blanca**.

- [x] **Etapa 1: diseño visual y estructura.** Usar el logo aprobado conservando su letra y carrito pequeño orientado a la izquierda, arriba a la derecha de la última e; recolorear texto y contorno a dorado y conservar los cuatro emblemas rojo/dorado/azul/púrpura. Sitio blanco, moderno, limpio, mobile-first, responsive, español, USD, Panamá. Vista previa navegable de inicio con banners/categorías/destacados/más vendidos/novedades; catálogo de ejemplo de los cuatro tipos; ficha de producto; tienda pública; cuenta de comprador gratuita sin cuota mensual y vendedor USD 19.99/mes sin comisión propia; entrada a vendedores; estructura de páginas comprador/vendedor/admin. Datos y estados ilustrativos identificados como demostración, sin atribuir verificación o pagos reales. Mostrar etapa antes de seguir.
- [ ] **Etapa 2: registro, usuarios y permisos.** Visitante navega/busca/ve productos sin registro; comprador con cuenta gratuita sin cuota mensual ni suscripción de pago compra/reserva/adquiere boletos; vendedor USD 19.99/mes sin comisión de venta CuadraZone; administrador aprueba/modera/reclamos/reportes. Autenticación real segura, roles y permisos verificados en servidor; no simular usuarios autenticados ni usar credenciales administrativas públicas.
- [ ] **Etapa 2: verificación completa de vendedores.** Datos personales/empresa, teléfono y correo verificados; cédula panameña o carné residente vigente cargado; residencia Panamá; denominación de lista cerrada editable por admin, inicialmente Iglesia Cuadrangular, Iglesia de Dios, Asambleas de Dios; iglesia local, ciudad y pastor; carta pastoral firmada PDF/imagen; aceptación fe y conducta. Solicitud → Pendiente → admin aprueba/rechaza con motivo → aprobado paga primera mensualidad y activa tienda; impago oculta tienda hasta regularizar. Documentos protegidos, no públicos sin cifrado/control de acceso. Mostrar etapa antes de seguir.
- [x] **Etapa 3: publicaciones físicas y libros.** Formularios propios. Productos de todas las categorías generales hogar/ropa/tecnología/alimentos/belleza/artesanías/etc. con variantes talla/color, inventario, múltiples fotos y precio. Libros cristianos destacados con autor/editorial/ISBN/idioma/formato/nuevo-usado. Persistencia y permisos por vendedor.
- [x] **Etapa 3: descubrimiento y detalles.** Inicio con banners/categorías/destacados/más vendidos/novedades; búsqueda potente con autocompletado; filtros categoría/precio/provincia/calificación/tipo. Producto con galería/descripción/precio/vendedor/reseñas/preguntas-respuestas/relacionados. Tienda pública con perfil, insignia de Vendedor verificado cuando corresponda, iglesia y calificación.
- [x] **Etapa 3: carrito y pedidos.** Carrito multivendedor, deseos y checkout; seguimiento Pendiente/Confirmado/Enviado/Entregado/Cancelado. Entrega por provincia: envío vendedor, retiro personal o domicilio. Inventario consistente y registro de pagos sin confirmar cobros por una simple navegación a éxito.
- [ ] **Etapa 3: confianza y comunicación.** Reseñas 1–5 estrellas solo de compradores que realmente compraron; mensajería comprador-vendedor; notificaciones por correo con proveedor real y WhatsApp si es posible. Mostrar etapa antes de seguir.
- [ ] **Etapa 4: boletos y QR.** Evento nombre/artista/fecha/hora/lugar/mapa/tipos General-VIP-otros/precio/capacidad; boleto digital QR único por correo y cuenta; escáner de organizador autorizado valida sin doble uso; aforo en tiempo real. Capacidad y consumos QR consistentes en servidor.
- [ ] **Etapa 4: servicios y citas.** Abogacía/contabilidad/salud/educación/construcción/plomería/electricidad/belleza/eventos/tecnología/transporte/cualquier servicio-empresa; solicitar cotización o reservar cita con disponibilidad del vendedor, sin solapamientos. Mostrar etapa antes de seguir.
- [ ] **Etapa 5: suscripciones recurrentes.** Únicamente vendedor: Normal USD 19.99/mes y Mayor Visibilidad USD 39.99/mes como planes coexistentes; cobro automático mensual, recordatorios y bloqueo/ocultación de tienda por falta de pago hasta regularizar. Comprador gratuito sin cuota mensual ni bloqueo por suscripción. Persistir derechos/identidad y deduplicar webhooks; no guardar tarjetas/códigos de seguridad.
- [ ] **Etapa 5: compras y pagos Panamá.** Gateway disponible Panamá (Yappy/PagueloFácil/Tilopay como ejemplos) más PayPal; confirmar viabilidad/documentación/cuentas antes de implementar. Si liquidación directa no es viable primera versión, pago directo vendedor por Yappy/transferencia/contra entrega registrado en pedido. Mostrar tarifas de pasarela, cero comisión CuadraZone, ITBMS cuando aplique. Pruebas separadas de cobros reales. Mostrar etapa antes de seguir.
- [ ] **Etapa 6: panel vendedor.** Publicaciones/inventario/pedidos/eventos/boletos vendidos/citas/mensajes/reseñas/suscripción/reportes de ventas, con permisos por propietario.
- [ ] **Etapa 6: panel administrador.** Cola de aprobaciones con visor protegido de documentos; editar denominaciones/categorías/banners; moderar publicaciones/reseñas; suspender vendedores; reclamos comprador → vendedor tiene 48 horas → admin decide; reportes usuarios activos/suscripciones/ingresos mensuales/ventas por categoría. Mostrar etapa antes de seguir.
- [ ] **Legal: borradores para abogado.** Términos/condiciones, privacidad considerando Ley 81 de 2019 Panamá, conducta vendedor, reclamos/devoluciones y declaración de fe. Etiquetar como borradores, no certificación legal.
- [ ] **Etapa 7: calidad y entrega.** Stack moderno/seguro/escalable justificado; protección de documentos; SEO con contenido HTML público significativo, rendimiento móvil y responsive; pruebas y correcciones; despliegue de versión aprobada; URL de prueba/publicación confirmada, acceso administrador real y documentación de administración. No declarar producción lista con integraciones críticas pendientes.
- [x] **Revisión independiente de la implementación compleja.** Un agente de solo lectura comprobará las partes implementadas de la etapa frente a plan/requisitos y cómo se conectan; se corregirán problemas confirmados. Las funciones de etapas posteriores se mantienen explícitamente pendientes.
- [ ] **Respeto del flujo de trabajo.** Mostrar cada una de las siete etapas antes de avanzar. Avisar antes de implementar si un requisito no es técnicamente viable o existe una alternativa mejor. No activar cobros reales ni solicitar documentos personales durante la primera vista previa de diseño.

## Estado de entrega

Etapa 1 aprobada; registro y revisión de etapa 2 implementados con correo/SMS y administración real pendientes; etapa 3 implementada y en revisión de su continuación autorizada. Evidencia: `docs/etapa-1-revision.md`. Las 12 pruebas, tipos y compilación pasan. El comprador no paga mensualidad.

- [ ] **Revisión independiente de la etapa 2.** Revisar registro real, permisos por propietario/administrador, solicitud completa, documentos privados, transiciones y ausencia de verificación simulada; mantener pendientes las condiciones de correo/SMS hasta conectar proveedores autorizados.

## Avance de etapa 2 — revisión actual

Implementados el registro real, perfil, solicitud, almacenamiento privado, revisión por roles y denominaciones. La verificación real de contactos sigue pendiente por decisión del usuario, por lo que el resultado integral de etapa 2 permanece abierto. También falta elegir la identidad administrativa y probar el recorrido con la cuenta real del operador. Etapa 3 autorizada el 7 de octubre a las 23:59, sin dar por resueltas las verificaciones pendientes. Marca vigente: carrito blanco pequeño con cuatro emblemas dentro, nombre dorado y plataforma blanca. Revisión independiente realizada y hallazgos corregidos, con 25 pruebas correctas.

- [x] **Versículo bajo el logo:** Salmo 133:1, Reina-Valera 1960, texto íntegro sobre hermanos juntos en armonía, con referencia y fuente; directamente bajo el logo de la cabecera, adaptable a escritorio y móvil, sin alterar la imagen dorada/carrito blanco. La frase de apoyo a emprendimientos se distingue de la cita bíblica.

- [x] **Contraste visual solicitado:** cabecera azul marino oscura con texto/iconos blancos, manteniendo el logo dorado, carrito blanco y versículo debajo. No usar blanco en toda la página: alternar hero/contenido/secciones con aguamarina pálido o gris suave y mantener tarjetas/formularios blancos. Buscador, resultados, selector de provincias y menú deben conservar texto legible y estados activos visibles en escritorio y móvil.

- [x] **Cuota y cita revisadas:** cambiar todos los precios visibles de vendedores de USD 10.00 a USD 19.99/mes, conservar comprador gratuito y cero comisión propia, sin activar cobros. Quitar «Reina-Valera 1960» del texto visible bajo el logo; mostrar «Salmo 133:1» y mantener el versículo.

- [x] **Etapa 3 autorizada: integración y revisión.** Conectar catálogo, borradores, carrito/deseos, checkout/pedidos, reseñas/preguntas y mensajería persistentes a las pantallas y permisos reales; respetar catálogo público solo de vendedores aprobados/activos; ejemplos separados sin pedidos reales; actualizar manifiesto y HTML público; mostrar resultado y pendientes antes de etapa 4. Revisión independiente de solo lectura y correcciones confirmadas.

## Evidencia de la revisión de etapa 3
- Implementación persistente de catálogo/carrito/pedidos/deseos y módulos de comunicación guardada para revisión. La función de correo/WhatsApp no se marca completa: proveedores pendientes.
- Migración 0003 aditiva aplicada; tipos y compilación pasan; 56 pruebas en 10 archivos pasan. Revisados HTTP 200/404, snapshot/escape, manifiesto completo de 37 rutas y cabeceras privadas.
- Una revisión independiente de solo lectura confirmó metadatos multilinea y minimización de IDs; corregidos. `noindex` se limita a Preview, cuentas y errores; no bloquea páginas públicas de producción.
- No se ha probado una venta de extremo a extremo con un vendedor real: no se aprobarán perfiles incompletos ni se activarán suscripciones artificialmente. Pagos, correo y SMS permanecen pendientes; entrega de etapas 4–7 aún no implementada.

## Cierre de etapa 3 autorizado — 8 de octubre, 10:36
- [x] **Colecciones reales de inicio:** novedades, más vendidos y libros cristianos a partir de publicaciones de tiendas aprobadas/activas; HTML inicial con estado de carga/error/vacío veraz; no presentar ejemplos como ventas reales. Buscar también por tienda, autor/ISBN/editorial.
- [x] **Reseña elegible por producto:** consultar compra entregada real sin truncar a los últimos 100 pedidos; no permitir reseñas de tienda propia o duplicadas; mostrar la reseña ya publicada y no devolver IDs de usuario al otro participante.
- [x] **Confirmación de checkout y comunicación:** total esperado obligatorio validado en centavos contra servidor; modalidades repetidas rechazadas por contrato; historial respeta límite; notificaciones de preguntas enlazan a la ficha pública sin exponer datos privados.

### Evidencia del cierre de etapa 3
Colecciones públicas de inicio conectadas a DB/HTML inicial y distinción de ventas entregadas; búsqueda por tienda/autor/editorial/ISBN; deseos con estado visible; reseñas consultadas por artículo y con reseña propia previa; total confirmado requerido y replay coherente; integridad de publicaciones editadas y enlaces de preguntas. Tipos, 64 pruebas y compilación pasan en esta revisión. Evidencia operativa en `docs/etapa-3-revision.md`. Las condiciones de correo/SMS y pagos permanecen abiertas y no se prueban con identidades simuladas.

Revisión independiente del cierre realizada: el fallo confirmado del estado SSR de colecciones se corrigió y se verificó con regresión. 35 pruebas de módulos afectados y compilación vuelven a pasar tras esa corrección.

## Clasificación de negocios y búsqueda de tiendas — 8 de octubre
- [x] **Registro por categorías:** las 11 categorías y 96 especialidades adjuntas se conservan literalmente; vendedor elige una o más categorías y especialidades asociadas; guardar/reabrir conserva selección; servidor rechaza IDs desconocidos, repetidos y especialidades de otro grupo; nuevas solicitudes requieren categoría. No cambia requisitos de fe/residencia/documentos/contactos ni plan USD 19.99.
- [x] **Encontrar tiendas por su categoría:** directorio público `/tiendas` busca negocios por nombre/categoría/especialidad y provincia; navegar por categorías muestra tiendas bajo esa clasificación; filtros quedan en URL, paginación no omite/duplica, errores y vacíos son veraces, tiendas sin publicaciones también pueden encontrarse si están activas. Solo solicitudes aprobadas/plan activo/contactos verificados son públicas; sin datos privados ni tiendas inventadas. Categorías de producto siguen separadas.
- [x] **Integración y revisión:** clasificación visible en revisión administrativa y tienda pública; acceso desde navegación y búsqueda; directorio con HTML inicial y metadatos, manifiesto sincronizado y revisión independiente de alcance. Guardar versión sin publicar ni activar pagos/correo/SMS.

Evidencia de clasificación de negocios: 78 pruebas/12 archivos, tipos y compilación pasan; consultas reales `/api/trpc/catalog.stores` (categoría/especialidad y texto) y `catalog.storeSuggest` HTTP 200 sin tiendas ficticias; 38 rutas coherentes con manifiesto; revisión independiente sin fallos runtime nuevos. El defecto de tipado en prueba detectado durante revisión ya se corrigió pasando `children` explícito y volvió a comprobarse. No se modificó DB ni se cambió la activación de tiendas, contactos o pagos.

## Dos planes — 10 de octubre
- [x] **Oferta coexistente:** Normal US$19.99/mes y Mayor Visibilidad US$39.99/mes visibles en `/suscripciones`, comprador gratuito separado, cada tienda elige uno sin sumar ni eliminar Normal, 0% comisión propia. Conservar azul marino/logo/versículo. Beneficios aún pendientes etiquetados, destaque rotativo/patrocinado sin garantizar ventas o primer lugar permanente; cuatro emblemas solo con acreditación y autorización institucional, no por seleccionar precio.
- [x] **Selección persistente y privada:** `/vendedor/plan` permite escoger/confirmar/guardar un único plan con sesión real; datos estrictos, precio validado en servidor, revisión optimista, auditoría y solo recursos propios. URL no produce cobro o guardado automático. Mostrar preferencia en cuenta, solicitud, vendedor y revisión administrativa; preservar categorías/documentos/permisos. Migración aditiva sin activar pagos ni cambiar tiendas existentes.
- [ ] **Cobro y beneficios activos:** pendiente proveedor para Panamá, webhooks, renovaciones/cancelaciones, derechos de pago verificados, reglas de cambios y acreditación/emblemas con licencia. No tratar selección como pago o prioridad activa ni probar con cuentas artificiales.

Evidencia de planes: migración aditiva 0004 aplicada, 39 rutas sincronizadas, precios US$19.99/US$39.99 comprobados en HTML público, plan privado HTTP 401 sin sesión y Cache-Control private/no-store. Tipos, suite de 93 pruebas y compilación pasan. Revisión independiente confirmó conexión y permisos; historial administrativo incorpora los cambios de plan del mismo usuario aunque precedan a la solicitud. Facturación y beneficios activos permanecen pendientes.

## Salida de Manus — 17 de octubre
- [x] Login con Google y sesiones propias; rol de administrador por `ADMIN_EMAILS`.
- [x] Fotos en almacenamiento propio (`/media/catalog/`); documentos privados sin cambios.
- [x] Migraciones automáticas al arrancar; probado con MySQL real (22 tablas, reinicio sin duplicar).
- [x] Eliminados los módulos, plugins y referencias de Manus; 98 pruebas, tipos y compilación pasan.
- [x] Preparados `Dockerfile`, `railway.json`, `.env.example` y `docs/despliegue-railway.md`.
- [ ] Desplegar en Railway y probar el inicio de sesión con una cuenta real de Google.
- [ ] Reemplazar las imágenes de demostración por las originales.

## Cierre de la etapa 2 — 18 de octubre
- [x] Correo verificado con la cuenta de Google (automático al guardar o con botón).
- [x] Teléfono verificado por un administrador con nota e historial; también se puede revocar mientras está pendiente.
- [x] Envío permitido con teléfono pendiente; aprobación exige ambos verificados.
- [x] Corregido: guardar la solicitud fallaba siempre («Unrecognized key: consentVersion»).
- [x] Corregido: lectura de categorías cuando la base devuelve JSON como texto.
- [x] Probado de punta a punta con el servidor compilado y MySQL: 101 pruebas automáticas.
- [ ] Probar en Railway con cuentas reales de Google cuando estén las variables configuradas.
