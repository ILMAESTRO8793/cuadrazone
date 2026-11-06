import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { verseOfDay, type Verse } from "@/data/verses";

/*
 * Versículo del día en la barra superior. Cambia cada día de Panamá y se
 * desplaza en bucle; se detiene al pasar el ratón o al enfocarlo, y queda
 * quieto si el visitante pide menos movimiento.
 */
export default function VerseOfDay() {
  const [verse, setVerse] = useState<Verse>(() => verseOfDay());

  // Si la página queda abierta al cambiar de día, actualiza el versículo.
  useEffect(() => {
    const timer = setInterval(() => setVerse(verseOfDay()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const line = `“${verse.text}” — ${verse.ref}`;
  // Velocidad de lectura constante, sea largo o corto el versículo.
  const seconds = Math.max(22, Math.round(line.length * 0.32));

  return (
    <div className="verse-ticker" role="region" aria-label="Versículo del día">
      <span className="verse-ticker-label">
        <BookOpen size={14} aria-hidden="true" />
        Versículo del día
      </span>
      <div className="verse-ticker-viewport" tabIndex={0} title={line}>
        <div
          className="verse-ticker-track"
          style={{ animationDuration: `${seconds}s` }}
          suppressHydrationWarning
        >
          <span className="verse-ticker-item" suppressHydrationWarning>
            <q>{verse.text}</q> <cite>{verse.ref}</cite>
          </span>
          <span className="verse-ticker-item" aria-hidden="true" suppressHydrationWarning>
            <q>{verse.text}</q> <cite>{verse.ref}</cite>
          </span>
        </div>
      </div>
    </div>
  );
}
