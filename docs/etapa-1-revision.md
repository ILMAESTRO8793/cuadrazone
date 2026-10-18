# Etapa 1 — Evidencia de revisión

## Alcance entregado

Vista previa responsive blanca con logo dorado, navegación, búsqueda/autocompletado y catálogo de cinco publicaciones ficticias de los cuatro tipos, detalles, tienda, cuenta de comprador gratuita, plan vendedor USD 10.00/mes, entrada a vendedores, carrito/favoritos locales, selecciones ilustrativas de eventos/servicios, estructuras de paneles y borradores legales. No hay autenticación del producto, solicitudes/documentos reales, pedidos, reservas, QR ni cobros activos. Las etapas 2–7 siguen pendientes.

## Comprobaciones

- `pnpm check`: sin errores TypeScript.
- `pnpm test`: 12 pruebas correctas, incluyendo contenido HTML inicial, rutas, cuota de comprador eliminada, precio vendedor y persistencia de filtros en la query.
- `pnpm build`: compilación de frontend y servidor correcta. Aviso de tamaño del bundle; optimización adicional prevista en calidad/rendimiento de la etapa 7.
- Respuestas públicas verificadas: inicio, libros, ficha de producto y página de cuentas; contenido inicial real sin ejecutar JavaScript. Publicación no realizada. Preview con `noindex` intencional por datos de demostración.
- Rutas desconocidas y documentos legales desconocidos: HTTP 404.
- `GET /manus-routes.json`: HTTP 200, JSON con las 20 rutas del código.
- Revisión visual de escritorio y celular; corregida la tarjeta de vendedores que estrechaba el texto en móvil.
- Logo de plataforma/social verificado por SHA-256: la URL CDN coincide exactamente con el PNG dorado optimizado; no es el logo blanco hueso anterior.

## Revisión independiente y correcciones

Un agente de solo lectura trazó requisitos y conexiones. Se corrigieron pérdida de filtros al buscar/volver, cambio involuntario de provincia global, falta de etiquetas visibles de ejemplo en ratings/tags, documento legal inexistente con estado 200, riesgo de textos largos en carrito móvil y universos de búsqueda distintos entre autocompletado y catálogo. Los filtros/orden se conservan en la URL; su cambio no modifica la preferencia de provincia. Se mantienen paneles y datos de usuario como vistas previas, sin autenticación simulada.

## Regla vigente de compradores

Sin cuota mensual y sin suscripción de pago para comprar. Los compradores pagan solo el precio de sus transacciones y cargos que correspondan. Vendedores: USD 10.00/mes, sin comisión propia de CuadraZone.

## Próximo paso

Esperar revisión del usuario sobre esta etapa. Solo después, avanzar a registro, roles y verificación de la etapa 2.
