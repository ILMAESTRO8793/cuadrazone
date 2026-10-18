// Valores de configuración leídos en tiempo de uso. Nunca se envían al navegador.
// Ver docs/despliegue-railway.md y .env.example.
function list(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

export const ENV = {
  /** Identificador fijo de la aplicación incluido en cada sesión firmada. */
  appId: "cuadrazone",
  /** Secreto para firmar las cookies de sesión (mínimo 32 caracteres). */
  get cookieSecret() { return process.env.SESSION_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  /** URL pública del sitio, sin barra final. Ej.: https://cuadrazone.com */
  get publicUrl() { return (process.env.PUBLIC_URL ?? "").replace(/\/+$/, ""); },
  get googleClientId() { return process.env.GOOGLE_CLIENT_ID ?? ""; },
  get googleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ""; },
  /** Correos (verificados por Google) que reciben el rol de administrador. */
  get adminEmails() { return list(process.env.ADMIN_EMAILS); },
  /** Carpeta persistente para fotos públicas del catálogo (volumen de Railway). */
  get storageDir() { return process.env.STORAGE_DIR ?? "./storage"; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
};
