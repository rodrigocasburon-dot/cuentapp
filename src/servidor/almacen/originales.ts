// Almacén de ORIGINALES (RF-03, RF-08). Reglas:
//   1. El original se guarda tal cual llegó, byte a byte. Nunca se modifica.
//   2. Su nombre es su SHA-256: originales/<empresa>/<sha256>.<ext>.
//      Si el mismo fichero llega dos veces, ocupa un único original.
//   3. Se escribe de forma atómica (fichero temporal + enlace): nunca queda
//      un original a medias. Después se marca como solo lectura.
//   4. Al leerlo se comprueba el hash: si no coincide, no se sirve.
//
// Producción: aquí iría Supabase Storage con políticas por empresa (ver SUPUESTOS.md).

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CARPETA_ORIGINALES } from "@/config";

export interface TipoArchivo {
  mime: string;
  ext: string;
}

export const MIME_SVG = "image/svg+xml";

/**
 * ¿Es un SVG? Texto XML cuyo primer elemento es <svg>. Un SVG puede llevar
 * código (scripts) que se ejecutaría al abrirlo: se admite, pero NUNCA se
 * muestra en la web, solo se descarga (servir-original.ts), y no pasa por
 * el OCR (D-40).
 */
function esSvg(bytes: Uint8Array): boolean {
  let texto = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 4096));
  texto = texto.replace(/^﻿/, "");
  // Quitamos la declaración XML, comentarios y DOCTYPE del principio
  for (let previo = ""; previo !== texto; ) {
    previo = texto;
    texto = texto.replace(/^\s+/, "").replace(/^<\?xml[\s\S]*?\?>/, "").replace(/^<!--[\s\S]*?-->/, "").replace(/^<!DOCTYPE\s+svg[^>]*>/i, "");
  }
  return /^<svg[\s>]/.test(texto);
}

/**
 * Detecta el tipo por los primeros bytes ("número mágico"), NO por la
 * extensión ni por lo que diga el navegador, que se pueden falsear.
 * Admitimos PDF, JPEG, PNG, WebP y SVG. Nada de HTML.
 */
export function detectarTipo(bytes: Uint8Array): TipoArchivo | null {
  const empieza = (...firma: number[]) => firma.every((b, i) => bytes[i] === b);
  const ascii = (desde: number, texto: string) => [...texto].every((c, i) => bytes[desde + i] === c.charCodeAt(0));
  if (ascii(0, "%PDF-")) return { mime: "application/pdf", ext: "pdf" };
  if (empieza(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png" };
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { mime: "image/webp", ext: "webp" };
  if (esSvg(bytes)) return { mime: MIME_SVG, ext: "svg" };
  return null;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Ruta absoluta de un original, comprobando que no se sale de la carpeta. */
function rutaSegura(carpeta: string, relativa: string): string {
  const base = path.resolve(carpeta);
  const absoluta = path.resolve(base, relativa);
  if (!absoluta.startsWith(base + path.sep)) throw new Error("Ruta de original no válida");
  return absoluta;
}

export interface OriginalGuardado {
  ruta: string;       // relativa a la carpeta de originales, con "/" (también en Windows)
  hash: string;
  tamano: number;
  tipo: TipoArchivo;
}

/** Guarda un original. Lanza un error si no es de un tipo admitido. */
export function guardarOriginal(empresaId: string, bytes: Uint8Array, carpeta = CARPETA_ORIGINALES): OriginalGuardado {
  if (!/^[A-Za-z0-9-]+$/.test(empresaId)) throw new Error("Identificador de empresa no válido");
  const tipo = detectarTipo(bytes);
  if (!tipo) throw new Error("Tipo de archivo no admitido");

  const hash = sha256(bytes);
  const ruta = `${empresaId}/${hash}.${tipo.ext}`;
  const destino = rutaSegura(carpeta, ruta);
  fs.mkdirSync(path.dirname(destino), { recursive: true });

  if (fs.existsSync(destino)) {
    // Mismo contenido ya guardado (duplicado exacto): lo comprobamos y lo reutilizamos
    if (sha256(fs.readFileSync(destino)) !== hash) throw new Error("Un original existente no coincide con su hash");
  } else {
    const temporal = `${destino}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporal, bytes, { flag: "wx" });
    try {
      fs.linkSync(temporal, destino); // falla si otro proceso lo creó a la vez: nunca sobrescribe
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    } finally {
      fs.unlinkSync(temporal);
    }
    fs.chmodSync(destino, 0o444); // solo lectura (en Windows, atributo "Solo lectura")
  }
  return { ruta, hash, tamano: bytes.length, tipo };
}

export type ResultadoLectura =
  | { ok: true; bytes: Buffer }
  | { ok: false; motivo: "no_existe" | "alterado" };

/** Lee un original y comprueba que su contenido sigue coincidiendo con el hash. */
export function leerOriginal(ruta: string, hashEsperado: string, carpeta = CARPETA_ORIGINALES): ResultadoLectura {
  const absoluta = rutaSegura(carpeta, ruta);
  if (!fs.existsSync(absoluta)) return { ok: false, motivo: "no_existe" };
  const bytes = fs.readFileSync(absoluta);
  return sha256(bytes) === hashEsperado ? { ok: true, bytes } : { ok: false, motivo: "alterado" };
}
