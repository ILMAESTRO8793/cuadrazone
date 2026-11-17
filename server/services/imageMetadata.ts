/**
 * Quita los metadatos de las fotos antes de guardarlas: ubicación GPS, modelo
 * del teléfono, fechas, comentarios, IPTC y XMP. De los JPEG se conserva solo la
 * orientación, para que las fotos verticales no salgan giradas.
 *
 * No cambia los píxeles. Si el archivo viene mal formado, se devuelve igual
 * (ya pasó la validación de tipo y firma).
 */

const JPEG_SOI = 0xffd8;

/** Detecta el formato por la firma, sin fiarse del tipo que dice el navegador. */
export function imageKind(bytes: Buffer): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export function stripImageMetadata(bytes: Buffer): Buffer {
  try {
    switch (imageKind(bytes)) {
      case "jpeg":
        return stripJpeg(bytes);
      case "png":
        return stripPng(bytes);
      case "webp":
        return stripWebp(bytes);
      default:
        return bytes;
    }
  } catch {
    return bytes;
  }
}

// ───────────── JPEG ─────────────

/** Orientación (1 a 8) dentro de un segmento APP1 «Exif», o null. */
export function exifOrientation(app1: Buffer): number | null {
  if (app1.toString("binary", 0, 6) !== "Exif\0\0") return null;
  const tiff = app1.subarray(6);
  const little = tiff.toString("ascii", 0, 2) === "II";
  if (!little && tiff.toString("ascii", 0, 2) !== "MM") return null;
  const u16 = (o: number) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = u32(4);
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/** Un segmento APP1 Exif mínimo que solo dice la orientación. */
function orientationSegment(orientation: number): Buffer {
  const body = Buffer.alloc(32);
  body.write("Exif\0\0", 0, "binary");
  body.write("MM", 6, "ascii");
  body.writeUInt16BE(42, 8);
  body.writeUInt32BE(8, 10); // IFD0 justo después del encabezado TIFF
  body.writeUInt16BE(1, 14); // una sola entrada
  body.writeUInt16BE(0x0112, 16); // Orientation
  body.writeUInt16BE(3, 18); // SHORT
  body.writeUInt32BE(1, 20);
  body.writeUInt16BE(orientation, 24);
  body.writeUInt32BE(0, 28); // sin más IFD
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([header, body]);
}

function stripJpeg(bytes: Buffer): Buffer {
  if (bytes.readUInt16BE(0) !== JPEG_SOI) return bytes;
  const out: Buffer[] = [bytes.subarray(0, 2)];
  let orientation: number | null = null;
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) return bytes; // estructura inesperada: no se toca
    const marker = bytes[pos + 1]!;
    // Inicio de los datos de la imagen: de aquí en adelante se copia tal cual.
    if (marker === 0xda) {
      out.push(bytes.subarray(pos));
      break;
    }
    const length = bytes.readUInt16BE(pos + 2);
    const end = pos + 2 + length;
    if (length < 2 || end > bytes.length) return bytes;
    const segment = bytes.subarray(pos, end);
    const data = bytes.subarray(pos + 4, end);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    // Se quedan: APP0 (JFIF), APP2 (perfil de color ICC), APP14 (Adobe) y todo lo que no es APP/comentario.
    const keep = !isApp ? marker !== 0xfe : marker === 0xe0 || marker === 0xe2 || marker === 0xee;
    if (marker === 0xe1 && orientation === null) orientation = exifOrientation(data);
    if (keep) out.push(segment);
    pos = end;
  }
  if (orientation && orientation !== 1) {
    // Va después del encabezado JFIF (APP0) si lo hay, como pide el estándar.
    const afterJfif = out[1] && out[1][0] === 0xff && out[1][1] === 0xe0 ? 2 : 1;
    out.splice(afterJfif, 0, orientationSegment(orientation));
  }
  return Buffer.concat(out);
}

// ───────────── PNG ─────────────

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(bytes: Buffer): Buffer {
  const out: Buffer[] = [bytes.subarray(0, 8)];
  let pos = 8;
  while (pos + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.toString("ascii", pos + 4, pos + 8);
    const end = pos + 12 + length;
    if (end > bytes.length) return bytes;
    if (!PNG_DROP.has(type)) out.push(bytes.subarray(pos, end));
    pos = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

// ───────────── WEBP ─────────────

function stripWebp(bytes: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const fourcc = bytes.toString("ascii", pos, pos + 4);
    const size = bytes.readUInt32LE(pos + 4);
    const end = pos + 8 + size + (size % 2);
    if (pos + 8 + size > bytes.length) return bytes;
    if (fourcc !== "EXIF" && fourcc !== "XMP ") {
      const chunk = Buffer.from(bytes.subarray(pos, Math.min(end, bytes.length)));
      // VP8X avisa con banderas si hay EXIF (0x08) o XMP (0x04): se apagan.
      if (fourcc === "VP8X" && chunk.length > 8) chunk[8] = chunk[8]! & ~0x0c;
      chunks.push(chunk);
    }
    pos = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "ascii");
  return Buffer.concat([header, body]);
}
