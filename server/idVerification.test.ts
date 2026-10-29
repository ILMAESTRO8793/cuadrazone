import { describe, expect, it } from "vitest";
import { checkIdentityText, checkPayoutText, evaluateDocuments, nameKeyOf } from "./services/idVerification";

const me = { givenNames: "Salem Jean", surnames: "Pierre Dupont", idNumber: "8-888-1234" };
const cedula = "REPÚBLICA DE PANAMÁ\nTRIBUNAL ELECTORAL\nSALEM JEAN\nPIERRE DUPONT\nNOMBRE USUAL: SALEM PIERRE\nEXPIRA: 15-ENE-2031\n8-888-1234";

describe("cédula", () => {
  it("coincide con nombre, apellidos y número", () => {
    expect(checkIdentityText(cedula, me)).toEqual({ status: "ok", reasons: [] });
  });
  it("tolera tildes y un error de lectura en nombres largos", () => {
    expect(checkIdentityText(cedula.replace("DUPONT", "DUP0NT"), { ...me, surnames: "Piérre Dupont" }).status).toBe("ok");
  });
  it("rechaza otro número, otro nombre o una imagen ilegible", () => {
    expect(checkIdentityText(cedula, { ...me, idNumber: "8-888-9999" }).reasons[0]).toMatch(/número de cédula/);
    expect(checkIdentityText(cedula, { ...me, givenNames: "Carlos" }).reasons[0]).toMatch(/CARLOS/);
    expect(checkIdentityText("", me).reasons[0]).toMatch(/No pudimos leer/);
  });
});

describe("captura de Yappy o banco", () => {
  for (const ok of ["SALEM J PIERRE D", "Salem Pierre", "SALEM PIERRE DUPONT", "SALEM JEAN PIERRE DUPONT", "SALEM J. P.", "Yappy\nMi perfil\nSALEM J PIERRE D\n+507 6123-4567"]) {
    it(`acepta «${ok.split("\n").pop()}»`, () => expect(checkPayoutText(ok, me).status).toBe("ok"));
  }
  for (const bad of ["CARLOS PIERRE", "SALEM GOMEZ", "PIERRE SALEM", "SALEM", "MARIA SALEM PIERRE", "SALEM J PIERRE D LOPEZ"]) {
    it(`rechaza «${bad}»`, () => expect(checkPayoutText(bad, me).status).toBe("fail"));
  }
});

describe("evaluación completa", () => {
  const png = (text: string) => ({ id: 1, mimeType: "image/png", bytes: Buffer.from(text) });
  const reader = async (b: Buffer) => b.toString();
  it("verde si las dos imágenes coinciden", async () => {
    const r = await evaluateDocuments({ ...me, identity: png(cedula), payout: { ...png("SALEM J PIERRE D"), id: 2 } }, reader);
    expect([r.identity.status, r.payout.status]).toEqual(["ok", "ok"]);
    expect(r.nameKey).toBe(nameKeyOf(me.givenNames, me.surnames, me.idNumber));
  });
  it("un PDF va a revisión manual y un faltante pide subirlo", async () => {
    const r = await evaluateDocuments({ ...me, identity: { id: 1, mimeType: "application/pdf", bytes: Buffer.from("x") }, payout: null }, reader);
    expect(r.identity.status).toBe("manual");
    expect(r.payout.status).toBe("fail");
  });
  it("si el lector falla, no aprueba", async () => {
    const r = await evaluateDocuments({ ...me, identity: png(cedula), payout: png("x") }, async () => { throw new Error("caído"); });
    expect(r.identity.status).toBe("manual");
  });
});
