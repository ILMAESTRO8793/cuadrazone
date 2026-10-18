# CuadraZone — Revisión de la etapa 2

**Fecha:** 7 de octubre de 2026. **Estado:** implementación preparada para revisión del operador. No se ha avanzado a la etapa 3 ni publicado una versión de producción.

## Resultado implementado

El acceso utiliza OAuth real de Manus y sesiones firmadas vinculadas al proyecto, con permisos consultados en servidor y cierre de sesión. El comprador conserva una cuenta gratuita con perfil persistente. Cambiar correo o teléfono invalida su verificación; los contactos quedan bloqueados durante una solicitud pendiente o aprobada. No se han creado usuarios autenticados ficticios ni contraseñas administrativas compartidas.

La solicitud de vendedor de persona natural o empresa contiene identificación, residencia en Panamá, vigencia del carné, provincia, ciudad, denominación de lista cerrada, iglesia, pastor y aceptación de los borradores de fe, conducta y privacidad. Los estados son borrador, pendiente, aprobado y rechazado con motivo. Aprobar no activa una tienda: la primera mensualidad de **USD 10.00**, sin comisión propia de ventas, corresponde a la etapa de pagos.

Los borradores tienen revisión optimista y rechazan versiones obsoletas. El envío se bloquea con cambios sin guardar. El consentimiento se vincula a la versión declarada por el cliente, se persiste y audita; una versión anterior no permite envío ni aprobación y requiere nueva aceptación en el formulario.

La identificación y carta pastoral se guardan privadamente en la base de datos, no en un enlace público de almacenamiento. Solo el propietario o un administrador autenticado puede acceder. Se admiten PDF, PNG, JPEG y WEBP de hasta 5 MiB, con validación de MIME y firma binaria, visor y descarga autorizados. El reemplazo actualiza el puntero y la revisión de forma consistente. Las respuestas privadas no se almacenan en caché.

La administración incluye cola protegida, visor de documentos, aprobación/rechazo con motivo, historial y denominaciones editables/reactivables. Las tres iniciales se cargaron idempotentemente. El logo nuevo está en cabecera, pie y marca del proyecto: palabra dorada y carrito de compras blanco, pequeño, con contorno dorado fino y los cuatro emblemas dentro (paloma dorada, cruz roja, copa azul y corona púrpura). El carrito mira hacia la izquierda y queda arriba a la derecha de la última e. Se mantiene la plataforma blanca y se elimina el símbolo de cruz principal.

## Pendientes y límites

| Pendiente | Consecuencia actual |
| --- | --- |
| Correo y SMS, diferidos explícitamente por el operador | No hay PIN simulados ni contactos declarados verificados. Una solicitud incompleta no se envía ni aprueba. |
| Identidad administrativa concreta y autorización de su rol | No se asigna administrador al primer visitante. El panel no está abierto al público. |
| Prueba con la cuenta real del usuario | No se ha ejecutado el recorrido OAuth completo ni enviado una solicitud real. La siguiente revisión requiere iniciar sesión. |
| Revisión jurídica/pastoral de los textos | Son borradores, no certificación legal. En la vista previa deben utilizarse archivos de prueba sin datos sensibles. |
| Endurecimiento antes del lanzamiento | Se revisarán retención, tratamiento de datos sensibles, protección operativa y rendimiento en la etapa final. |
| Etapas 3–7 | Catálogo persistente, pedidos, QR, citas, cobros, paneles comerciales completos y despliegue final siguen pendientes. El catálogo actual está etiquetado como demostración. |

## Evidencia de comprobación

| Comprobación | Resultado |
| --- | --- |
| `pnpm check`, incluyendo los tests | Correcto |
| `pnpm test` | **25 pruebas correctas** en cinco archivos |
| `pnpm build` | Correcto; la configuración pública permanece como script de runtime. Optimización de tamaño pendiente para la etapa de rendimiento. |
| `pnpm exec drizzle-kit check` | Correcto |
| Migraciones 0001/0002 | Aplicadas aditivamente, sin borrar tablas ni datos. Se corrigieron dos nombres de claves foráneas que excedían el límite de MySQL. |
| HTTP público | Health, manifiesto, denominaciones y configuración: 200. Membresía/documentos sin sesión: 401. Administración sin privilegio: 403. |
| Composición visual | Revisadas escritorio y móvil; el acceso de cuenta móvil está visible y no desborda la cabecera. |
| Revisión independiente de solo lectura | Corregidos los hallazgos de consentimiento, control de versión y recompilación de caché privada. |

**Una vista previa y un checkpoint no equivalen a publicación ni certificación de producción.**
