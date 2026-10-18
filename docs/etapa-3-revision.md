# CuadraZone — Revisión de la etapa 3

Actualización: 8 de octubre de 2026.

## Alcance implementado

- Tienda y publicaciones de productos físicos y libros guardadas en base de datos, con variantes, SKU, stock, fotos, precios y metadatos.
- Catálogo real separado del catálogo ilustrativo; búsqueda y filtros por categoría, tipo, provincia, precio y calificación.
- Inicio con novedades, libros cristianos y más vendidos provenientes de tiendas activas. «Más vendidos» exige compras entregadas; no se inventan ventas para llenar la sección.
- Lista de deseos y carrito multivendedor privados; modalidades de entrega y tarifas configuradas por el vendedor.
- Checkout con total esperado obligatorio, cálculo en centavos del servidor, control de inventario e idempotencia. Un cambio en precios o tarifas exige revisar el total antes de registrar el pedido.
- Pedidos con estados Pendiente, Confirmado, Enviado, Entregado y Cancelado; restitución del stock una sola vez al cancelar antes del envío.
- Reseñas autorizadas por compra entregada del artículo, incluso si el pedido es antiguo. No se permite reseñar artículos propios ni duplicar una reseña.
- Preguntas y respuestas con enlaces de actividad; mensajes privados entre participantes de un pedido y notificaciones internas.
- Ediciones de un artículo publicado conservan fotos, precio y metadatos requeridos; si se quiere preparar una versión incompleta, primero debe pasarse a borrador.

## Recorrido para revisar

| Área | Ruta | Condición |
| --- | --- | --- |
| Inicio | `/` | Acceso público; colecciones reales con estados de carga/error/vacío. |
| Catálogo real | `/mercado` | Solo publicaciones de vendedores aprobados, contactos verificados y plan activo. |
| Libros | `/mercado?kind=book` | Búsqueda también por autor, ISBN y editorial. |
| Más vendidos | `/mercado?sort=popular` | Orden de ventas entregadas, calificaciones y desempate estable. |
| Ficha real | `/articulo/:slug` | Galería, variantes, stock, reseñas, preguntas y relacionados. |
| Tienda real | `/tiendas/:slug` | Perfil público e iglesia; datos privados no se exponen. |
| Cuenta | `/mi-cuenta` | Login real. El comprador no paga mensualidad. |
| Preparar tienda | `/vendedor/tienda` | Perfil y solicitud del propietario; permite preparar borradores, no eludir la verificación. |
| Publicaciones | `/vendedor/productos` | Gestión propia y control de versión al editar. |
| Deseos | `/mi-lista` | Sesión real y datos propios. |
| Carrito | `/mi-carrito` | Sesión real y datos propios; agrupado por vendedor. |
| Checkout | `/comprar` | Cuenta autenticada, inventario disponible, tarifas y total confirmado. |
| Pedidos | `/pedidos` | Solo pedidos del comprador; vendedor usa `/vendedor/pedidos`. |
| Mensajes | `/mensajes` | Relación autorizada de pedido, nunca mensajes públicos. |
| Actividad | `/notificaciones` | Solo notificaciones de la cuenta autenticada. |
| Precios | `/suscripciones` | Vendedor USD 19.99/mes; comprador gratuito; sin comisión propia por venta. |

Los artículos de `/catalogo` y las fichas de demostración sirven para revisar el diseño. **No se pueden convertir en compras reales ni mezclarse con el inventario persistente.**

## Dependencias que siguen pendientes

- Correo y SMS reales: el usuario pidió dejarlos pendientes. No se consideran verificados por rellenar un campo o iniciar sesión.
- Suscripción recurrente y cobros electrónicos: etapa 5. El pago directo de un pedido se registra como pendiente, nunca como pago electrónico confirmado.
- Identidad administrativa del operador y revisión con cuentas reales autorizadas.
- Venta de extremo a extremo con vendedores reales activos: no se aprobarán solicitudes incompletas ni se simulará una suscripción pagada para fabricar evidencia.
- Boletos QR y servicios/citas: etapa 4, no implementados en esta continuación de etapa 3.

La cabecera azul marino, el logo dorado con carrito blanco y Salmo 133:1 se mantienen. La plataforma continúa como **vista previa**, no como lanzamiento de producción.

## Validación de esta continuación

Tipos y compilación correctos. La suite completa pasó 64 pruebas en 10 archivos; tras corregir el estado de error del inicio, se volvieron a ejecutar las 35 pruebas de los cuatro módulos afectados y la compilación, con éxito. La revisión independiente confirmó el alcance y detectó un estado SSR de error que se corrigió con regresión. El manifiesto conserva 37 rutas coherentes. No se realizaron compras, cobros, semillas de usuarios ni cambios de base de datos en este cierre.
