import type { CapacitorConfig } from "@capacitor/cli";

/*
 * App de CuadraZone: abre la web en vivo dentro de una app nativa.
 * Todo lo que se publica en www.cuadrazone.com se ve en la app al instante,
 * sin volver a subirla a las tiendas. www/ solo se usa si no hay conexión.
 */
const config: CapacitorConfig = {
  appId: "com.cuadrazone.app",
  appName: "CuadraZone",
  webDir: "www",
  backgroundColor: "#071E38",
  server: {
    url: "https://www.cuadrazone.com",
    cleartext: false,
    // Solo CuadraZone se abre dentro de la app; WhatsApp, correo, mapas y
    // demás enlaces externos se abren en su propia app o en el navegador.
    allowNavigation: ["www.cuadrazone.com", "cuadrazone.com"],
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  ios: {
    contentInset: "automatic",
    scheme: "CuadraZone",
  },
};

export default config;
