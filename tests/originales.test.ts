// RF-02 / RF-03 / RF-08 · Subida, original inmutable y entrega solo a su empresa.
// PERDER O ALTERAR UN ORIGINAL, O SERVIRLO A OTRA EMPRESA, BLOQUEA LA ENTREGA.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectarTipo, guardarOriginal, leerOriginal, sha256 } from "@/servidor/almacen/originales";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { limpiarNombre, recibirArchivo } from "@/servidor/documentos/recibir";
import { respuestaOriginal } from "@/servidor/documentos/servir-original";
import { TAMANO_MAXIMO } from "@/dominio/subida";
import { bdDePrueba } from "./ayudas";

// Cabeceras mínimas de cada formato (no son imágenes completas: basta para el tipo)
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const PDF = new TextEncoder().encode("%PDF-1.7\n% prueba\n");
const WEBP = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
const otroPng = (n: number) => Uint8Array.from([...PNG, n]);

let carpeta: string;
beforeEach(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cuentapp-originales-"));
});
afterEach(() => {
  // Los originales son de solo lectura: hay que devolverles el permiso para poder borrar la carpeta temporal
  const quitarSoloLectura = (d: string) =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const r = path.join(d, e.name);
      if (e.isDirectory()) quitarSoloLectura(r);
      else fs.chmodSync(r, 0o666);
    });
  quitarSoloLectura(carpeta);
  fs.rmSync(carpeta, { recursive: true, force: true });
});

describe("tipo de archivo por su contenido", () => {
  it("admite PDF, JPG, PNG y WebP", () => {
    expect(detectarTipo(PDF)?.mime).toBe("application/pdf");
    expect(detectarTipo(JPG)?.mime).toBe("image/jpeg");
    expect(detectarTipo(PNG)?.mime).toBe("image/png");
    expect(detectarTipo(WEBP)?.mime).toBe("image/webp");
  });

  it("rechaza ejecutables, HTML y SVG aunque se llamen .pdf", () => {
    for (const texto of ["MZ\x90\0", "<!doctype html><script>", "<svg onload=alert(1)>", ""]) {
      expect(detectarTipo(new TextEncoder().encode(texto))).toBeNull();
    }
  });
});

describe("almacén de originales", () => {
  it("guarda byte a byte, nombra por SHA-256 y deja el fichero en solo lectura", () => {
    const g = guardarOriginal("empresa-a", PNG, carpeta);
    expect(g.hash).toBe(sha256(PNG));
    expect(g.ruta).toBe(`empresa-a/${g.hash}.png`);
    const absoluta = path.join(carpeta, g.ruta);
    expect(new Uint8Array(fs.readFileSync(absoluta))).toEqual(PNG);
    expect(() => fs.writeFileSync(absoluta, "pisado")).toThrow(); // EPERM: solo lectura
    expect(fs.readdirSync(path.dirname(absoluta))).toEqual([path.basename(absoluta)]); // sin temporales
  });

  it("el mismo contenido dos veces reutiliza el original sin error", () => {
    const a = guardarOriginal("empresa-a", PNG, carpeta);
    const b = guardarOriginal("empresa-a", PNG, carpeta);
    expect(b.ruta).toBe(a.ruta);
  });

  it("detecta un original alterado o desaparecido", () => {
    const g = guardarOriginal("empresa-a", PNG, carpeta);
    expect(leerOriginal(g.ruta, g.hash, carpeta).ok).toBe(true);
    const absoluta = path.join(carpeta, g.ruta);
    fs.chmodSync(absoluta, 0o666);
    fs.writeFileSync(absoluta, otroPng(7));
    expect(leerOriginal(g.ruta, g.hash, carpeta)).toEqual({ ok: false, motivo: "alterado" });
    fs.rmSync(absoluta);
    expect(leerOriginal(g.ruta, g.hash, carpeta)).toEqual({ ok: false, motivo: "no_existe" });
  });

  it("no permite salir de la carpeta de originales", () => {
    expect(() => leerOriginal("../../etc/passwd", "x", carpeta)).toThrow(/Ruta/);
    expect(() => guardarOriginal("../otra", PNG, carpeta)).toThrow(/empresa/);
  });
});

describe("recepción (RF-02)", () => {
  it("da de alta el documento como 'recibido', con su hash, y suma al uso del mes", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const ahora = new Date("2026-10-31T23:30:00Z"); // ya es 1 de noviembre en España
    const r = recibirArchivo(repo, { nombre: "ticket.png", bytes: PNG }, "subida", carpeta, ahora);
    expect(r.ok).toBe(true);
    const doc = repo.obtenerDocumento(r.ok ? r.id : "")!;
    expect(doc.estado).toBe("recibido");
    expect(doc.hash_sha256).toBe(sha256(PNG));
    expect(doc.mime).toBe("image/png");
    expect(repo.usoDelMes("2026-11")).toBe(1);
    expect(repo.usoDelMes("2026-10")).toBe(0);
  });

  it("rechaza vacíos, demasiado grandes y formatos no admitidos sin dejar rastro", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const grande = new Uint8Array(TAMANO_MAXIMO + 1);
    grande.set(PNG);
    expect(recibirArchivo(repo, { nombre: "vacio.pdf", bytes: new Uint8Array() }, "subida", carpeta)).toMatchObject({ ok: false });
    expect(recibirArchivo(repo, { nombre: "grande.png", bytes: grande }, "subida", carpeta)).toMatchObject({ ok: false });
    expect(recibirArchivo(repo, { nombre: "virus.pdf", bytes: new TextEncoder().encode("MZ") }, "subida", carpeta)).toMatchObject({ ok: false });
    expect(repo.listarDocumentos()).toHaveLength(0);
    expect(fs.readdirSync(carpeta)).toEqual([]);
  });

  it("un duplicado exacto se recibe e indica de cuál es copia", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    recibirArchivo(repo, { nombre: "primero.pdf", bytes: PDF }, "subida", carpeta);
    const r = recibirArchivo(repo, { nombre: "copia.pdf", bytes: PDF }, "subida", carpeta);
    expect(r).toMatchObject({ ok: true, duplicadoDe: "primero.pdf" });
    expect(repo.listarDocumentos()).toHaveLength(2);
  });

  it("limpia nombres peligrosos", () => {
    expect(limpiarNombre("..\\..\\windows\\system32\\a.pdf")).toBe("a.pdf");
    expect(limpiarNombre("../../etc/passwd")).toBe("passwd");
    expect(limpiarNombre("fac\u0000tura.pdf")).toBe("factura.pdf");
    expect(limpiarNombre("   ")).toBe("documento");
  });
});

describe("entrega del original (RF-03, RF-08) y aislamiento", () => {
  it("sirve a su empresa el original idéntico, con cabeceras seguras", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const r = recibirArchivo(repo, { nombre: "Factura nº 3 — julio.pdf", bytes: PDF }, "subida", carpeta);
    const resp = respuestaOriginal(repo, r.ok ? r.id : "", true, carpeta);
    expect(resp.estado).toBe(200);
    expect(resp.cuerpo).toEqual(PDF);
    expect(resp.cabeceras["Content-Type"]).toBe("application/pdf");
    expect(resp.cabeceras["X-Content-Type-Options"]).toBe("nosniff");
    expect(resp.cabeceras["Content-Disposition"]).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''Factura%20n%C2%BA/);
  });

  it("otra empresa recibe 404 con el id del documento: ni lo ve ni sabe que existe", () => {
    const bd = bdDePrueba();
    const a = repositorioDeEmpresa(bd, "A");
    const b = repositorioDeEmpresa(bd, "B");
    const r = recibirArchivo(a, { nombre: "privado.png", bytes: PNG }, "subida", carpeta);
    const id = r.ok ? r.id : "";
    expect(respuestaOriginal(b, id, false, carpeta).estado).toBe(404);
    expect(respuestaOriginal(b, "no-existe", false, carpeta)).toEqual(respuestaOriginal(b, id, false, carpeta));
  });

  it("los originales de cada empresa van a su propia carpeta", () => {
    const bd = bdDePrueba();
    recibirArchivo(repositorioDeEmpresa(bd, "A"), { nombre: "a.png", bytes: PNG }, "subida", carpeta);
    recibirArchivo(repositorioDeEmpresa(bd, "B"), { nombre: "b.png", bytes: PNG }, "subida", carpeta);
    expect(fs.readdirSync(carpeta).sort()).toEqual(["A", "B"]);
  });

  it("no sirve un original alterado", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const r = recibirArchivo(repo, { nombre: "x.png", bytes: PNG }, "subida", carpeta);
    const doc = repo.obtenerDocumento(r.ok ? r.id : "")!;
    const absoluta = path.join(carpeta, doc.ruta_original);
    fs.chmodSync(absoluta, 0o666);
    fs.writeFileSync(absoluta, otroPng(1));
    const errorOriginal = console.error;
    console.error = () => {}; // el aviso es esperado en esta prueba
    try {
      expect(respuestaOriginal(repo, doc.id, false, carpeta).estado).toBe(500);
    } finally {
      console.error = errorOriginal;
    }
  });
});
