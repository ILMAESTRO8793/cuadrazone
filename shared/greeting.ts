/*
 * Saludo de la cabecera («Hola, Salem»): el primer nombre de la persona,
 * nunca una parte del correo. Si el nombre está todo en mayúsculas o en
 * minúsculas («SALEM PIERRE», «salem») se escribe con la inicial en
 * mayúscula; si ya trae su propia forma («McKenzie») se respeta.
 */

/** Palabra con la inicial en mayúscula, salvo que ya venga con forma propia. */
function properCase(word: string): string {
  const lower = word.toLocaleLowerCase("es");
  const upper = word.toLocaleUpperCase("es");
  if (word !== lower && word !== upper) return word;
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}

/** Primer nombre para el saludo, o null si la cuenta no tiene nombre. */
export function greetingName(name: string | null | undefined): string | null {
  const clean = (name ?? "").trim();
  // Algunas cuentas guardan el correo como nombre: eso no es un nombre.
  if (!clean || clean.includes("@")) return null;
  const first = clean.split(/\s+/)[0];
  return first ? properCase(first) : null;
}
