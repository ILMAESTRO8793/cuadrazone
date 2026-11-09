# App de CuadraZone (Android e iPhone)

La app es **CuadraZone dentro de una app nativa** (Capacitor). Abre
`https://www.cuadrazone.com`, así que **todo lo que se publica en la web se ve en
la app al instante**, sin volver a subirla a las tiendas. Solo hay que publicar
una versión nueva de la app cuando cambie algo nativo: el icono, la pantalla de
inicio, el nombre o un permiso.

| Dato | Valor |
|---|---|
| Nombre | CuadraZone |
| Identificador (Android y iOS) | `com.cuadrazone.app` |
| Versión | 1.0 (versionCode 1) |
| Colores | Azul marino `#071E38`, dorado `#D9AD49` (paleta Earthy Editorial) |
| Sin conexión | Muestra `www/offline.html` con un botón «Reintentar» |

Carpetas:

- `capacitor.config.ts` — configuración de la app.
- `assets/` — imágenes de origen del icono y de la pantalla de inicio.
- `android/` — proyecto de Android Studio.
- `ios/` — proyecto de Xcode.
- `www/` — página de respaldo sin conexión.

## Comandos (desde esta carpeta `mobile/`)

```bash
npm install          # la primera vez
npm run assets       # regenerar icono y pantalla de inicio desde assets/
npx cap sync         # copiar cambios de configuración a Android e iOS
npm run android      # abrir en Android Studio
npm run ios          # abrir en Xcode (solo en una Mac)
```

APK de prueba de Android (Windows, con Android Studio instalado):

```bash
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleDebug
# Resultado: android/app/build/outputs/apk/debug/app-debug.apk
```

## Publicar en Google Play

1. En Android Studio: **Build → Generate Signed App Bundle / APK → Android App
   Bundle**. Crea una **clave de firma** nueva (archivo `.jks`) y **guárdala en un
   lugar seguro junto con su contraseña**: sin ella no se pueden publicar
   actualizaciones. No la subas a GitHub.
2. En [Google Play Console](https://play.google.com/console): **Crear app** →
   nombre CuadraZone, idioma español, app gratuita.
3. Completa la ficha: descripción, capturas de pantalla (teléfono), icono de
   512×512 (`assets/icon-only.png`), gráfico destacado de 1024×500, categoría
   **Compras**, correo de contacto `info@cuadrazone.com` y la política de
   privacidad `https://www.cuadrazone.com/legal/privacidad`.
4. **Contenido de la app**: clasificación de contenido, público objetivo
   (mayores de 18), seguridad de los datos (correo, teléfono, fotos y documentos
   de vendedores, sin publicidad), y una **cuenta de prueba** para los revisores
   (la web pide iniciar sesión).
5. Sube el `.aab` a **Prueba interna** primero; cuando funcione, promuévelo a
   **Producción**. Las cuentas personales nuevas deben hacer antes una prueba
   cerrada con testers durante unos días; Play Console lo indica.

## Publicar en el App Store (iPhone)

Hace falta una **cuenta de Apple Developer** (US$99 al año) y compilar en una
**Mac con Xcode**, o con un servicio en la nube (Codemagic, Ionic Appflow…).

1. En la Mac: `npm install`, `npx cap sync ios` y `npm run ios`.
2. En Xcode: elige tu equipo en **Signing & Capabilities** y **Product → Archive**
   → **Distribute App** → App Store Connect.
3. En [App Store Connect](https://appstoreconnect.apple.com) completa la ficha,
   la privacidad y una cuenta de prueba, y envía a revisión.

**Ojo con Apple:** rechaza las apps que son «solo una web dentro de una app»
(norma 4.2). Antes de enviarla conviene añadir funciones nativas, por ejemplo
notificaciones push, compartir nativo o subir fotos con la cámara, y
describirlas en las notas para el revisor.

## Pendiente para una versión 1.1

- Notificaciones push (pedidos, solicitudes de servicio, mensajes): requiere
  Firebase para Android y APNs para iPhone.
- El inicio con Google no funciona dentro de la app (Google lo bloquea en
  vistas web); el inicio con correo o celular sí.
