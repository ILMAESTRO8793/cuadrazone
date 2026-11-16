import { describe, expect, it } from "vitest";
import { misplacedListing } from "../shared/commerceGuard";

const kind = (title: string, description = "", category = "") =>
  misplacedListing({ title, description, category })?.kind ?? null;

describe("Comercios rechaza lo que tiene su propia sección", () => {
  it("inmuebles", () => {
    expect(kind("Casa en venta en Chitré", "3 recámaras, 2 baños")).toBe(
      "inmueble"
    );
    expect(kind("Se alquila apartamento amueblado")).toBe("inmueble");
    expect(
      kind("Terreno de 800 m2 en Penonomé", "con título de propiedad")
    ).toBe("inmueble");
    expect(kind("Local comercial en alquiler")).toBe("inmueble");
  });

  it("vehículos", () => {
    expect(kind("Toyota Corolla 2018", "automático, 60,000 km")).toBe("auto");
    expect(kind("Vendo carro Hyundai Accent")).toBe("auto");
    expect(kind("Moto Yamaha en venta")).toBe("auto");
    expect(kind("Camioneta 4x4 diésel", "transmisión mecánica")).toBe("auto");
  });

  it("vacantes", () => {
    expect(kind("Se solicita cajera", "medio tiempo")).toBe("vacante");
    expect(kind("Vacante: asistente de ventas")).toBe("vacante");
    expect(kind("Estamos contratando cocineros")).toBe("vacante");
  });

  it("restaurantes", () => {
    expect(kind("Menú del día: arroz con pollo")).toBe("restaurante");
    expect(kind("Almuerzos ejecutivos a domicilio")).toBe("restaurante");
    expect(kind("Restaurante El Buen Sabor")).toBe("restaurante");
  });

  it("sí son de Comercios", () => {
    for (const title of [
      "Cargador para auto USB",
      "Llantas para carro rin 15",
      "Repuestos Toyota Hilux",
      "Filtro de aceite Honda",
      "Carro de juguete a control remoto",
      "Casa de muñecas de madera",
      "Decoración para la casa",
      "Juego de sábanas para el hogar",
      "Pastel de chocolate",
      "Bizcocho de naranja casero",
      "Biblia Reina-Valera 1960",
      "Zapatos deportivos talla 40",
      "Maqueta de camión escala 1:24",
      "Alfombras para auto",
    ])
      expect(kind(title, "Vendo, nuevo y original"), title).toBeNull();
  });

  it("explica dónde registrarlo", () => {
    const r = misplacedListing({ title: "Casa en venta" });
    expect(r?.message).toContain("Bienes raíces");
    expect(r?.href).toBe("/bienes-raices/mis-anuncios");
  });
});
