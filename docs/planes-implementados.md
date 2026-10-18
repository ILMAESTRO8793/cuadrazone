# Planes de CuadraZone — implementación del 10 de octubre de 2026

## Oferta y alcance

- **Normal:** US$19.99/mes (1999 centavos).
- **Mayor Visibilidad:** US$39.99/mes (3999 centavos).
- Ambos planes coexisten; una tienda selecciona uno. No se eliminó el Normal ni se suman ambas mensualidades.
- Comprador gratuito, sin cuota mensual. CuadraZone mantiene cero comisión propia por venta.
- Se conservan logo, cabecera azul marino, Salmo 133:1, categorías y especialidades.

## Funciones implementadas

`/suscripciones` muestra la comparación, comprador gratuito separado, beneficios y condiciones. Los botones abren `/vendedor/plan?plan=normal` o `?plan=mayor_visibilidad`. El parámetro preselecciona la opción visual, pero no guarda ni cobra.

`/vendedor/plan` exige sesión real; carga la preferencia de la cuenta, permite seleccionar y confirmar explícitamente que no se trata de pago ni contratación. Después de guardar, la preferencia se conserva en MySQL. Una selección inicial usa revisión 0; cambios requieren la revisión leída. Ante conflicto, se cierra la confirmación y se vuelve a cargar antes de revisar una nueva acción.

La cuenta, solicitud, estado del vendedor y expediente administrativo muestran la preferencia. La solicitud abre la selección en otra pestaña para conservar los cambios del formulario de categorías y documentos. El retorno OAuth admite exclusivamente las rutas internas explícitas de planes; conserva la protección por nonce y rechaza URLs externas.

## Implementación y seguridad

- `shared/pricing.ts`: catálogo único de planes, precios en centavos, etiquetas, versión y validador estricto. Las constantes heredadas representan siempre el Normal.
- `drizzle/schema.ts`: tabla aditiva `cz_plan_selections`, con una selección única por usuario y FK a usuario existente. Migración `0004_legal_starfox.sql` aplicada sin borrar ni modificar tablas anteriores.
- `server/services/sellerPlans.ts`: consulta propia, transacción con bloqueo del propietario, control de revisión, precio derivado del servidor y auditoría `plan_selected`. Errores internos de DB redactados.
- `server/routers/membership.ts`: `membership.plan.get` y `membership.plan.select`; sesión real, exclusión de tareas y cabecera anti-CSRF `x-cz-request: 1`.
- `server/services/membership.ts`: preferencia en consultas privadas; historial administrativo incluye únicamente los cambios de plan del propietario correspondiente, incluso los anteriores a su solicitud.
- La ruta privada no se indexa y lleva `Cache-Control: private, no-store`; manifiesto de 39 rutas sincronizado.
- No se aceptan precio, userId, estado de suscripción ni emblemas suministrados por el cliente.

## Pendientes, sin simular

La preferencia **no cambia `subscriptionStatus`, la activación de tienda, verificación de contactos, clasificación ni orden de búsqueda**. No hay cobros recurrentes activos, webhooks o suscripciones pagadas creadas por esta actualización.

Para activar facturación y beneficios: seleccionar/habilitar proveedor disponible para el operador en Panamá, configurar credenciales por canal protegido, crear precios de ambas opciones, persistir la suscripción efectiva separadamente de esta preferencia, verificar y deduplicar eventos, definir cambios/cancelaciones y activar derechos exclusivamente según pago confirmado. El cambio de preferencia no modifica una suscripción cobrada.

Mayor Visibilidad describe una futura prioridad en espacios destacados por categoría y rotación, identificada como ubicación de pago; no garantiza primer puesto permanente ni ventas. Los cuatro emblemas requieren acreditación real y autorización institucional, nunca una elección de precio por sí sola. Su habilitación sigue pendiente.

Correo/SMS permanecen pendientes por decisión previa del operador. Los servicios, boletos, citas y reportes no se declaran implementados por incluirlos en una oferta.

## Evidencia

Tipos TypeScript correctos, **93 pruebas en 15 archivos** y compilación de cliente/SSR/servidor correctas. Consultas HTTP públicas verificaron ambos importes y la cuenta gratuita; endpoint privado devolvió HTTP 401 sin sesión. Revisión independiente de código verificó permisos y conexión de UI/backend y señaló el historial administrativo, ya corregido. Pruebas de selección usan mocks en memoria; no se insertaron compradores, vendedores o suscripciones ficticias en la base compartida. No se realizó una compra ni cobro real.
