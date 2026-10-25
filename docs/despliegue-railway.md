# Despliegue en Railway

El repositorio incluye `Dockerfile` y `railway.json`. Railway compila la imagen, arranca el servidor, aplica las migraciones pendientes y comprueba `/api/health`.

## 1. Credenciales de Google

1. En https://console.cloud.google.com crea un proyecto llamado "CuadraZone".
2. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**. Elige tipo "Externo", con nombre CuadraZone, tu correo de soporte y el logo. Publica la aplicación cuando vayas a abrirla al público.
3. Ve a **Credenciales → Crear credenciales → ID de cliente de OAuth**, con tipo "Aplicación web". En "URI de redirección autorizados" agrega:
   - `https://TU-DOMINIO/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback` (solo para desarrollo).
4. Guarda el ID de cliente y el secreto. No los compartas por chat ni los subas a Git.

## 2. Proyecto en Railway

1. Crea un proyecto nuevo y agrega una base de datos **MySQL**.
2. Agrega un servicio desde tu repositorio de GitHub con este código, o súbelo con `railway up` desde la carpeta.
3. En el servicio, ve a **Settings → Volumes**, crea un volumen y móntalo en `/data`. Ahí se guardan las fotos del catálogo; sin volumen se pierden en cada despliegue.
4. En **Settings → Networking**, genera un dominio de Railway o conecta tu dominio propio.

## 3. Variables del servicio

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` |
| `SESSION_SECRET` | 48+ caracteres aleatorios: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `PUBLIC_URL` | `https://TU-DOMINIO`, sin barra final. Debe coincidir con el URI de redirección de Google. |
| `GOOGLE_CLIENT_ID` | del paso 1 |
| `GOOGLE_CLIENT_SECRET` | del paso 1 |
| `ADMIN_EMAILS` | correos de Google con rol de administrador, separados por comas |
| `STORAGE_DIR` | `/data/storage` |
| `BREVO_API_KEY` | opcional: clave de API de Brevo para los correos automáticos |
| `EMAIL_FROM` | opcional: remitente verificado en Brevo, p. ej. `avisos@tudominio.com` |
| `EMAIL_FROM_NAME` | opcional: nombre del remitente (por defecto CuadraZone) |
| `SMS_GATEWAY_USER` y `SMS_GATEWAY_PASSWORD` | opcional: credenciales de la app SMS Gateway for Android (modo nube) para entrar con el celular |
| `SMS_PROVIDER` + `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | opcional: usar Twilio en vez del celular Android (`SMS_PROVIDER=twilio`) |
| `PAYMENT_CONTACT` | opcional: número de Yappy o WhatsApp al que pagan los vendedores, p. ej. `+507 6000-0000` |

`PORT` y `NODE_ENV` ya los fija Railway y el Dockerfile.

## 4. Comprobación tras desplegar

1. `https://TU-DOMINIO/api/health` responde `{"status":"ok"}`.
2. En los registros (Deploy Logs) aparece "Migraciones al día".
3. Inicia sesión con un correo de `ADMIN_EMAILS` y abre `/admin`.
4. Inicia sesión con otro correo: debe entrar como comprador y `/admin` debe mostrar "Acceso restringido".

## Notas

- El rol de administrador se recalcula en cada inicio de sesión desde `ADMIN_EMAILS`. Si quitas un correo de la lista, pierde el rol la próxima vez que entre.
- Las cuentas creadas en Manus no se migran, porque usaban otro sistema de login. Los usuarios simplemente entran con Google.
- Copias de seguridad: activa los respaldos de MySQL en Railway. Las fotos del volumen deben respaldarse por separado.
