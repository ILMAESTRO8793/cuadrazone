import { describe, expect, it } from "vitest";
import { footerLegalLinks, legalDocs, legalOrder } from "../client/src/data/legal";
import { getPageMeta } from "../client/src/lib/pageMeta";
import { sellerPlanLabel } from "../shared/pricing";

describe("documentos legales", () => {
  it("cada documento listado existe, tiene fecha y apartados con contenido", () => {
    for (const key of legalOrder) {
      const doc = legalDocs[key];
      expect(doc, key).toBeTruthy();
      expect(doc.updated).toMatch(/\d{1,2} de [a-z]+ de 20\d\d/);
      expect(doc.sections.length).toBeGreaterThan(2);
      for (const section of doc.sections) {
        expect((section.body?.length ?? 0) + (section.list?.length ?? 0)).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(legalDocs).sort()).toEqual([...legalOrder].sort());
  });

  it("las condiciones usan los mismos precios de planes que se cobran", () => {
    const text = legalDocs.terminos.sections.flatMap(s => s.body ?? []).join(" ");
    expect(text).toContain(sellerPlanLabel("normal"));
    expect(text).toContain(sellerPlanLabel("mayor_visibilidad"));
  });

  it("la privacidad declara que el nombre de la iglesia puede ser público", () => {
    const text = legalDocs.privacidad.sections.flatMap(s => s.body ?? []).join(" ");
    expect(text).toContain("nombre de la iglesia");
  });

  it("cada página legal responde 200 con su título y las desconocidas 404", () => {
    for (const key of legalOrder) {
      const meta = getPageMeta(`/legal/${key}`);
      expect(meta.status).toBe(200);
      expect(meta.title).toContain(legalDocs[key].title);
    }
    expect(getPageMeta("/legal/no-existe").status).toBe(404);
    for (const link of footerLegalLinks) {
      expect(getPageMeta(link.href).status).toBe(200);
    }
  });
});
