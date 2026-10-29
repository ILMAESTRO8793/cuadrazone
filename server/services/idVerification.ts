// Verificación inmediata de vendedores sin costo: un OCR de código abierto
// (Tesseract, corre en nuestro propio servidor, las imágenes no salen de
// CuadraZone) lee la cédula y la captura de Yappy o del banco. No intentamos
// adivinar los datos: buscamos en el texto leído el nombre y el número que el
// vendedor escribió. Los bancos abrevian nombres y apellidos, por eso la
// comparación con la captura acepta iniciales.
import { createRequire } from "node:module";
import path from "node:path";

export type CheckStatus = "ok" | "fail" | "manual";
export type CheckResult = { status: CheckStatus; reasons: string[] };
export type AutoChecks = {
  identity: CheckResult;
  payout: CheckResult;
  checkedAt: string;
  identityDocumentId: number | null;
  payoutDocumentId: number | null;
  nameKey: string;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Mayúsculas, sin tildes y solo letras, números, guiones y espacios. */
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\-\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(value: string) {
  return normalizeText(value)
    .replace(/[.\-]/g, " ")
    .split(" ")
    // «de», «del», «la» no cuentan como nombre o apellido.
    .filter(t => t && !["DE", "DEL", "LA", "LAS", "LOS", "Y"].includes(t));
}

/** Distancia de edición: tolera un error de lectura en nombres largos. */
function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length]![b.length]!;
}

export function sameWord(expected: string, found: string) {
  if (expected === found) return true;
  return expected.length >= 5 && Math.abs(expected.length - found.length) <= 1 && editDistance(expected, found) <= 1;
}

/** Solo los dígitos y guiones del número de cédula (8-888-1234). */
export function normalizeIdNumber(value: string) {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * La cédula debe mostrar el número escrito y todos los nombres y apellidos.
 * Se compara contra el texto leído, palabra por palabra.
 */
export function checkIdentityText(ocrText: string, expected: { givenNames: string; surnames: string; idNumber: string }): CheckResult {
  const reasons: string[] = [];
  const words = nameTokens(ocrText);
  const compactText = normalizeIdNumber(ocrText);
  const idNumber = normalizeIdNumber(expected.idNumber);
  if (!words.length) return { status: "fail", reasons: ["No pudimos leer la imagen. Sube una foto más clara, de frente y con buena luz."] };
  if (idNumber.length < 5 || !compactText.includes(idNumber))
    reasons.push("No encontramos tu número de cédula en la foto. Revisa que esté bien escrito y que se vea completo.");
  const missing = [...nameTokens(expected.givenNames), ...nameTokens(expected.surnames)].filter(
    token => !words.some(word => sameWord(token, word))
  );
  if (missing.length)
    reasons.push(`No encontramos en la foto: ${missing.join(", ")}. Escribe tu nombre exactamente como aparece en tu cédula.`);
  return { status: reasons.length ? "fail" : "ok", reasons };
}

/**
 * La captura de Yappy o del banco debe tener una línea con el nombre del
 * titular compatible con la cédula. Los bancos abrevian: «SALEM J PIERRE D»
 * coincide con «Salem Jean» + «Pierre Dupont». Reglas:
 *  - el primer nombre debe aparecer completo y primero;
 *  - el primer apellido debe aparecer, completo o como inicial;
 *  - cada palabra de la línea debe ser un nombre o apellido de la cédula, completo o en inicial;
 *  - no puede quedar ninguna palabra extraña (otra persona).
 */
export function checkPayoutText(ocrText: string, expected: { givenNames: string; surnames: string }): CheckResult {
  const given = nameTokens(expected.givenNames);
  const surnames = nameTokens(expected.surnames);
  if (!given.length || !surnames.length)
    return { status: "fail", reasons: ["Escribe tus nombres y apellidos como en tu cédula."] };
  const all = [...given, ...surnames];
  const lines = ocrText.split(/\r?\n/).map(nameTokens).filter(line => line.length >= 2 && line.length <= 8);
  if (!lines.length) return { status: "fail", reasons: ["No pudimos leer la captura. Sube una captura de pantalla (no foto de la pantalla) donde se vea tu nombre."] };
  const matchesWord = (token: string, candidate: string) =>
    sameWord(candidate, token) || (token.length === 1 && candidate.startsWith(token));
  for (const line of lines) {
    if (!sameWord(given[0]!, line[0]!)) continue;
    const firstSurname = surnames[0]!;
    const hasSurname = line.slice(1).some(token => matchesWord(token, firstSurname));
    const everyKnown = line.every(token => all.some(candidate => matchesWord(token, candidate)));
    if (hasSurname && everyKnown) return { status: "ok", reasons: [] };
  }
  return {
    status: "fail",
    reasons: [
      `El nombre de la captura no coincide con tu cédula (${given[0]} … ${firstOf(surnames)}). La cuenta de Yappy o del banco debe estar a tu nombre.`,
    ],
  };
}

function firstOf(list: string[]) {
  return list[0] ?? "";
}

// ───────────── Lectura con OCR (Tesseract, gratis y local) ─────────────

let workerPromise: Promise<any> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const require = createRequire(import.meta.url);
      const langDir = path.join(path.dirname(require.resolve("@tesseract.js-data/spa/package.json")), "4.0.0_best_int");
      return createWorker("spa", 1, { langPath: langDir, cacheMethod: "none", gzip: true });
    })().catch(error => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

/** Lee el texto de una imagen. Una a la vez, para no saturar el servidor. */
export async function readImageText(bytes: Buffer): Promise<string> {
  const run = queue.then(async () => {
    const worker = await getWorker();
    const result = await Promise.race([
      worker.recognize(bytes),
      new Promise((_, reject) => setTimeout(() => reject(new Error("OCR: tiempo agotado")), 45_000)),
    ]);
    return String((result as any)?.data?.text ?? "");
  });
  queue = run.catch(() => undefined);
  return run;
}

export function isReadableImage(mimeType: string) {
  return IMAGE_TYPES.has(mimeType);
}

export function nameKeyOf(givenNames: string, surnames: string, idNumber: string) {
  return `${nameTokens(givenNames).join(" ")}|${nameTokens(surnames).join(" ")}|${normalizeIdNumber(idNumber)}`;
}

/** Evalúa ambos documentos. Los PDF y los faltantes quedan para revisión o para subirlos. */
export async function evaluateDocuments(input: {
  givenNames: string;
  surnames: string;
  idNumber: string;
  identity: { id: number; mimeType: string; bytes: Buffer } | null;
  payout: { id: number; mimeType: string; bytes: Buffer } | null;
}, reader: (bytes: Buffer) => Promise<string> = readImageText): Promise<AutoChecks> {
  const base = {
    checkedAt: new Date().toISOString(),
    identityDocumentId: input.identity?.id ?? null,
    payoutDocumentId: input.payout?.id ?? null,
    nameKey: nameKeyOf(input.givenNames, input.surnames, input.idNumber),
  };
  const readOrManual = async (doc: { mimeType: string; bytes: Buffer } | null, missing: string, check: (text: string) => CheckResult): Promise<CheckResult> => {
    if (!doc) return { status: "fail", reasons: [missing] };
    if (!isReadableImage(doc.mimeType))
      return { status: "manual", reasons: ["Para la verificación inmediata sube una foto o captura (JPG o PNG), no un PDF. Con PDF la revisamos a mano."] };
    try {
      return check(await reader(doc.bytes));
    } catch (error) {
      console.error("[Verificación] OCR falló:", error instanceof Error ? error.message : error);
      return { status: "manual", reasons: ["No pudimos leer la imagen ahora. Inténtalo de nuevo o envíala a revisión."] };
    }
  };
  const identity = await readOrManual(input.identity, "Sube una foto de tu cédula.", text =>
    checkIdentityText(text, { givenNames: input.givenNames, surnames: input.surnames, idNumber: input.idNumber })
  );
  const payout = await readOrManual(input.payout, "Sube una captura de tu Yappy o de tu banco donde se vea tu nombre.", text =>
    checkPayoutText(text, { givenNames: input.givenNames, surnames: input.surnames })
  );
  return { ...base, identity, payout };
}
