import { describe, expect, it } from "vitest";
import { salaryLabel, saveJobInput, saveResumeInput } from "../shared/jobs";

const job = {
  title: "Vendedora de mostrador", company: "Artesanías Chilibre", area: "ventas", jobType: "tiempo_completo", modality: "presencial",
  province: "Panamá", district: "Panamá", salaryMinCents: 70000, salaryMaxCents: 90000, salaryPeriod: "mes",
  description: "Atención a clientes, manejo de caja y orden de la tienda en horario de lunes a sábado.", closesOn: "2026-12-31",
};

describe("vacantes", () => {
  it("acepta una vacante con salario o a convenir", () => {
    expect(saveJobInput.safeParse(job).success).toBe(true);
    expect(saveJobInput.safeParse({ ...job, salaryMinCents: null, salaryMaxCents: null, salaryNegotiable: true }).success).toBe(true);
  });
  it("exige salario si no es a convenir, y el máximo no puede ser menor", () => {
    expect(saveJobInput.safeParse({ ...job, salaryMinCents: null }).success).toBe(false);
    expect(saveJobInput.safeParse({ ...job, salaryMaxCents: 50000 }).success).toBe(false);
    expect(saveJobInput.safeParse({ ...job, description: "corta" }).success).toBe(false);
  });
  it("muestra el salario", () => {
    expect(salaryLabel({ salaryNegotiable: false, salaryMinCents: 70000, salaryMaxCents: 90000, salaryPeriod: "mes" })).toBe("US$700 – US$900 al mes");
    expect(salaryLabel({ salaryNegotiable: false, salaryMinCents: 500, salaryMaxCents: null, salaryPeriod: "hora" })).toBe("US$5 por hora");
    expect(salaryLabel({ salaryNegotiable: true, salaryMinCents: null, salaryMaxCents: null, salaryPeriod: "mes" })).toBe("Salario a convenir");
  });
});

describe("CV", () => {
  const cv = { fullName: "Ana Gómez", headline: "Cajera con experiencia", phone: "+50761234567", province: "Panamá" };
  it("acepta un CV mínimo y uno completo", () => {
    expect(saveResumeInput.safeParse(cv).success).toBe(true);
    expect(saveResumeInput.safeParse({
      ...cv,
      experience: [{ company: "Súper 99", role: "Cajera", start: "2021-03", end: null, current: true, description: "Caja y atención" }],
      education: [{ institution: "IPT", degree: "Bachiller en Comercio", year: "2018" }],
      skills: ["Excel", "Atención al cliente"],
      languages: [{ language: "Inglés", level: "intermedio" }],
    }).success).toBe(true);
  });
  it("valida celular, fechas y campos desconocidos", () => {
    expect(saveResumeInput.safeParse({ ...cv, phone: "123" }).success).toBe(false);
    expect(saveResumeInput.safeParse({ ...cv, experience: [{ company: "X", role: "Y", start: "marzo" }] }).success).toBe(false);
    expect(saveResumeInput.safeParse({ ...cv, extra: 1 }).success).toBe(false);
  });
});
