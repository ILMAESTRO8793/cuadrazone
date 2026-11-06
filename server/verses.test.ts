import { describe, expect, it } from "vitest";
import { panamaDayNumber, verseOfDay, verses } from "../client/src/data/verses";

describe("versículo del día", () => {
  it("cambia de un día a otro y repite la lista al terminar", () => {
    const day = new Date("2026-11-06T15:00:00Z");
    const next = new Date("2026-11-07T15:00:00Z");
    expect(verseOfDay(day)).not.toEqual(verseOfDay(next));
    const later = new Date(day.getTime() + verses.length * 86_400_000);
    expect(verseOfDay(later)).toEqual(verseOfDay(day));
  });

  it("usa la medianoche de Panamá (UTC−5), no la de UTC", () => {
    // 23:30 en Panamá del día 6 sigue siendo el día 6 aunque en UTC ya sea el 7.
    const lateNight = new Date("2026-11-07T04:30:00Z");
    const evening = new Date("2026-11-06T20:00:00Z");
    expect(panamaDayNumber(lateNight)).toBe(panamaDayNumber(evening));
    const morning = new Date("2026-11-07T05:30:00Z");
    expect(panamaDayNumber(morning)).toBe(panamaDayNumber(evening) + 1);
  });

  it("todos los versículos tienen texto y referencia, sin repetir referencia", () => {
    const refs = new Set<string>();
    for (const verse of verses) {
      expect(verse.text.trim().length).toBeGreaterThan(10);
      expect(verse.ref).toMatch(/^[1-3]? ?[A-ZÁÉÍÓÚ][a-záéíóúñ]+ \d+:\d+(-\d+)?$/);
      expect(refs.has(verse.ref)).toBe(false);
      refs.add(verse.ref);
    }
  });
});
