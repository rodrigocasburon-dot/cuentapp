// Arreglos de la revisión de seguridad (fase 10) y una prueba estática que
// impide añadir Server Actions sin comprobar la sesión.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { esquemaCorreccion, MAX_LINEAS_IVA } from "@/dominio/correccion";
import { limpiarNombre } from "@/servidor/documentos/recibir";
import { dimensiones, imagenDemasiadoGrande } from "@/servidor/lectura/dimensiones";

describe("Server Actions: todas comprueban la sesión", () => {
  // Acciones públicas a propósito (antes de tener sesión)
  const PUBLICAS = new Set(["registrar", "entrar", "entrarDemo", "salir"]);

  const ficheros = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? ficheros(path.join(dir, e.name)) : [path.join(dir, e.name)]));

  it("cada función exportada de un fichero «use server» llama a repositorioActual() o exigirSesion()", () => {
    const sinSesion: string[] = [];
    for (const f of ficheros(path.resolve(__dirname, "..", "src"))) {
      if (!/\.tsx?$/.test(f)) continue;
      const codigo = fs.readFileSync(f, "utf8");
      if (!/^\s*["']use server["']/.test(codigo)) continue;
      // Trozo de cada función exportada hasta la siguiente
      const partes = codigo.split(/(?=export async function )/).slice(1);
      for (const p of partes) {
        const nombre = /export async function (\w+)/.exec(p)![1];
        if (!PUBLICAS.has(nombre) && !/repositorioActual\(\)|exigirSesion\(\)/.test(p)) sinSesion.push(`${path.relative(process.cwd(), f)}: ${nombre}`);
      }
    }
    expect(sinSesion).toEqual([]);
  });
});

describe("arreglos de la revisión", () => {
  it("M2: la corrección no admite más de 20 líneas de IVA ni importes absurdos", () => {
    const base = { tipo: "ticket_simplificado" };
    const linea = { tipo_iva: 21, base_centimos: 100, cuota_centimos: 21 };
    expect(esquemaCorreccion.safeParse({ ...base, lineas_iva: Array(MAX_LINEAS_IVA).fill(linea) }).success).toBe(true);
    expect(esquemaCorreccion.safeParse({ ...base, lineas_iva: Array(MAX_LINEAS_IVA + 1).fill(linea) }).success).toBe(false);
    expect(esquemaCorreccion.safeParse({ ...base, total_centimos: 1e15 }).success).toBe(false);
  });

  it("M5: lee ancho y alto de PNG, JPEG y WebP sin decodificarlos", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x9c, 0x40, 0, 0, 0x9c, 0x40]);
    expect(dimensiones(png)).toEqual({ ancho: 40000, alto: 40000 });
    expect(imagenDemasiadoGrande(png)).toBe(true);

    // JPEG: SOI, APP0 de 4 bytes y SOF0 de 1200 × 800
    const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x03, 0x20, 0x04, 0xb0, 3, 0, 0, 0, 0, 0, 0]);
    expect(dimensiones(jpg)).toEqual({ ancho: 1200, alto: 800 });
    expect(imagenDemasiadoGrande(jpg)).toBe(false);

    const webp = new Uint8Array(30);
    webp.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
    webp.set([..."WEBPVP8X"].map((c) => c.charCodeAt(0)), 8);
    webp.set([0x1f, 0x03, 0x00, 0x57, 0x02, 0x00], 24); // 800 × 600 (menos 1)
    expect(dimensiones(webp)).toEqual({ ancho: 800, alto: 600 });
  });

  it("B3: quita los caracteres que disfrazan la extensión", () => {
    expect(limpiarNombre("factura‮fdp.exe")).toBe("facturafdp.exe");
  });
});
