# Manual del administrador de CuadraZone

Para quien administra CuadraZone en el día a día. Actualizado el 11 de noviembre de 2026.

## Entrar como administrador

1. Entra a `https://www.cuadrazone.com/entrar` con una cuenta de Google cuyo correo esté en la variable `ADMIN_EMAILS` de Railway.
2. Abre `/admin`. Si ves «Acceso restringido», ese correo no está en la lista: agrégalo en Railway (Variables → `ADMIN_EMAILS`, separados por comas) y vuelve a entrar.

Arriba están las pestañas. Cada una tiene su propia dirección para guardarla en favoritos.

| Pestaña | Dirección | Para qué |
|---|---|---|
| Solicitudes | `/admin` | Aprobar o rechazar vendedores |
| Suscripciones | `/admin/suscripciones` | Registrar mensualidades y comisiones |
| Denominaciones | `/admin/denominaciones` | Lista de iglesias del formulario |
| Reclamos | `/admin/reclamos` | Decidir problemas con pedidos |
| Moderación | `/admin/moderacion` | Ocultar publicaciones y reseñas, suspender tiendas |
| Reportes | `/admin/reportes` | Números del negocio |
| Portada | `/admin/portada` | Banners del inicio y categorías de productos |

## Solicitudes de vendedor

1. En la cola, elige una solicitud **Pendiente**.
2. Revisa los datos y abre los **Documentos privados** (cédula o carné y carta pastoral). Solo tú y el vendedor pueden verlos.
3. **Teléfono:** si el vendedor no lo pudo verificar con el código, confírmalo tú (por ejemplo, por WhatsApp) en «Verificación del teléfono» y escribe cómo lo hiciste. Queda en el historial con tu nombre.
4. Marca «He revisado la identificación vigente y la carta pastoral firmada» y aprueba, o rechaza escribiendo el motivo. El vendedor recibe un correo.

Al aprobar, la tienda empieza su prueba gratis de 3 meses.

## Mensualidades y comisiones

En **Suscripciones**:

- Elige el vendedor y usa **Registrar pago de mensualidad** cuando te pague (Yappy, transferencia, efectivo). Escribe la referencia y la fecha. El período se extiende solo.
- **Comisiones por venta:** muestra lo que cada vendedor debe del mes (8 % en la prueba gratis, 5 % después), incluidos los boletos. Regístralas cuando las pague.
- Si un vendedor no paga, su tienda se oculta sola al vencer el período y vuelve al registrar el pago.
- **Desactivar antes de tiempo:** para terminar una suscripción a pedido del vendedor.

## Reclamos

1. El comprador abre un reclamo desde su pedido. El vendedor tiene **48 horas** para responder.
2. Puedes decidir cuando el vendedor responde o cuando se le vence el plazo: a favor del comprador, a favor del vendedor o acuerdo. Escribe una nota: la reciben los dos.
3. El dinero lo cobró el vendedor, así que si decides a favor del comprador el vendedor debe devolverlo o reponer el artículo. Si no cumple, suspéndelo en Moderación.

## Moderación

- **Publicaciones:** busca un producto, servicio o evento y ocúltalo con un motivo. El vendedor recibe un correo y no puede volver a publicarlo hasta que tú lo permitas.
- **Reseñas:** oculta las ofensivas o falsas. Dejan de verse y no cuentan en el promedio.
- **Suspender un vendedor:** oculta toda su tienda. Aunque pague, sigue suspendida hasta que tú levantes la suspensión.

## Portada

- **Banners:** «Nuevo banner», con título, foto horizontal (por ejemplo 1600 × 600), enlace y fechas opcionales. Marca «Mostrar en la portada». Se ven hasta 6 a la vez, en el orden que indiques. Para quitarlo un tiempo usa «Ocultar»; «Borrar» no se puede deshacer.
- **Categorías de productos:** agrega, renombra (los productos se mueven al nombre nuevo), cambia el orden u oculta. Ocultar no afecta a los productos que ya la tienen.

## Denominaciones

Lista cerrada de denominaciones del formulario de vendedor. Puedes agregar nuevas o desactivar una para que no aparezca en solicitudes nuevas.

## Respaldo de la base de datos

En `/admin`, **Descargar respaldo de la base de datos** baja un archivo `.sql` con todo, incluidos datos personales y documentos de verificación. Hazlo al menos una vez por semana y guárdalo en un lugar privado (no en un correo ni en una carpeta compartida).

## Si algo falla

1. `https://www.cuadrazone.com/api/health` debe responder `{"status":"ok"}`.
2. En Railway, abre el servicio → **Deployments** → el último → **Deploy Logs**, y busca líneas con «Error».
3. Si un despliegue nuevo rompió algo, en Railway usa **Rollback** sobre el despliegue anterior que funcionaba.
4. Variables y pasos de configuración: `docs/despliegue-railway.md`.
