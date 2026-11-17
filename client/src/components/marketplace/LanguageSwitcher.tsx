import type { ComponentType } from "react";
import { useLang, useT, type Lang } from "@/lib/i18n";
import "./languageSwitcher.css";

/** Bandera de Estados Unidos (dibujada: los emojis de bandera no se ven en Windows). */
function FlagUS() {
  return (
    <svg viewBox="0 0 38 20" width="26" height="14" aria-hidden="true">
      <rect width="38" height="20" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map(i => (
        <rect key={i} y={(i * 20) / 13} width="38" height={20 / 13} fill="#fff" />
      ))}
      <rect width="15.2" height={(7 * 20) / 13} fill="#3C3B6E" />
      {Array.from({ length: 20 }, (_, n) => (
        <circle
          key={n}
          cx={1.3 + (n % 5) * 3.1 + (Math.floor(n / 5) % 2) * 1.5}
          cy={1.2 + Math.floor(n / 5) * 2.6}
          r="0.55"
          fill="#fff"
        />
      ))}
    </svg>
  );
}

/** Bandera de España. */
function FlagES() {
  return (
    <svg viewBox="0 0 30 20" width="21" height="14" aria-hidden="true">
      <rect width="30" height="20" fill="#AA151B" />
      <rect y="5" width="30" height="10" fill="#F1BF00" />
    </svg>
  );
}

const OPTIONS: { lang: Lang; flag: ComponentType; code: string; label: string }[] = [
  { lang: "en", flag: FlagUS, code: "EN", label: "Cambiar a inglés" },
  { lang: "es", flag: FlagES, code: "ES", label: "Cambiar a español" },
];

/** Botones de idioma: bandera de EE. UU. para inglés y de España para español. */
export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <div className="lang-switch" role="group" aria-label={t("Idioma")} translate="no">
      {OPTIONS.map(o => (
        <button
          key={o.lang}
          type="button"
          className={lang === o.lang ? "is-active" : ""}
          aria-pressed={lang === o.lang}
          aria-label={t(o.label)}
          title={t(o.label)}
          onClick={() => setLang(o.lang)}
        >
          <o.flag />
          <span>{o.code}</span>
        </button>
      ))}
    </div>
  );
}
