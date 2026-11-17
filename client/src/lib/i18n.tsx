/**
 * Idioma de la web y la app: español (por defecto) o inglés.
 *
 * - Lo que más se ve (encabezado, menú, portada, tarjetas, pie de página) está
 *   traducido a mano con `t("texto en español")` y el diccionario de i18n-en.ts.
 * - El resto, mientras lo pasamos a mano por partes, lo traduce el traductor de
 *   Google solo cuando la persona eligió inglés. Las partes traducidas a mano
 *   llevan translate="no" para que Google no las toque.
 * - La elección se guarda en el navegador (y en la app) y al cambiar se recarga
 *   la página para empezar limpia.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EN } from "./i18n-en";

export type Lang = "es" | "en";
const STORAGE_KEY = "cz_lang";

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

/** Cookie que lee el traductor de Google: «/es/en» traduce de español a inglés. */
function setGoogleCookie(value: string | null) {
  const host = location.hostname;
  const domains = ["", host, `.${host.replace(/^www\./, "")}`];
  for (const d of domains) {
    const domain = d ? `; domain=${d}` : "";
    document.cookie = value
      ? `googtrans=${value}; path=/${domain}`
      : `googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT${domain}`;
  }
}

/**
 * Google cambia el texto de la página por su cuenta y React puede fallar al
 * quitar o mover nodos que ya no están donde los dejó. Este parche (el que
 * recomienda el equipo de React para este caso) evita que la página se rompa.
 */
function patchDomForTranslator() {
  const w = window as unknown as { __czDomPatched?: boolean };
  if (w.__czDomPatched) return;
  w.__czDomPatched = true;
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };
  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return node;
    return insertBefore.call(this, node, ref) as T;
  };
}

function loadGoogleTranslate() {
  if (document.getElementById("cz-gt-script")) return;
  patchDomForTranslator();
  setGoogleCookie("/es/en");
  const holder = document.createElement("div");
  holder.id = "cz-gt";
  holder.style.display = "none";
  document.body.appendChild(holder);
  (window as unknown as { czGoogleInit: () => void }).czGoogleInit = () => {
    const g = (window as unknown as { google?: any }).google;
    if (!g?.translate?.TranslateElement) return;
    new g.translate.TranslateElement(
      { pageLanguage: "es", includedLanguages: "en", autoDisplay: false },
      "cz-gt"
    );
  };
  const script = document.createElement("script");
  script.id = "cz-gt-script";
  script.async = true;
  script.src = "https://translate.google.com/translate_a/element.js?cb=czGoogleInit";
  document.body.appendChild(script);
}

type LangContext = { lang: Lang; setLang: (lang: Lang) => void };
const Ctx = createContext<LangContext>({ lang: "es", setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Empieza en español igual que la página que manda el servidor; después lee
  // la elección guardada.
  const [lang, setLangState] = useState<Lang>("es");
  useEffect(() => {
    const saved = readLang();
    if (saved === "en") setLangState("en");
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === "en") loadGoogleTranslate();
  }, [lang]);
  const value = useMemo<LangContext>(
    () => ({
      lang,
      setLang: next => {
        if (next === lang) return;
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* sin almacenamiento: igual cambia en esta visita */
        }
        setGoogleCookie(next === "en" ? "/es/en" : null);
        // Recargar deja la página limpia (Google no sabe deshacer su traducción).
        location.reload();
      },
    }),
    [lang]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

/** `t("Carrito")` → «Cart» en inglés; si falta en el diccionario, queda en español. */
export function useT() {
  const { lang } = useContext(Ctx);
  return (es: string) => (lang === "en" ? (EN[es] ?? es) : es);
}
