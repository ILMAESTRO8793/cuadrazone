import { useState } from "react";
import "./storeLogo.css";

/** «Dulces de Ana» → «DA»: marca de la tienda mientras no tenga logo. */
export function initialsOf(name: string) {
  const words = name
    .split(/\s+/)
    .filter(word => /^[\p{L}\p{N}]/u.test(word));
  if (!words.length) return "?";
  const picked = words.length > 1 ? [words[0]!, words.at(-1)!] : words;
  return picked.map(word => word[0]!.toUpperCase()).join("");
}

/** Logo de la tienda en un círculo; sin logo (o si no carga) muestra las iniciales. */
export function StoreLogo({
  name,
  logoUrl,
  size = 44,
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.36 };
  if (logoUrl && !broken)
    return (
      <img
        className={`store-logo ${className}`}
        src={logoUrl}
        alt={`Logo de ${name}`}
        width={size}
        height={size}
        loading="lazy"
        style={style}
        onError={() => setBroken(true)}
      />
    );
  return (
    <span
      className={`store-logo store-logo-initials ${className}`}
      aria-hidden="true"
      style={style}
    >
      {initialsOf(name)}
    </span>
  );
}
