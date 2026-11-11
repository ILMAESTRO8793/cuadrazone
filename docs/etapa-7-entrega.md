# Etapa 7 · Calidad y entrega

Revisión del 11 de noviembre de 2026 sobre `https://www.cuadrazone.com`.

## Qué se revisó y qué se corrigió

| Tema | Encontrado | Corrección |
|---|---|---|
| Cabeceras de seguridad | El sitio no enviaba ninguna | HSTS, `nosniff`, prohibido incrustarlo en otras páginas, `Referrer-Policy`, `Permissions-Policy` (`server/_core/hardening.ts`) |
| `robots.txt` y `sitemap.xml` | Redirigían al inicio de sesión: los buscadores recibían una respuesta inválida | Se sirven antes del control de acceso. Solo ofrecen `/entrar`, `/ayuda` y los documentos legales; el resto queda bloqueado |
| Indexación de `/entrar` | Marcada `noindex`: buscar «CuadraZone» no llevaba a ninguna página | Ahora se puede indexar |
| Caché de archivos | JS y CSS con `max-age=0`: el teléfono los volvía a pedir siempre | Los archivos con huella se guardan un año; logos y fotos fijas, una hora |
| Peso del JavaScript | Un solo archivo de 1,2 MB (364 KB comprimido) | Librerías en un archivo aparte que se conserva entre versiones; el lector y el generador de QR solo se bajan cuando se usan. Carga inicial ≈ 300 KB comprimidos. Un primer intento con varios archivos de librerías rompió React al cargar; se detectó con Lighthouse en vivo y se corrigió en minutos |
| Accesibilidad (Lighthouse) | Botón «Categorías» sin nombre en el celular; títulos del pie fuera de orden | Corregidos |
| Documentos legales | Pendientes de revisión | Revisión legal hecha, según el titular (11/11/2026) |
| Correos con Brevo | Apagados | Configurados el 11/11/2026; el código para entrar con correo llegó |
| Pruebas | Dos pruebas fallaban a veces por tiempo con toda la batería | Límite de tiempo más amplio; la lógica no cambió |

Lighthouse en el celular, página `/entrar`: antes Accesibilidad 94, Buenas prácticas 100, SEO 58; después de desplegar, **100, 100 y 100**.

Documentación nueva: `docs/arquitectura.md` (por qué cada pieza, seguridad y protección de documentos) y `docs/manual-administrador.md`.

## Lo que todavía no está listo para producción

CuadraZone funciona en `https://www.cuadrazone.com`, pero **no se debe anunciar como lista** mientras falten estas integraciones. La lista sale de `TODO.md`; las variables de Railway no se revisaron en esta etapa, así que confirma en Railway cuáles ya configuraste:

| Pendiente | Qué falta | Qué pasa mientras tanto |
|---|---|---|
| Pagos automáticos | Cuenta Yappy Comercial (o PagueloFácil/Tilopay) de CuadraZone | Las mensualidades y comisiones se registran a mano en Suscripciones |
| SMS | Celular con SMS Gateway for Android (o Twilio) y sus variables | No se puede entrar con el celular; sí con correo |
| Entrar con Google | `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Railway (`/api/auth/methods` → `google: false`) | No aparece el botón de Google |
| Emblemas institucionales | Acreditación y autorización de cada institución | No se muestran |
| Prueba con cuentas reales | Recorrido completo: vendedor real aprobado, venta, reclamo, pago registrado | — |

## Comprobación después de desplegar

1. `curl -I https://www.cuadrazone.com/entrar` muestra `Strict-Transport-Security` y `X-Frame-Options`.
2. `https://www.cuadrazone.com/robots.txt` muestra el texto (no redirige a `/entrar`).
3. `https://www.cuadrazone.com/sitemap.xml` lista las páginas abiertas.
4. Un archivo de `/assets/index-….js` responde con `Cache-Control: public, max-age=31536000, immutable`.
5. Volver a pasar Lighthouse en el celular sobre `/entrar` (11/11/2026: 100 / 100 / 100).
6. Probar el escáner de boletos (la cámara sigue permitida) y abrir un documento privado desde `/admin` (el visor sigue funcionando).
