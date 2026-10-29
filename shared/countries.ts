/**
 * Países de CuadraZone. Por ahora solo Panamá está activo; en los demás se
 * puede dejar el correo para recibir un aviso cuando abra.
 */
export const countries = [
  { code: "PA", name: "Panamá", active: true },
  { code: "CO", name: "Colombia", active: false },
  { code: "VE", name: "Venezuela", active: false },
  { code: "SV", name: "El Salvador", active: false },
  { code: "AR", name: "Argentina", active: false },
  { code: "BR", name: "Brasil", active: false },
  { code: "PE", name: "Perú", active: false },
  { code: "EC", name: "Ecuador", active: false },
  { code: "BO", name: "Bolivia", active: false },
  { code: "UY", name: "Uruguay", active: false },
  { code: "PY", name: "Paraguay", active: false },
  { code: "GT", name: "Guatemala", active: false },
  { code: "MX", name: "México", active: false },
  { code: "US", name: "Estados Unidos", active: false },
  { code: "BZ", name: "Belice", active: false },
  { code: "CR", name: "Costa Rica", active: false },
  { code: "HN", name: "Honduras", active: false },
  { code: "DO", name: "República Dominicana", active: false },
] as const;

export type CountryCode = (typeof countries)[number]["code"];
export const countryCodes = countries.map(c => c.code) as [CountryCode, ...CountryCode[]];
export const activeCountryCodes = countries.filter(c => c.active).map(c => c.code) as [CountryCode, ...CountryCode[]];
export const countryName = (code: string) => countries.find(c => c.code === code)?.name ?? code;
