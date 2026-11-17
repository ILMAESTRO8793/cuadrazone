import { describe, expect, it } from "vitest";
import {
  SALARY_REQUIRED_MESSAGE,
  bonusLabel,
  salaryLabel,
  saveJobInput,
  saveResumeInput,
  withResumeDefaults,
} from "../shared/jobs";
import { netSalary } from "../shared/netSalary";

const job = {
  title: "Vendedora de mostrador", company: "Artesanías Chilibre", area: "ventas", jobType: "tiempo_completo", modality: "presencial",
  province: "Panamá", district: "Panamá", salaryMinCents: 70000, salaryMaxCents: 90000, salaryPeriod: "mes",
  description: "Atención a clientes, manejo de caja y orden de la tienda en horario de lunes a sábado.", closesOn: "2026-12-31",
};

describe("vacantes", () => {
  it("acepta una vacante con sueldo base y bonos opcionales", () => {
    expect(saveJobInput.safeParse(job).success).toBe(true);
    expect(saveJobInput.safeParse({ ...job, bonusCents: 15000, bonusDetail: "Comisión por ventas" }).success).toBe(true);
  });
  it("sin sueldo base no se puede publicar", () => {
    const r = saveJobInput.safeParse({ ...job, salaryMinCents: null, salaryMaxCents: null });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(SALARY_REQUIRED_MESSAGE);
    expect(saveJobInput.safeParse({ ...job, salaryMinCents: 0 }).success).toBe(false);
    // «A convenir» ya no existe.
    expect(saveJobInput.safeParse({ ...job, salaryNegotiable: true }).success).toBe(false);
  });
  it("el máximo no puede ser menor y la descripción no puede ser corta", () => {
    expect(saveJobInput.safeParse({ ...job, salaryMaxCents: 50000 }).success).toBe(false);
    expect(saveJobInput.safeParse({ ...job, description: "corta" }).success).toBe(false);
  });
  it("muestra el sueldo y los bonos", () => {
    expect(salaryLabel({ salaryMinCents: 70000, salaryMaxCents: 90000, salaryPeriod: "mes" })).toBe("US$700 – US$900 al mes");
    expect(salaryLabel({ salaryMinCents: 500, salaryMaxCents: null, salaryPeriod: "hora" })).toBe("US$5 por hora");
    expect(bonusLabel({ bonusCents: 15000, bonusDetail: "comisión por ventas" })).toBe("Bonos de hasta US$150: comisión por ventas");
    expect(bonusLabel({ bonusCents: null, bonusDetail: "" })).toBe("");
  });
});

describe("salario neto en Panamá", () => {
  it("sin ISR hasta US$11,000 al año (con el décimo tercer mes)", () => {
    const r = netSalary(80000);
    expect(r.cssCents).toBe(7800);
    expect(r.educationCents).toBe(1000);
    expect(r.incomeTaxCents).toBe(0);
    expect(r.netCents).toBe(71200);
    expect(r.netQuincenaCents).toBe(35600);
  });
  it("15% sobre lo que pasa de US$11,000", () => {
    // 1,000 × 13 = 13,000 → (13,000 − 11,000) × 15% = 300 al año → 23.08 por pago.
    const r = netSalary(100000);
    expect(r.incomeTaxCents).toBe(2308);
    expect(r.netCents).toBe(100000 - 9750 - 1250 - 2308);
  });
  it("US$5,850 más 25% sobre lo que pasa de US$50,000", () => {
    // 5,000 × 13 = 65,000 → 5,850 + 15,000 × 25% = 9,600 al año → 738.46 por pago.
    expect(netSalary(500000).incomeTaxCents).toBe(73846);
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
      instagramUrl: "https://www.instagram.com/ana",
      facebookUrl: "https://www.facebook.com/ana",
      preferredModalities: ["presencial", "hibrido"],
      canTravel: true,
      courses: [{ name: "Excel avanzado", institution: "INADEH", year: "2024" }],
      driverLicenses: ["auto"],
      vehicles: ["carro"],
      expectedSalaryCents: 80000,
      references: [{ name: "Luis Pérez", role: "Supervisor", phone: "+50762223333" }],
    }).success).toBe(true);
  });
  it("valida celular, fechas, enlaces y campos desconocidos", () => {
    expect(saveResumeInput.safeParse({ ...cv, phone: "123" }).success).toBe(false);
    expect(saveResumeInput.safeParse({ ...cv, experience: [{ company: "X", role: "Y", start: "marzo" }] }).success).toBe(false);
    expect(saveResumeInput.safeParse({ ...cv, extra: 1 }).success).toBe(false);
    expect(saveResumeInput.safeParse({ ...cv, instagramUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(saveResumeInput.safeParse({ ...cv, driverLicenses: ["avion"] }).success).toBe(false);
    // La foto no se manda con el CV: se sube aparte.
    expect(saveResumeInput.safeParse({ ...cv, photoUrl: "https://x" }).success).toBe(false);
  });
  it("completa las copias viejas del CV", () => {
    const old = withResumeDefaults({ fullName: "Ana" });
    expect(old.courses).toEqual([]);
    expect(old.references).toEqual([]);
    expect(old.photoUrl).toBe("");
  });
});
