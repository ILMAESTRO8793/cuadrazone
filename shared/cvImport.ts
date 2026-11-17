/**
 * Lee el texto de un CV (sacado de un PDF) y arma los campos del formulario
 * «Mi CV» con reglas fijas, sin IA. No es perfecto: la persona revisa y corrige
 * antes de guardar. Nunca guarda nada por sí solo.
 */
import { provinceOptions } from "./marketplace";
import { skillGroups, type SaveResumeInput } from "./jobs";
import { instagramUrlFrom } from "./socialLinks";

type Level = SaveResumeInput["languages"][number]["level"];
export type ImportedResume = Partial<SaveResumeInput>;

// ───────────── Utilidades ─────────────

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Quita viñetas y espacios de más al inicio y al final de una línea. */
const clean = (s: string) =>
  s
    .replace(/^[\s•●▪■◦\-–—*·>]+/, "")
    .replace(/\s+/g, " ")
    .trim();

const MONTHS: Record<string, string> = {
  ene: "01", enero: "01", jan: "01", january: "01",
  feb: "02", febrero: "02", february: "02",
  mar: "03", marzo: "03", march: "03",
  abr: "04", abril: "04", apr: "04", april: "04",
  may: "05", mayo: "05",
  jun: "06", junio: "06", june: "06",
  jul: "07", julio: "07", july: "07",
  ago: "08", agosto: "08", aug: "08", august: "08",
  sep: "09", sept: "09", septiembre: "09", setiembre: "09", september: "09",
  oct: "10", octubre: "10", october: "10",
  nov: "11", noviembre: "11", november: "11",
  dic: "12", diciembre: "12", dec: "12", december: "12",
};
const MONTH_WORDS = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const CURRENT_WORDS = "actualidad|actual|presente|present|current|hoy|la fecha";
/** Una fecha: «2021», «03/2021», «marzo 2021», «mar. 2021». */
const YEAR = "(?:19|20)\\d{2}";
const DATE = `(?:(?:${MONTH_WORDS})\\.?\\s*(?:de\\s+)?${YEAR}|\\d{1,2}[/.-]${YEAR}|${YEAR})`;
const RANGE = new RegExp(
  `(${DATE})\\s*(?:-|–|—|a|al|hasta|to)\\s*(${DATE}|${CURRENT_WORDS})`,
  "i"
);

/** «marzo 2021» → «2021-03»; «2021» → «2021-01». */
function toYm(raw: string): string | null {
  const s = strip(raw).replace(/\./g, "");
  const numeric = s.match(/^(\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const m = Number(numeric[1]);
    return m >= 1 && m <= 12 ? `${numeric[2]}-${String(m).padStart(2, "0")}` : null;
  }
  const named = s.match(new RegExp(`^(${MONTH_WORDS})\\s*(?:de\\s+)?(\\d{4})$`));
  if (named) return `${named[2]}-${MONTHS[named[1]!]}`;
  const year = s.match(/^(\d{4})$/);
  return year ? `${year[1]}-01` : null;
}

// ───────────── Secciones ─────────────

type Section =
  | "summary"
  | "experience"
  | "education"
  | "courses"
  | "skills"
  | "languages"
  | "references"
  | "other";

const HEADINGS: [Section, string[]][] = [
  ["summary", ["perfil", "perfil profesional", "resumen", "resumen profesional", "sobre mi", "acerca de mi", "objetivo", "objetivo profesional", "summary", "profile", "about me", "professional summary"]],
  ["experience", ["experiencia", "experiencia laboral", "experiencia profesional", "historial laboral", "trayectoria", "trayectoria profesional", "experience", "work experience", "professional experience", "employment history"]],
  ["education", ["educacion", "formacion", "formacion academica", "estudios", "estudios realizados", "education", "academic background"]],
  ["courses", ["cursos", "certificaciones", "certificados", "cursos y certificaciones", "cursos y certificados", "seminarios", "certifications", "courses", "licencias y certificaciones"]],
  ["skills", ["habilidades", "competencias", "aptitudes", "conocimientos", "habilidades tecnicas", "habilidades blandas", "skills", "technical skills", "soft skills", "herramientas"]],
  ["languages", ["idiomas", "lenguas", "languages"]],
  ["references", ["referencias", "referencias personales", "referencias laborales", "references"]],
  ["other", ["datos personales", "contacto", "informacion personal", "intereses", "hobbies", "logros", "voluntariado", "proyectos", "contact", "personal information"]],
];

/** Si la línea es un título de sección («EXPERIENCIA LABORAL:»), cuál es. */
function headingOf(line: string): Section | null {
  const s = strip(line).replace(/[:.]$/, "").trim();
  if (!s || s.length > 40) return null;
  for (const [section, words] of HEADINGS) if (words.includes(s)) return section;
  return null;
}

// ───────────── Datos de contacto ─────────────

function findEmail(text: string) {
  return text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? "";
}

/** Celular de Panamá: +507 6xxx-xxxx o 6xxx-xxxx. */
function findPhone(text: string) {
  const m = text.match(/(?:\+?\s*507[\s-]*)?(6\d{3})[\s.-]?(\d{4})(?!\d)/);
  return m ? `+507${m[1]}${m[2]}` : "";
}

function findUrls(text: string): string[] {
  return [...(text.match(/(?:https?:\/\/|www\.)[^\s,;)]+/gi) ?? [])].concat(
    text.match(/\b(?:instagram|facebook|linkedin)\.com\/[^\s,;)]+/gi) ?? []
  );
}

// ───────────── Idiomas ─────────────

const LANGUAGES: [string, string[]][] = [
  ["Español", ["espanol", "spanish", "castellano"]],
  ["Inglés", ["ingles", "english"]],
  ["Francés", ["frances", "french"]],
  ["Portugués", ["portugues", "portuguese"]],
  ["Mandarín", ["mandarin", "chino", "chinese"]],
  ["Alemán", ["aleman", "german"]],
  ["Italiano", ["italiano", "italian"]],
  ["Creole haitiano", ["creole", "criollo haitiano", "kreyol"]],
  ["Lengua de señas", ["lengua de senas", "lenguaje de senas", "sign language"]],
];

function levelOf(line: string): Level {
  const s = strip(line);
  if (/nativ|materna|native|mother tongue/.test(s)) return "nativo";
  if (/avanzad|fluid|advanced|fluent|bilingu|\bc1\b|\bc2\b|100\s*%/.test(s)) return "avanzado";
  if (/basic|elemental|beginner|\ba1\b|\ba2\b/.test(s)) return "basico";
  return "intermedio";
}

function findLanguages(lines: string[]): SaveResumeInput["languages"] {
  const out: SaveResumeInput["languages"] = [];
  for (const line of lines) {
    const s = strip(line);
    for (const [name, words] of LANGUAGES) {
      if (out.some(l => l.language === name)) continue;
      if (words.some(w => new RegExp(`\\b${w}\\b`).test(s))) {
        // El nivel se busca justo después del idioma en la misma línea.
        const at = Math.max(...words.map(w => s.search(new RegExp(`\\b${w}\\b`))));
        out.push({ language: name, level: levelOf(s.slice(at, at + 40)) });
      }
    }
  }
  return out.slice(0, 8);
}

// ───────────── Habilidades ─────────────

function findSkills(sectionLines: string[], fullText: string): string[] {
  const out: string[] = [];
  const add = (skill: string) => {
    const s = clean(skill).replace(/[.;:]+$/, "");
    if (s.length < 2 || s.length > 60) return;
    if (!out.some(x => strip(x) === strip(s))) out.push(s);
  };
  for (const line of sectionLines)
    for (const part of line.split(/[,;•●▪|]|\s{2,}|\s[-–]\s/)) add(part);
  // También las sugeridas de CuadraZone que aparezcan en cualquier parte del CV.
  const all = strip(fullText);
  for (const group of skillGroups)
    for (const skill of group.skills)
      if (all.includes(strip(skill).replace(/\s*\(.*\)$/, ""))) add(skill);
  return out.slice(0, 30);
}

// ───────────── Experiencia ─────────────

/** «Cargo · Empresa», «Cargo - Empresa», «Cargo en Empresa», «Empresa | Cargo». */
function splitRoleCompany(line: string): { role: string; company: string } {
  const parts = line.split(/\s+[·|@]\s+|\s+[-–—]\s+|,\s+/).map(clean).filter(Boolean);
  if (parts.length >= 2) return { role: parts[0]!, company: parts.slice(1).join(" · ") };
  const en = line.match(/^(.+?)\s+en\s+(.+)$/i);
  if (en) return { role: clean(en[1]!), company: clean(en[2]!) };
  return { role: clean(line), company: "" };
}

const isBullet = (raw: string) => /^\s*[•●▪■◦\-–*]/.test(raw);

/**
 * Cada línea con un rango de fechas («2019 - 2021», «mar 2021 – actualidad»)
 * es un trabajo. El cargo y la empresa son la misma línea (antes de las fechas)
 * o las 1–2 líneas cortas de arriba; lo que sigue, hasta el próximo trabajo,
 * es la descripción.
 */
function parseExperience(lines: string[]): SaveResumeInput["experience"] {
  const rows = lines.map(raw => ({ raw, text: clean(raw) })).filter(r => r.text);
  const dates = rows.flatMap((r, i) => (RANGE.test(r.text) ? [i] : []));
  // Dónde empieza el título de cada trabajo.
  const starts = dates.map((d, k) => {
    const before = clean(rows[d]!.text.slice(0, rows[d]!.text.match(RANGE)!.index));
    const floor = k > 0 ? dates[k - 1]! + 1 : 0;
    let start = d;
    const want = before ? 1 : 2;
    for (let j = d - 1, taken = 0; j >= floor && taken < want; j--, taken++) {
      if (isBullet(rows[j]!.raw) || rows[j]!.text.length > 80) break;
      start = j;
    }
    return start;
  });
  return dates
    .map((d, k) => {
      const row = rows[d]!.text;
      const range = row.match(RANGE)!;
      const before = clean(row.slice(0, range.index).replace(/[|,(]\s*$/, ""));
      const titles = rows.slice(starts[k], d).map(r => r.text).concat(before ? [before] : []);
      let role = "";
      let company = "";
      if (titles.length >= 2) {
        const first = splitRoleCompany(titles[0]!);
        role = first.role;
        company = first.company || titles[1]!;
      } else if (titles.length === 1) {
        ({ role, company } = splitRoleCompany(titles[0]!));
      }
      const end = k + 1 < dates.length ? starts[k + 1]! : rows.length;
      const description = rows
        .slice(d + 1, end)
        .map(r => r.text)
        .join("\n")
        .slice(0, 1000);
      const isCurrent = new RegExp(CURRENT_WORDS, "i").test(range[2]!);
      return {
        role: role.slice(0, 120),
        company: company.slice(0, 120),
        start: toYm(range[1]!) ?? "",
        end: isCurrent ? null : toYm(range[2]!),
        current: isCurrent,
        description,
      };
    })
    .filter(x => x.start)
    .slice(0, 15);
}

// ───────────── Estudios y cursos ─────────────

const SCHOOL = /universidad|university|instituto|institute|colegio|escuela|academia|college|school|utp|\bup\b|usma|ulacit|ipt|inadeh|coursera|udemy|platzi|google|microsoft|cisco|isae|unachi|udelas|unela|columbus|latina/i;

function parseStudies(lines: string[]) {
  const out: { title: string; institution: string; year: string }[] = [];
  let pending: { title: string; institution: string; year: string } | null = null;
  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;
    const years = line.match(/\b(19|20)\d{2}\b/g);
    const year = years ? years[years.length - 1]! : "";
    const text = clean(line.replace(/\(?\b(19|20)\d{2}\b\s*(?:[-–]\s*(?:\b(19|20)\d{2}\b|\w+))?\)?/g, "").replace(/[|,·-]\s*$/, ""));
    const parts = text.split(/\s+[·|]\s+|\s+[-–—]\s+|,\s+/).map(clean).filter(Boolean);
    if (pending && !pending.institution && SCHOOL.test(text) && parts.length === 1) {
      pending.institution = text;
      if (!pending.year) pending.year = year;
      continue;
    }
    if (pending && !pending.year && !text && year) {
      pending.year = year;
      continue;
    }
    if (!text) continue;
    const schoolPart = parts.find(p => SCHOOL.test(p));
    pending = {
      title: (parts.length > 1 ? parts.find(p => p !== schoolPart) ?? parts[0]! : text).slice(0, 120),
      institution: (parts.length > 1 ? schoolPart ?? parts[1]! : "").slice(0, 120),
      year,
    };
    out.push(pending);
  }
  return out;
}

// ───────────── Referencias ─────────────

function parseReferences(lines: string[]): SaveResumeInput["references"] {
  const out: SaveResumeInput["references"] = [];
  let names: string[] = [];
  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;
    // Teléfono de Panamá: 6123-4567, 222-3333 o con +507 delante.
    const phone = line.match(/((?:\+?507[\s-]*)?\d{3,4}[\s-]?\d{4})(?!\d)/);
    if (phone) {
      const before = clean(line.slice(0, phone.index).replace(/(tel[eé]fono|tel|cel|celular|phone)[.:]?\s*$/i, "").replace(/[-–:,|]\s*$/, ""));
      const label = before ? [...names, before] : names;
      const parts = (label[0] ?? "").split(/\s+[-–·|]\s+|,\s+/).map(clean);
      out.push({
        name: (parts[0] ?? "").slice(0, 120),
        role: (parts.slice(1).join(" · ") || label.slice(1).join(" · ")).slice(0, 120),
        phone: phone[1]!.replace(/\s+/g, "").slice(0, 20),
      });
      names = [];
    } else {
      names.push(line);
      if (names.length > 2) names.shift();
    }
  }
  return out.filter(r => r.name.length >= 3).slice(0, 5);
}

// ───────────── Todo junto ─────────────

/** Arma los campos del CV a partir del texto del PDF. */
export function parseResumeText(text: string): ImportedResume {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+$/, ""));
  const bySection: Record<Section | "top", string[]> = {
    top: [], summary: [], experience: [], education: [], courses: [], skills: [], languages: [], references: [], other: [],
  };
  let section: Section | "top" = "top";
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      section = h;
      continue;
    }
    bySection[section].push(line);
  }
  const out: ImportedResume = {};

  // Nombre y oficio: las primeras líneas del CV que no son contacto.
  const contactish = /@|https?:|www\.|\d{4}|tel[eé]fono|correo|email|direcci[oó]n|cel/i;
  const top = bySection.top.map(clean).filter(Boolean).filter(l => !contactish.test(l));
  const nameLine = top.find(l => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{5,60}$/.test(l) && l.split(" ").length >= 2 && l.split(" ").length <= 6);
  if (nameLine) {
    out.fullName = nameLine.replace(/\b([A-ZÁÉÍÓÚÑ])([A-ZÁÉÍÓÚÑ]+)\b/g, (_, a: string, b: string) => a + b.toLowerCase());
    const next = top[top.indexOf(nameLine) + 1];
    if (next && next.length <= 120 && !headingOf(next)) out.headline = next;
  }

  const email = findEmail(text);
  if (email) out.email = email.slice(0, 254);
  const phone = findPhone(text);
  if (phone) out.phone = phone;
  const plain = strip(text);
  const province = [...provinceOptions].sort((a, b) => b.length - a.length).find(p => plain.includes(strip(p)));
  if (province) out.province = province;

  for (const url of findUrls(text)) {
    const u = url.replace(/[.]+$/, "");
    if (/instagram\.com/i.test(u)) out.instagramUrl ||= instagramUrlFrom(u);
    else if (/facebook\.com/i.test(u)) out.facebookUrl ||= (u.startsWith("http") ? u : `https://${u}`).slice(0, 200);
    else if (!/linkedin\.com/i.test(u)) out.portfolioUrl ||= (u.startsWith("http") ? u : `https://${u}`).slice(0, 200);
  }
  if (!out.instagramUrl) {
    const handle = text.match(/instagram[^\n@]{0,15}@([A-Za-z0-9._]{2,30})/i);
    if (handle) out.instagramUrl = instagramUrlFrom(handle[1]!);
  }

  const summary = bySection.summary.map(clean).filter(Boolean).join(" ");
  if (summary) out.summary = summary.slice(0, 1500);

  const experience = parseExperience(bySection.experience);
  if (experience.length) out.experience = experience;

  const education = parseStudies(bySection.education).slice(0, 10);
  if (education.length)
    out.education = education.map(e => ({ degree: e.title, institution: e.institution, year: e.year }));

  const courses = parseStudies(bySection.courses).slice(0, 15);
  if (courses.length)
    out.courses = courses.map(c => ({ name: c.title, institution: c.institution, year: c.year }));

  const skills = findSkills(bySection.skills, text);
  if (skills.length) out.skills = skills;

  const languages = findLanguages(bySection.languages.length ? bySection.languages : lines);
  if (languages.length) out.languages = languages;

  const references = parseReferences(bySection.references);
  if (references.length) out.references = references;

  return out;
}

/**
 * Junta lo que se leyó del PDF con lo que la persona ya escribió: llena los
 * campos vacíos y agrega a las listas sin repetir.
 */
export function mergeImportedResume<T extends SaveResumeInput>(current: T, imported: ImportedResume): T {
  const next: T = { ...current };
  const textKeys = ["fullName", "headline", "summary", "phone", "email", "instagramUrl", "facebookUrl", "portfolioUrl"] as const;
  for (const k of textKeys) {
    const value = imported[k];
    if (value && !String(current[k] ?? "").trim()) (next as Record<string, unknown>)[k] = value;
  }
  if (imported.province && (!current.fullName || current.province === "Panamá")) next.province = imported.province;
  const listKeys = ["experience", "education", "courses", "references"] as const;
  for (const k of listKeys) {
    const add = imported[k];
    if (add?.length) (next as Record<string, unknown>)[k] = [...(current[k] ?? []), ...add];
  }
  if (imported.skills?.length) {
    const have = new Set(current.skills.map(strip));
    next.skills = [...current.skills, ...imported.skills.filter(s => !have.has(strip(s)))].slice(0, 30);
  }
  if (imported.languages?.length) {
    const have = new Set(current.languages.map(l => strip(l.language)));
    next.languages = [...current.languages, ...imported.languages.filter(l => !have.has(strip(l.language)))].slice(0, 8);
  }
  return next;
}

/** Lista corta de lo que se encontró, para avisarle a la persona. */
export function importSummary(imported: ImportedResume): string[] {
  const found: string[] = [];
  if (imported.fullName) found.push("nombre");
  if (imported.email || imported.phone) found.push("contacto");
  if (imported.summary) found.push("sobre mí");
  if (imported.experience?.length) found.push(`${imported.experience.length} experiencia(s)`);
  if (imported.education?.length) found.push(`${imported.education.length} estudio(s)`);
  if (imported.courses?.length) found.push(`${imported.courses.length} curso(s)`);
  if (imported.skills?.length) found.push(`${imported.skills.length} habilidad(es)`);
  if (imported.languages?.length) found.push(`${imported.languages.length} idioma(s)`);
  if (imported.references?.length) found.push(`${imported.references.length} referencia(s)`);
  return found;
}
