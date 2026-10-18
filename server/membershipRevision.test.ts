import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, saveApplicationInput } from "@shared/membership";
import { assertConsentVersion, assertDraftRevision } from "./services/membership";

describe("Membership consent and optimistic edits — memory only", () => {
  it("rejects old consent versions and accepts the current version", () => {
    expect(() => assertConsentVersion("borrador-anterior")).toThrow("versión vigente");
    expect(() => assertConsentVersion(CONSENT_VERSION)).not.toThrow();
    expect(saveApplicationInput.shape.consentVersion.safeParse("borrador-anterior").success).toBe(false);
    expect(saveApplicationInput.shape.consentVersion.safeParse(CONSENT_VERSION).success).toBe(true);
  });
  it("requires the actual editing revision for an existing draft", () => {
    expect(() => assertDraftRevision(3, undefined)).toThrow("otra sesión");
    expect(() => assertDraftRevision(3, 2)).toThrow("otra sesión");
    expect(() => assertDraftRevision(3, 3)).not.toThrow();
  });
  it("does not overwrite a concurrent new application", () => {
    expect(() => assertDraftRevision(null, undefined)).not.toThrow();
    expect(() => assertDraftRevision(null, 1)).toThrow("otra sesión");
    expect(() => assertDraftRevision(1, undefined)).toThrow("otra sesión");
  });
});
