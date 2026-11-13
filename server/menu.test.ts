import { describe, expect, it } from "vitest";
import {
  defaultWeekHours,
  menuOptionGroup,
  openStatus,
  priceFor,
  type WeekHours,
} from "../shared/menu";

// Panamá es UTC-5 todo el año.
const at = (iso: string) => new Date(iso);

describe("menú de restaurante", () => {
  const combo = {
    priceCents: 650,
    sizes: [
      { name: "Mediano", priceCents: 650 },
      { name: "Grande", priceCents: 775 },
    ],
    optionGroups: [
      {
        name: "Acompañante",
        kind: "choice" as const,
        min: 1,
        max: 1,
        options: [
          { name: "Papas", priceCents: 0 },
          { name: "Yuca frita", priceCents: 50 },
        ],
      },
      {
        name: "Quitar",
        kind: "remove" as const,
        min: 0,
        max: 2,
        options: [
          { name: "Sin cebolla", priceCents: 0 },
          { name: "Sin tomate", priceCents: 0 },
        ],
      },
      {
        name: "Extras",
        kind: "extra" as const,
        min: 0,
        max: 3,
        options: [
          { name: "Queso", priceCents: 75 },
          { name: "Tocino", priceCents: 100 },
        ],
      },
    ],
  };

  it("suma tamaño, acompañante y extras", () => {
    const r = priceFor(combo, { size: 1, groups: [[1], [0], [0, 1]] });
    expect(r.ok).toBe(true);
    expect(r.cents).toBe(775 + 50 + 75 + 100);
  });

  it("pide lo obligatorio y respeta el máximo", () => {
    expect(priceFor(combo, { size: 0, groups: [[], [], []] }).ok).toBe(false);
    expect(priceFor(combo, { size: undefined, groups: [[0], [], []] }).ok).toBe(
      false
    );
    expect(priceFor(combo, { size: 0, groups: [[0], [0, 1], []] }).ok).toBe(
      true
    );
  });

  it("quitar ingredientes no puede tener precio", () => {
    expect(
      menuOptionGroup.safeParse({
        name: "Quitar",
        kind: "remove",
        min: 0,
        max: 1,
        options: [{ name: "Sin cebolla", priceCents: 10 }],
      }).success
    ).toBe(false);
  });

  it("abierto o cerrado según la hora de Panamá", () => {
    // Jueves 12/11/2026 15:00 en Panamá (20:00 UTC): abierto 11:00–21:00.
    expect(openStatus(defaultWeekHours, at("2026-11-12T20:00:00Z"))).toEqual({
      open: true,
      closesAt: "21:00",
    });
    // Jueves 08:00 Panamá: abre hoy a las 11:00.
    expect(openStatus(defaultWeekHours, at("2026-11-12T13:00:00Z"))).toEqual({
      open: false,
      opensLabel: "hoy a las 11:00",
    });
    // Sábado 23:00 Panamá: domingo cerrado, abre el lunes.
    expect(openStatus(defaultWeekHours, at("2026-11-15T04:00:00Z"))).toEqual({
      open: false,
      opensLabel: "el lunes a las 11:00",
    });
  });

  it("horario que pasa la medianoche", () => {
    const late: WeekHours = {
      ...defaultWeekHours,
      vie: { open: "18:00", close: "02:00" },
      sab: null,
    };
    // Sábado 01:00 Panamá (06:00 UTC): sigue abierto desde el viernes.
    expect(openStatus(late, at("2026-11-14T06:00:00Z"))).toEqual({
      open: true,
      closesAt: "02:00",
    });
  });
});
