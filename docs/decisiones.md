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
