// Fase 8 (buzón simulado y copia local) y fase 9 (límites y cambio de plan).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { recibirCorreo } from "@/servidor/documentos/buzon";
import { copiarTrimestre, parteSegura } from "@/servidor/documentos/copia-local";
import { cupoDisponible } from "@/servidor/documentos/limites";
import { recibirArchivo } from "@/servidor/documentos/recibir";
import { bdDePrueba } from "./ayudas";

const HOY = new Date("2026-10-29T10:00:00Z");
const png = (n: number) => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n, n >> 8]);

let carpeta: string;
let destino: string;
beforeEach(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cuentapp-f8-"));
  destino = fs.mkdtempSync(path.join(os.tmpdir(), "cuentapp-copia-"));
});
afterEach(() => {
  const soltar = (d: string): void =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? soltar(path.join(d, e.name)) : fs.chmodSync(path.join(d, e.name), 0o666)));
  for (const d of [carpeta, destino]) {
    soltar(d);
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("buzón simulado (fase 8)", () => {
  it("el correo entra en la empresa dueña de la dirección, con remitente y asunto", () => {
    const bd = bdDePrueba();
    const r = recibirCorreo(bd, { para: "B@BUZON.local", de: "prov@x.es", asunto: "Factura\noctubre", adjuntos: [{ nombre: "f.png", bytes: png(1) }] }, carpeta, HOY);
    expect(r.ok).toBe(true);
    const docsB = repositorioDeEmpresa(bd, "B").listarDocumentos();
    expect(docsB).toEqual([expect.objectContaining({ origen: "buzon", correo_remitente: "prov@x.es", correo_asunto: "Factura octubre" })]);
    expect(repositorioDeEmpresa(bd, "A").listarDocumentos()).toHaveLength(0);
  });

  it("rechaza direcciones desconocidas y empresas dadas de baja con el mismo mensaje", () => {
    const bd = bdDePrueba();
    const correo = (para: string) => ({ para, de: "x", asunto: "y", adjuntos: [{ nombre: "f.png", bytes: png(1) }] });
    const desconocida = recibirCorreo(bd, correo("nadie@buzon.local"), carpeta, HOY);
    bd.prepare("UPDATE empresas SET baja_en = '2026-10-01T00:00:00Z' WHERE id = 'A'").run();
    const deBaja = recibirCorreo(bd, correo("a@buzon.local"), carpeta, HOY);
    expect(desconocida).toEqual({ ok: false, motivo: "No hay ningún buzón con esa dirección." });
    expect(deBaja).toEqual(desconocida);
  });
});

describe("límites del plan (fase 9)", () => {
  it("plan Prueba: 30 documentos en total y nada tras la fecha de fin", () => {
    const bd = bdDePrueba();
    bd.prepare("UPDATE empresas SET plan_id = 'prueba', prueba_hasta = '2026-11-05T00:00:00Z' WHERE id = 'A'").run();
    const repo = repositorioDeEmpresa(bd, "A");
    bd.prepare("INSERT INTO uso_mensual (empresa_id, mes, documentos) VALUES ('A', '2026-09', 20), ('A', '2026-10', 8)").run();
    expect(cupoDisponible(repo, HOY).disponibles).toBe(2);

    const r = recibirCorreo(bd, { para: "a@buzon.local", de: "x", asunto: "", adjuntos: [1, 2, 3].map((n) => ({ nombre: `${n}.png`, bytes: png(n) })) }, carpeta, HOY);
    expect(r.ok && r.resultados.map((x) => x.ok)).toEqual([true, true, false]);
    expect(cupoDisponible(repo, HOY)).toMatchObject({ disponibles: 0, motivo: expect.stringMatching(/límite de 30/) });

    expect(cupoDisponible(repo, new Date("2026-11-06T00:00:00Z"))).toMatchObject({ disponibles: 0, motivo: expect.stringMatching(/prueba gratuita ha terminado/) });
  });

  it("plan Cuentapp: 100 al mes; Pro: 300; cambiar de plan quita el fin de la prueba", () => {
    const bd = bdDePrueba();
    bd.prepare("UPDATE empresas SET plan_id = 'prueba', prueba_hasta = '2026-10-01T00:00:00Z' WHERE id = 'A'").run();
    const repo = repositorioDeEmpresa(bd, "A");
    expect(cupoDisponible(repo, HOY).disponibles).toBe(0); // prueba caducada
    expect(repo.cambiarPlan("despacho")).toBe(false); // no disponible
    expect(repo.cambiarPlan("prueba")).toBe(false); // no se vuelve a la prueba
    expect(repo.cambiarPlan("cuentapp")).toBe(true);
    bd.prepare("INSERT INTO uso_mensual (empresa_id, mes, documentos) VALUES ('A', '2026-10', 99)").run();
    expect(cupoDisponible(repo, HOY).disponibles).toBe(1);
    expect(cupoDisponible(repo, HOY).motivo).toMatch(/límite de 100 documentos al mes del plan Cuentapp/);

    expect(repo.cambiarPlan("pro")).toBe(true);
    expect(repo.plan()).toMatchObject({ id: "pro", nombre: "Cuentapp Pro", precio_centimos: 4000, limite_docs_mes: 300 });
    expect(cupoDisponible(repo, HOY).disponibles).toBe(201);
    expect(repositorioDeEmpresa(bd, "B").plan().id).toBe("cuentapp"); // B no cambia
  });
});

describe("copia local del trimestre (fase 8)", () => {
  it("copia solo los validados, ordenados por tipo, sin tocar el original, y es idempotente", async () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const subir = (n: number) => {
      const r = recibirArchivo(repo, { nombre: `${n}.png`, bytes: png(n) }, "subida", carpeta, HOY);
      if (!r.ok) throw new Error(r.motivo);
      return r.id;
    };
    const validado = subir(1);
    const pendiente = subir(2);
    for (const id of [validado, pendiente]) {
      repo.corregirDocumento(id, "uA", { tipo: "factura_completa", nombre_emisor: 'Bar "Pepe" / Hnos', nif_emisor: "B00000000", numero: `F/${id.slice(0, 4)}`, fecha_emision: "2026-08-19", total_centimos: 121 }, HOY);
    }
    repo.validarDocumento(validado, "uA", HOY);

    const r1 = await copiarTrimestre(repo, 2026, 3, destino, carpeta);
    expect(r1).toMatchObject({ copiados: 1, yaEstaban: 0, sinValidar: 1, fallidos: 0 });
    const facturas = fs.readdirSync(path.join(r1.carpeta, "Facturas completas"));
    expect(facturas).toHaveLength(1);
    expect(facturas[0]).toMatch(/^2026-08-19_Bar Pepe Hnos_F .+\.png$/);
    expect(fs.readFileSync(path.join(r1.carpeta, "Facturas completas", facturas[0]))).toEqual(Buffer.from(png(1)));
    expect(fs.existsSync(path.join(r1.carpeta, "resumen-2026-T3.xlsx"))).toBe(true);

    const r2 = await copiarTrimestre(repo, 2026, 3, destino, carpeta);
    expect(r2).toMatchObject({ copiados: 0, yaEstaban: 1 });
    // La copia de B no incluye nada de A
    const rB = await copiarTrimestre(repositorioDeEmpresa(bd, "B"), 2026, 3, destino, carpeta);
    expect(rB).toMatchObject({ copiados: 0, sinValidar: 0 });
  });

  it("los nombres de fichero no pueden salirse de la carpeta", () => {
    expect(parteSegura("../../etc/passwd")).not.toMatch(/[\\/]/); // sin separadores: no cambia de carpeta
    expect(parteSegura("..")).toBe("sin-dato");
    expect(parteSegura(null)).toBe("sin-dato");
  });
});
