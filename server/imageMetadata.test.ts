import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { exifOrientation, imageKind, stripImageMetadata } from "./services/imageMetadata";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

describe("quitar metadatos de las fotos", () => {
  it("JPEG: quita GPS, marca, modelo y comentario, y conserva la orientación", () => {
    const original = fixture("gps.jpg");
    expect(original.includes(Buffer.from("Galaxy S24"))).toBe(true);
    const clean = stripImageMetadata(original);
    expect(imageKind(clean)).toBe("jpeg");
    for (const text of ["Galaxy S24", "Samsung", "secreto"]) expect(clean.includes(Buffer.from(text))).toBe(false);
    // Sigue habiendo un Exif, pero solo con la orientación (6 = girada).
    const app1 = clean.indexOf(Buffer.from("Exif\0\0", "binary"));
    expect(app1).toBeGreaterThan(0);
    expect(exifOrientation(clean.subarray(app1))).toBe(6);
    expect(clean.length).toBeLessThan(original.length);
  });

  it("PNG: quita los textos (autor, GPS)", () => {
    const original = fixture("meta.png");
    expect(original.includes(Buffer.from("Juan Perez"))).toBe(true);
    const clean = stripImageMetadata(original);
    expect(imageKind(clean)).toBe("png");
    expect(clean.includes(Buffer.from("Juan Perez"))).toBe(false);
    expect(clean.includes(Buffer.from("IEND"))).toBe(true);
  });

  it("WEBP: quita el bloque EXIF y corrige el tamaño", () => {
    const original = fixture("meta.webp");
    expect(original.includes(Buffer.from("Galaxy S24"))).toBe(true);
    const clean = stripImageMetadata(original);
    expect(imageKind(clean)).toBe("webp");
    expect(clean.includes(Buffer.from("Galaxy S24"))).toBe(false);
    expect(clean.readUInt32LE(4)).toBe(clean.length - 8);
  });

  it("un archivo que no es imagen o está roto se devuelve igual", () => {
    const junk = Buffer.from("hola");
    expect(stripImageMetadata(junk)).toBe(junk);
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), Buffer.alloc(10)]);
    expect(stripImageMetadata(broken)).toBe(broken);
  });
});

describe("limpieza de las fotos ya guardadas", () => {
  it("limpia una vez y deja una marca para no repetirlo", async () => {
    const { mkdtemp, mkdir, copyFile, readFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { cleanStoredImagesOnce } = await import("./services/imageMetadata");
    const root = await mkdtemp(path.join(tmpdir(), "cz-fotos-"));
    await mkdir(path.join(root, "catalog", "products", "1"), { recursive: true });
    const target = path.join(root, "catalog", "products", "1", "a.jpg");
    await copyFile(new URL("./fixtures/gps.jpg", import.meta.url), target);
    expect(await cleanStoredImagesOnce(root)).toBe(1);
    expect((await readFile(target)).includes(Buffer.from("Galaxy S24"))).toBe(false);
    expect(await cleanStoredImagesOnce(root)).toBe(0);
    await rm(root, { recursive: true, force: true });
  });
});
