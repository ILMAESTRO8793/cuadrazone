import { describe, expect, it } from "vitest";
import { mergeImportedResume, parseResumeText } from "../shared/cvImport";
import { saveResumeInput } from "../shared/jobs";

const SAMPLE = `ANA GÓMEZ PÉREZ
Cajera y atención al cliente
Panamá Oeste · +507 6123-4567 · ana.gomez@gmail.com
instagram.com/ana.gomez_pa

PERFIL PROFESIONAL
Persona responsable con 5 años de experiencia en supermercados.
Me gusta trabajar en equipo.

EXPERIENCIA LABORAL
Cajera · Super 99
Marzo 2021 - Actualidad
• Manejo de caja y cierres diarios
• Atención al cliente
Vendedora
Tienda La Moda
2018 - 2021
Ventas de ropa y control de inventario

EDUCACIÓN
Licenciatura en Administración de Empresas
Universidad de Panamá, 2020
Bachiller en Comercio - IPT de Arraiján (2015)

CURSOS Y CERTIFICACIONES
Excel avanzado - INADEH 2022

HABILIDADES
Excel, Trabajo en equipo, Manejo de caja

IDIOMAS
Español: nativo
Inglés: intermedio (B1)

REFERENCIAS
Luis Pérez - Supervisor Super 99 - 6222-3333
`;

describe("importar CV desde el texto de un PDF", () => {
  const cv = parseResumeText(SAMPLE);

  it("saca nombre, oficio y contacto", () => {
    expect(cv.fullName).toBe("Ana Gómez Pérez");
    expect(cv.headline).toBe("Cajera y atención al cliente");
    expect(cv.phone).toBe("+50761234567");
    expect(cv.email).toBe("ana.gomez@gmail.com");
    expect(cv.province).toBe("Panamá Oeste");
    expect(cv.instagramUrl).toBe("https://www.instagram.com/ana.gomez_pa");
    expect(cv.summary).toContain("5 años de experiencia");
  });

  it("separa la experiencia por fechas", () => {
    expect(cv.experience).toHaveLength(2);
    expect(cv.experience![0]).toMatchObject({ role: "Cajera", company: "Super 99", start: "2021-03", current: true, end: null });
    expect(cv.experience![0]!.description).toContain("Manejo de caja");
    expect(cv.experience![1]).toMatchObject({ role: "Vendedora", company: "Tienda La Moda", start: "2018-01", end: "2021-01", current: false });
    expect(cv.experience![1]!.description).toContain("inventario");
  });

  it("saca estudios, cursos, habilidades, idiomas y referencias", () => {
    expect(cv.education).toEqual([
      { degree: "Licenciatura en Administración de Empresas", institution: "Universidad de Panamá", year: "2020" },
      { degree: "Bachiller en Comercio", institution: "IPT de Arraiján", year: "2015" },
    ]);
    expect(cv.courses).toEqual([{ name: "Excel avanzado", institution: "INADEH", year: "2022" }]);
    expect(cv.skills).toEqual(expect.arrayContaining(["Excel", "Trabajo en equipo", "Manejo de caja"]));
    expect(cv.languages).toEqual([
      { language: "Español", level: "nativo" },
      { language: "Inglés", level: "intermedio" },
    ]);
    expect(cv.references).toEqual([{ name: "Luis Pérez", role: "Supervisor Super 99", phone: "6222-3333".replace(/\s/g, "") }]);
  });

  it("el CV que resulta se puede guardar", () => {
    const empty = saveResumeInput.parse({ fullName: "xxx", headline: "xxx", phone: "+50760000000", province: "Panamá" });
    const merged = mergeImportedResume({ ...empty, fullName: "", headline: "", phone: "" }, cv);
    expect(saveResumeInput.safeParse(merged).success).toBe(true);
  });

  it("no pisa lo que la persona ya escribió y no repite habilidades", () => {
    const base = saveResumeInput.parse({ fullName: "Ana G.", headline: "Cajera", phone: "+50769999999", province: "Panamá", skills: ["Excel"] });
    const merged = mergeImportedResume(base, cv);
    expect(merged.fullName).toBe("Ana G.");
    expect(merged.phone).toBe("+50769999999");
    expect(merged.skills.filter(s => s === "Excel")).toHaveLength(1);
    expect(merged.experience).toHaveLength(2);
  });

  it("un texto sin nada útil no rompe", () => {
    expect(parseResumeText("")).toEqual({});
  });
});
