import { describe, expect, it } from "vitest";
import { isShowcaseLive, saveShowcaseInput } from "@shared/showcase";

describe("vitrina de las secciones", () => {
  it("respeta activo y fechas", () => {
    expect(isShowcaseLive({ active: true, startsOn: "", endsOn: "" }, "2026-11-11")).toBe(true);
    expect(isShowcaseLive({ active: false, startsOn: "", endsOn: "" }, "2026-11-11")).toBe(false);
    expect(isShowcaseLive({ active: true, startsOn: "2026-11-12", endsOn: "" }, "2026-11-11")).toBe(false);
    expect(isShowcaseLive({ active: true, startsOn: "", endsOn: "2026-11-10" }, "2026-11-11")).toBe(false);
  });
  it("no acepta enlaces a otros sitios sin https", () => {
    const base = { section: "servicios", zone: "producto", title: "Oferta", active: true };
    expect(saveShowcaseInput.safeParse({ ...base, linkUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(saveShowcaseInput.safeParse({ ...base, linkUrl: "//otro.com" }).success).toBe(false);
    expect(saveShowcaseInput.safeParse({ ...base, linkUrl: "/producto/torta" }).success).toBe(true);
  });
});
