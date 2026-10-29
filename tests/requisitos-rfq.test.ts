// Requisitos del RFQ añadidos tras revisarlo (D-56 a D-59): categoría del
// gasto, recuperación de contraseña, cifras del mes y avisos de plazo.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { sugerirCategoria } from "@/dominio/categorias";
import { esquemaCorreccion } from "@/dominio/correccion";
import { NuevaContrasenaSchema } from "@/dominio/formularios-acceso";
import { avisosDePlazo, mesAnterior, nombreMes } from "@/dominio/plazos";
import {
  crearRecuperacion,
  crearSesion,
  darDeBaja,
  leerSesion,
  recuperacionValida,
  usarRecuperacion,
  usuarioPorEmail,
} from "@/servidor/bd/cuentas";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { enviarCorreo } from "@/servidor/correo/salida";
import { generarExcelTrimestre } from "@/servidor/documentos/excel";
import { bdDePrueba, ORIGINAL } from "./ayudas";

const HOY = new Date("2026-10-29T10:00:00Z");
const hash = (c: string) => c.repeat(64);

describe("categoría del gasto", () => {
  it("se sugiere por el emisor y, si no, por el texto leído", () => {
    expect(sugerirCategoria("REPSOL ESTACIÓN 1234")).toBe("combustible");
    expect(sugerirCategoria(null, "GASÓLEO A  45,20 L")).toBe("combustible");
    expect(sugerirCategoria("Bar Pepe")).toBe("restaurantes");
    expect(sugerirCategoria("Mercadona S.A.", "CAFÉ MOLIDO 3,20")).toBe("alimentacion"); // el emisor manda
    expect(sugerirCategoria("Anthropic, PBC", "Subscription")).toBe("software");
    expect(sugerirCategoria("Abogados Pérez")).toBe("servicios");
  });

  it("no inventa: palabras parecidas no cuentan y sin pistas devuelve null", () => {
    expect(sugerirCategoria("Barras y Perfiles S.L.")).toBeNull(); // «bar» tiene que ser palabra entera
    expect(sugerirCategoria(null, "Fecha: día 12")).toBeNull(); // «día» no es el supermercado
    expect(sugerirCategoria(null, null)).toBeNull();
  });

  it("la corrección acepta solo categorías de la lista y, sin el campo, no la toca", () => {
    const base = { tipo: "ticket_simplificado" };
    expect(esquemaCorreccion.safeParse({ ...base, categoria: "combustible" }).data?.categoria).toBe("combustible");
    expect(esquemaCorreccion.safeParse({ ...base, categoria: "" }).data?.categoria).toBeNull();
    expect(esquemaCorreccion.safeParse({ ...base }).data?.categoria).toBeUndefined();
    expect(esquemaCorreccion.safeParse({ ...base, categoria: "inventada" }).success).toBe(false);
  });

  it("corregirla queda en el historial y sale en el Excel (columna y hoja «Por categoría»)", async () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const id = repo.crearDocumento(ORIGINAL, HOY);
    repo.corregirDocumento(id, "uA", { nombre_emisor: "Repsol", fecha_emision: "2026-08-19", moneda: "EUR", total_centimos: 5000, categoria: "combustible", lineas_iva: [{ tipo_iva: 21, base_centimos: 4132, cuota_centimos: 868 }] }, HOY);
    expect(repo.obtenerDocumento(id)?.categoria).toBe("combustible");
    expect(repo.listarCorrecciones(id).some((c) => c.campo === "categoria" && c.valor_nuevo === "combustible")).toBe(true);
    // Otra corrección sin categoría no la borra
    repo.corregirDocumento(id, "uA", { numero: "F-1" }, HOY);
    expect(repo.obtenerDocumento(id)?.categoria).toBe("combustible");

    const bytes = await generarExcelTrimestre({
      empresa: { nombre: "Empresa A", nif: null }, anio: 2026, trimestre: 3, incluirPendientes: true,
      semaforo: repo.resumenTrimestre(2026, 3), documentos: repo.documentosDelTrimestre(2026, 3), generadoEn: HOY,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    expect(wb.worksheets[0].getRow(8).getCell(16).value).toBe("Categoría");
    expect(wb.worksheets[0].getRow(9).getCell(16).value).toBe("Combustible");
    const hoja = wb.getWorksheet("Por categoría")!;
    expect(hoja.getRow(4).values).toEqual([undefined, "Combustible", 1, 41.32, 8.68, 50]);
  });
});

describe("cifras del mes (panel)", () => {
  it("cuenta y suma por fecha del documento y categoría, sin la papelera ni otras empresas", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const nuevo = (c: string, fecha: string, total: number, categoria: string | null) => {
      const id = repo.crearDocumento({ ...ORIGINAL, hash_sha256: hash(c) }, HOY);
      repo.corregirDocumento(id, "uA", { fecha_emision: fecha, moneda: "EUR", total_centimos: total, categoria }, HOY);
      return id;
    };
    nuevo("1", "2026-10-02", 5000, "combustible");
    nuevo("2", "2026-10-15", 1200, "restaurantes");
    nuevo("3", "2026-10-20", 800, "restaurantes");
    nuevo("4", "2026-10-21", 300, null);
    repo.moverAPapelera(nuevo("5", "2026-10-22", 99999, "otros"), "uA", HOY);
    nuevo("6", "2026-09-30", 7000, "combustible");
    repositorioDeEmpresa(bd, "B").crearDocumento({ ...ORIGINAL, hash_sha256: hash("7") }, HOY);

    const r = repo.resumenMes("2026-10");
    expect(r.documentos).toBe(4);
    expect(r.totalEurCentimos).toBe(7300);
    expect(r.porCategoria).toEqual([
      { categoria: "combustible", documentos: 1, totalEurCentimos: 5000 },
      { categoria: "restaurantes", documentos: 2, totalEurCentimos: 2000 },
      { categoria: null, documentos: 1, totalEurCentimos: 300 },
    ]);
    expect(repo.resumenMes(mesAnterior("2026-10")).totalEurCentimos).toBe(7000);
    expect(repositorioDeEmpresa(bd, "B").resumenMes("2026-10").documentos).toBe(0);
    expect(() => repo.resumenMes("2026-10' OR 1=1")).toThrow();
  });

  it("mes anterior y nombre del mes", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesAnterior("2026-10")).toBe("2026-09");
    expect(nombreMes("2026-10")).toBe("octubre de 2026");
  });
});

describe("avisos de plazo", () => {
  const en = (dia: string) => avisosDePlazo(new Date(`${dia}T12:00:00Z`));

  it("al empezar un trimestre avisa del plazo de presentación del anterior", () => {
    expect(en("2026-10-05")).toEqual([expect.objectContaining({ tipo: "presentacion", anio: 2026, trimestre: 3, dias: 15, limite: "20 de octubre" })]);
    expect(en("2026-01-25")).toEqual([expect.objectContaining({ tipo: "presentacion", anio: 2025, trimestre: 4, dias: 5, limite: "30 de enero" })]);
    expect(en("2026-04-21")).toEqual([]); // plazo ya pasado
  });

  it("avisa cuando quedan 15 días o menos para que acabe el trimestre", () => {
    expect(en("2026-12-20")).toEqual([expect.objectContaining({ tipo: "cierre", anio: 2026, trimestre: 4, dias: 11 })]);
    expect(en("2026-09-30")[0]).toMatchObject({ tipo: "cierre", dias: 0 });
    expect(en("2026-11-10")).toEqual([]);
  });

  it("usa la hora de España: el 31-12 a las 23:30 UTC ya es 1 de enero", () => {
    expect(avisosDePlazo(new Date("2026-12-31T23:30:00Z"))).toEqual([expect.objectContaining({ tipo: "presentacion", trimestre: 4, dias: 29 })]);
  });
});

describe("recuperación de contraseña", () => {
  it("el enlace cambia la contraseña una sola vez y cierra todas las sesiones", () => {
    const bd = bdDePrueba();
    bd.prepare("INSERT INTO membresias (usuario_id, empresa_id) VALUES ('uA', 'A')").run();
    const { token: sesion } = crearSesion(bd, "uA", "A", HOY);
    const token = crearRecuperacion(bd, "uA", HOY);
    // En la base solo está el hash, nunca el token
    expect(bd.prepare("SELECT count(*) AS n FROM recuperaciones WHERE id = ?").get(token)).toEqual({ n: 0 });
    expect(recuperacionValida(bd, token, HOY)).toBe(true);

    expect(usarRecuperacion(bd, token, "scrypt$nuevo", HOY)).toBe(true);
    expect(bd.prepare("SELECT hash_contrasena FROM usuarios WHERE id = 'uA'").get()).toEqual({ hash_contrasena: "scrypt$nuevo" });
    expect(leerSesion(bd, sesion, HOY)).toBeNull();
    expect(usarRecuperacion(bd, token, "scrypt$otra", HOY)).toBe(false); // ya usado
  });

  it("caduca a los 30 minutos y solo vale el último enlace pedido", () => {
    const bd = bdDePrueba();
    const viejo = crearRecuperacion(bd, "uA", HOY);
    const nuevo = crearRecuperacion(bd, "uA", HOY);
    expect(recuperacionValida(bd, viejo, HOY)).toBe(false);
    expect(recuperacionValida(bd, nuevo, new Date(HOY.getTime() + 29 * 60_000))).toBe(true);
    expect(usarRecuperacion(bd, nuevo, "x", new Date(HOY.getTime() + 31 * 60_000))).toBe(false);
    expect(usarRecuperacion(bd, "inventado", "x", HOY)).toBe(false);
  });

  it("un usuario dado de baja no puede recuperar", () => {
    const bd = bdDePrueba();
    bd.prepare("INSERT INTO membresias (usuario_id, empresa_id, rol) VALUES ('uA', 'A', 'titular')").run();
    const token = crearRecuperacion(bd, "uA", HOY);
    darDeBaja(bd, "uA", "A", HOY);
    expect(usuarioPorEmail(bd, "a@a.local")).toBeUndefined();
    expect(usarRecuperacion(bd, token, "x", HOY)).toBe(false);
  });

  it("la contraseña nueva cumple las reglas del registro y se escribe dos veces igual", () => {
    expect(NuevaContrasenaSchema.safeParse({ contrasena: "corta", repetir: "corta" }).success).toBe(false);
    expect(NuevaContrasenaSchema.safeParse({ contrasena: "una-larga-de-verdad", repetir: "otra-larga-de-verdad" }).success).toBe(false);
    expect(NuevaContrasenaSchema.safeParse({ contrasena: "una-larga-de-verdad", repetir: "una-larga-de-verdad" }).success).toBe(true);
  });

  it("MVP local: el correo se guarda en un fichero en vez de enviarse", () => {
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cuentapp-correo-"));
    const ruta = enviarCorreo({ para: "a@a.local", asunto: "Prueba", texto: "Enlace" }, carpeta, HOY);
    expect(fs.readFileSync(ruta, "utf8")).toBe("Para: a@a.local\nAsunto: Prueba\n\nEnlace\n");
    expect(path.basename(ruta)).not.toContain("a@a.local");
    fs.rmSync(carpeta, { recursive: true });
  });
});
