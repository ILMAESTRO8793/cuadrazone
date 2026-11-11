# Arquitectura de CuadraZone

Etapa 7 · Por qué se eligió cada pieza y cómo se protege la información. Actualizado el 11 de noviembre de 2026.

## Componentes

| Pieza | Elección | Por qué |
|---|---|---|
| Interfaz | React 19 + Vite, rutas con `wouter` | Rápida de cargar en el celular, un solo código para web y app. |
| Primera vista | Render en el servidor (`client/src/entry-server.tsx`) | Las páginas abiertas (entrar, ayuda, legales) llegan con su texto ya escrito: los buscadores las leen y se ven antes de que cargue el JavaScript. |
| Comunicación | tRPC + Zod | Cada llamada valida sus datos en el servidor con el mismo esquema que usa la pantalla; un dato mal formado no llega a la base de datos. |
| Servidor | Node.js + Express | Sencillo de operar en un solo servicio. |
| Base de datos | MySQL con Drizzle ORM | Transacciones para inventario, boletos y citas; migraciones versionadas en `drizzle/` que se aplican solas al arrancar. |
| Archivos | Disco persistente de Railway (`STORAGE_DIR=/data/storage`) | Fotos y videos públicos. Los documentos de verificación van en la base de datos, no en el disco. |
| App Android | Capacitor (`mobile/`) | Abre la web en vivo: lo que se publica se ve en la app al instante, sin volver a subirla a la tienda. |
| Alojamiento | Railway, despliegue automático al hacer push a `main` | Un solo lugar para servidor, base de datos y disco. |

**Escala:** un servicio aguanta con holgura el arranque de CuadraZone en Panamá. Si crece, el siguiente paso es pasar las fotos a un almacenamiento de objetos (S3 o R2) y correr varias copias del servidor; el código ya separa el almacenamiento en `server/storage.ts`.

## Seguridad

- **Cuenta obligatoria:** sin sesión solo se ven `/entrar`, `/ayuda` y `/legal/*` (`shared/accessGate.ts`). Las demás páginas redirigen al inicio de sesión.
- **Entrada:** Google, código por correo o código por SMS. Los códigos vencen y aceptan 5 intentos (`server/services/authCodes.ts`). La sesión va en una cookie `HttpOnly` firmada con `SESSION_SECRET`.
- **Permisos en el servidor:** cada procedimiento es público, de usuario o de administrador (`server/_core/trpc.ts`), y cada servicio comprueba que la publicación, pedido o cita pertenezca a quien la cambia. Las cuentas de administrador salen de `ADMIN_EMAILS`.
- **Peticiones falsificadas:** los cambios exigen la cabecera `x-cz-request: 1`, que otro sitio no puede enviar.
- **Cabeceras de seguridad** (`server/_core/hardening.ts`): HTTPS obligatorio (HSTS), `nosniff`, prohibido incrustar CuadraZone en otra página, `Referrer-Policy` y `Permissions-Policy` que solo permite la cámara para el escáner de boletos.
- **Archivos subidos:** se comprueba la firma real del archivo (no solo su extensión), su tamaño y su tipo antes de guardarlo.
- **Pagos:** CuadraZone no guarda tarjetas ni códigos de seguridad; los pagos se hacen directo al vendedor o por Yappy y se registran a mano.

## Protección de documentos

Las cédulas, carnés y cartas pastorales de los vendedores:

- se guardan dentro de la base de datos (`cz_verification_documents`), nunca en la carpeta de fotos: el servidor solo publica `/media/catalog`;
- solo los pueden abrir su dueño y un administrador (`server/services/privateDocuments.ts`); cualquier otra persona recibe «no autorizado»;
- se sirven con `Cache-Control: no-store` para que no queden guardados en cachés intermedias ni en el navegador;
- cada revisión de un administrador queda en la auditoría de la solicitud.

El respaldo completo de la base de datos (`/admin`, solo administradores) incluye estos datos: debe guardarse en un lugar seguro.

## Rendimiento en el celular

- El JavaScript se divide en librerías (React, datos, íconos) y código propio. Los archivos llevan huella en el nombre y se guardan un año en el teléfono, así que tras una actualización solo se descarga lo que cambió.
- El lector de QR y el generador de QR se descargan solo al abrir el escáner o «Mis boletos».
- Las fotos de la portada tienen versión de 640 px para el celular y cargan a medida que se acercan a la pantalla.
- Railway entrega las respuestas comprimidas (gzip).
