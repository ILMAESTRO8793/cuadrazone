import { safePlanReturnPath } from "../shared/const";
import { describe, expect, it } from "vitest";
import { renderPage } from "../client/src/entry-server";
import { getPageMeta } from "../client/src/lib/pageMeta";
import { SELLER_PLANS, SELLER_MONTHLY_FEE_CENTS, sellerPlanIds, selectSellerPlanInput, PLAN_CATALOG_VERSION, sellerPlanLabel } from "../shared/pricing";

describe("Oferta de dos planes", () => {
  it("keeps Normal as its own plan and exact prices in cents", () => {
    expect(sellerPlanIds).toEqual(["normal", "mayor_visibilidad"]);
    expect(SELLER_PLANS.normal.monthlyCents).toBe(1999);
    expect(SELLER_PLANS.mayor_visibilidad.monthlyCents).toBe(3999);
    expect(SELLER_MONTHLY_FEE_CENTS).toBe(1999);
    expect(sellerPlanLabel("normal")).toBe("US$19.99");
    expect(sellerPlanLabel("mayor_visibilidad")).toBe("US$39.99");
  });
  it("shows both plans with buyer free, links and honest pending benefits", () => {
    const html = renderPage("/suscripciones").html;
    for (const value of ["Normal", "Mayor Visibilidad", "US$19.99", "US$39.99", "Gratis", "no se suman", "Destacado — ubicación de pago", "acreditación real", "3 meses gratis", "/vendedor/plan?plan=normal", "/vendedor/plan?plan=mayor_visibilidad"]) expect(html).toContain(value);
    expect(html).not.toContain("US$59.98");
    expect(html).not.toContain("USD 2.99");
  });
  it("keeps pricing in home and sell entry without changing the logo", () => {
    for (const route of ["/", "/vender"]) {
      const html = renderPage(route).html;
      expect(html).toContain("19.99");
      expect(html).toContain("39.99");
      expect(html).toContain("/assets/logo-carrito-blanco.png");
    }
  });
  it("protects selection and does not expose a saved plan in public SSR", () => {
    const route = "/vendedor/plan?plan=mayor_visibilidad";
    expect(getPageMeta(route).private).toBe(true);
    expect(renderPage(route).html).toContain("Preparando tu cuenta");
    expect(renderPage(route).html).not.toContain("Preferencia guardada:");
  });
  it("only accepts known plans, version and an explicit non-payment acknowledgement", () => {
    const input = { planId: "normal", expectedRevision: 0, catalogVersion: PLAN_CATALOG_VERSION, acknowledgePending: true };
    expect(selectSellerPlanInput.parse(input).planId).toBe("normal");
    for (const invalid of [{ ...input, planId: "premium" }, { ...input, catalogVersion: "old" }, { ...input, acknowledgePending: false }, { ...input, monthlyCents: 1 }, { ...input, subscriptionStatus: "active" }, { ...input, userId: 55 }, { ...input, expectedRevision: -1 }]) expect(selectSellerPlanInput.safeParse(invalid).success).toBe(false);
  });
});

describe("Retorno seguro al plan", () => {
  it("preserves only the explicit internal plan routes after login", () => {
    for (const route of ["/vendedor/plan", "/vendedor/plan?plan=normal", "/vendedor/plan?plan=mayor_visibilidad"]) expect(safePlanReturnPath(route)).toBe(route);
    for (const value of [undefined, "https://attacker.invalid", "//attacker.invalid", "/vendedor/plan?plan=other", "/vendedor/plan?plan=normal&redirect=https://attacker.invalid", "/admin", "/vendedor/plan/../admin"]) expect(safePlanReturnPath(value)).toBe("/");
  });
});
