import { describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({ getDb: async () => null }));

/** Arma un PDF mínimo con una línea de texto por renglón. */
function makePdf(lines: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, m => `\\${m}`);
  const stream = `BT /F1 12 Tf 50 760 Td ${lines.map((l, i) => `${i ? "0 -16 Td " : ""}(${esc(l)}) Tj`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

describe("leer el texto de un CV en PDF", () => {
  it("saca las líneas del PDF y arma el CV", async () => {
    const { pdfText } = await import("./services/jobs");
    const { parseResumeText } = await import("../shared/cvImport");
    const text = await pdfText(
      makePdf([
        "CARLOS RIOS",
        "Tecnico en refrigeracion",
        "+507 6555-1212 carlos.rios@gmail.com",
        "EXPERIENCIA",
        "Tecnico - Frio Total",
        "2019 - Presente",
        "HABILIDADES",
        "Refrigeracion, Electricidad, Soldadura",
      ])
    );
    expect(text.split("\n").map(l => l.trim()).filter(Boolean)[0]).toBe("CARLOS RIOS");
    const cv = parseResumeText(text);
    expect(cv.fullName).toBe("Carlos Rios");
    expect(cv.phone).toBe("+50765551212");
    expect(cv.email).toBe("carlos.rios@gmail.com");
    expect(cv.experience?.[0]).toMatchObject({ role: "Tecnico", company: "Frio Total", start: "2019-01", current: true });
    expect(cv.skills).toEqual(expect.arrayContaining(["Refrigeracion", "Electricidad", "Soldadura"]));
  });
});
