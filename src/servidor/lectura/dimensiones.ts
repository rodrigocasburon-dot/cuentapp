// Dimensiones de una imagen leyendo solo su cabecera (sin decodificarla).
// Sirve para no mandar al OCR una «bomba de descompresión»: un PNG de pocos
// MB que al abrirlo ocupa varios GB (revisión de seguridad M5).

export const MAX_PIXELES = 40_000_000; // igual que en lectura-py/servicio_ocr.py

export function dimensiones(b: Uint8Array): { ancho: number; alto: number } | null {
  const u16be = (i: number) => (b[i] << 8) | b[i + 1];
  const u32be = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const ascii = (i: number, t: string) => [...t].every((c, k) => b[i + k] === c.charCodeAt(0));

  // PNG: cabecera IHDR justo después de la firma
  if (b[0] === 0x89 && ascii(1, "PNG") && ascii(12, "IHDR")) return { ancho: u32be(16), alto: u32be(20) };

  // JPEG: recorrer los segmentos hasta un SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marca = b[i + 1];
      if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) return { alto: u16be(i + 5), ancho: u16be(i + 7) };
      i += 2 + u16be(i + 2);
    }
    return null;
  }

  // WebP: VP8X (extendido), VP8L (sin pérdida) o VP8 (con pérdida)
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) {
    if (ascii(12, "VP8X")) return { ancho: u24le(24) + 1, alto: u24le(27) + 1 };
    if (ascii(12, "VP8L")) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { ancho: (bits & 0x3fff) + 1, alto: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (ascii(12, "VP8 ")) return { ancho: (b[26] | (b[27] << 8)) & 0x3fff, alto: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  return null;
}

/** ¿Es una imagen demasiado grande para leerla con seguridad? (Si no se sabe, no.) */
export function imagenDemasiadoGrande(b: Uint8Array): boolean {
  const d = dimensiones(b);
  return d !== null && d.ancho * d.alto > MAX_PIXELES;
}
