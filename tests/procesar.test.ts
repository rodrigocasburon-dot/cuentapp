// Procesado automático (RF-05) con un lector y un proveedor de cambio FALSOS:
// así se prueban los estados, lo que se guarda y el aislamiento sin depender del OCR.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extraccionVacia, type Extraccion } from "@/lectura/esquema";
import type { Bd } from "@/servidor/bd/conexion";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { recibirArchivo } from "@/servidor/documentos/recibir";
import { DocumentoDanado } from "@/servidor/lectura/extraer";
import { procesarDocumento, procesarPendientes, type Dependencias } from "@/servidor/lectura/procesar";
import { tipoDeCambio } from "@/servidor/lectura/tipo-cambio";
import { bdDePrueba } from "./ayudas";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const png = (n: number) => Uint8Array.from([...PNG, n]);
const HOY = new Date("2026-10-29T10:00:00Z");

function ticket(cambios: Partial<Record<keyof Extraccion, unknown>> = {}): Extraccion {
  const c = <T>(valor: T) => ({ valor, confianza: 0.9 });
  const ex: Extraccion = {
    tipo: c("ticket_simplificado" as const),
    nombre_emisor: c("Cafetería Prueba"),
    nif_emisor: c("B00000000"),
    nif_receptor: c(null),
    numero: c("T-1"),
    fecha_emision: c("2026-08-19"),
    moneda: c("EUR"),
    total_centimos: c(370),
    lineas_iva: c([{ tipo_iva: 10, base_centimos: 336, cuota_centimos: 34 }]),
  };
  for (const [k, v] of Object.entries(cambios)) (ex as Record<string, unknown>)[k] = { valor: v, confianza: 0.9 };
  return ex;
}

let carpeta: string;
beforeEach(() => (carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cuentapp-procesar-"))));
afterEach(() => {
  const soltar = (d: string): void =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? soltar(path.join(d, e.name)) : fs.chmodSync(path.join(d, e.name), 0o666)));
  soltar(carpeta);
  fs.rmSync(carpeta, { recursive: true, force: true });
});

const deps = (ex: Extraccion | Error, extra: Partial<Dependencias> = {}): Dependencias => ({
  extraer: async () => {
    if (ex instanceof Error) throw ex;
    return { extraccion: ex, motor: "falso", segundos: 0 };
  },
  cambio: async () => ({ valor: 1.1615, fecha_bce: "2026-09-03" }),
  carpeta,
  ahora: () => HOY,
  ...extra,
});

function subir(bd: Bd, empresa: string, bytes = PNG) {
  const repo = repositorioDeEmpresa(bd, empresa);
  const r = recibirArchivo(repo, { nombre: "t.png", bytes }, "subida", carpeta);
  if (!r.ok) throw new Error(r.motivo);
  return { repo, id: r.id };
}

describe("procesado de un documento", () => {
  it("ticket correcto: pendiente de revisión, campos, IVA, periodo y extracción guardados", async () => {
    const bd = bdDePrueba();
    const { repo, id } = subir(bd, "A");
    expect(await procesarDocumento(repo, id, deps(ticket()))).toBe("pendiente_revision");

    const doc = repo.obtenerDocumento(id)!;
    expect(doc).toMatchObject({ tipo: "ticket_simplificado", nif_emisor: "B00000000", total_centimos: 370, total_eur_centimos: 370, base_centimos: 336, cuota_centimos: 34, motor_lectura: "falso" });
    expect(JSON.parse(doc.extraccion_json!).total_centimos.valor).toBe(370);
    expect(JSON.parse(doc.avisos_json!).map((a: { codigo: string }) => a.codigo)).toEqual(["ticket_sin_nif_receptor"]);
    expect(repo.lineasIva(id)).toEqual([{ tipo_iva: 10, base_centimos: 336, cuota_centimos: 34 }]);
    const periodo = bd.prepare("SELECT anio, trimestre FROM periodos WHERE id = ?").get(doc.periodo_id);
    expect(periodo).toEqual({ anio: 2026, trimestre: 3 });
  });

  it("ilegible: estado incidencia y una incidencia bloqueante abierta", async () => {
    const bd = bdDePrueba();
    const { repo, id } = subir(bd, "A");
    expect(await procesarDocumento(repo, id, deps(extraccionVacia()))).toBe("incidencia");
    expect(repo.incidencias(id)).toEqual([expect.objectContaining({ tipo: "ilegible", bloqueante: 1, estado: "abierta" })]);
  });

  it("archivo dañado (PDF que no abre): incidencia ilegible, no revisión manual", async () => {
    const bd = bdDePrueba();
    const { repo, id } = subir(bd, "A");
    expect(await procesarDocumento(repo, id, deps(new DocumentoDanado("PdfiumError: Data format error")))).toBe("incidencia");
    expect(repo.incidencias(id)).toEqual([expect.objectContaining({ tipo: "ilegible", bloqueante: 1 })]);
  });

  it("factura a nombre de otra empresa: incidencia documental bloqueante", async () => {
    const bd = bdDePrueba();
    bd.prepare("UPDATE empresas SET nif = 'B11111119' WHERE id = 'A'").run();
    const { repo, id } = subir(bd, "A");
    const factura = ticket({ tipo: "factura_completa", nif_receptor: "B00000000" });
    expect(await procesarDocumento(repo, id, deps(factura))).toBe("incidencia");
    expect(repo.incidencias(id)).toEqual([expect.objectContaining({ tipo: "documental", bloqueante: 1 })]);
  });

  it("si el lector falla, pasa a revisión manual en vez de quedarse atascado", async () => {
    const bd = bdDePrueba();
    const { repo, id } = subir(bd, "A");
    const errorOriginal = console.error;
    console.error = () => {};
    try {
      expect(await procesarDocumento(repo, id, deps(new Error("motor caído")))).toBe("pendiente_revision");
    } finally {
      console.error = errorOriginal;
    }
    expect(JSON.parse(repo.obtenerDocumento(id)!.avisos_json!)[0].codigo).toBe("lectura_fallida");
  });

  it("moneda extranjera: convierte a euros con el tipo del BCE de la fecha", async () => {
    const bd = bdDePrueba();
    const { repo, id } = subir(bd, "A");
    await procesarDocumento(repo, id, deps(ticket({ moneda: "USD", total_centimos: 4999, lineas_iva: [{ tipo_iva: 0, base_centimos: 4999, cuota_centimos: 0 }] })));
    expect(repo.obtenerDocumento(id)).toMatchObject({ moneda: "USD", tipo_cambio: 1.1615, fecha_cambio: "2026-09-03", total_eur_centimos: 4304 });
  });

  it("sin conexión para el tipo de cambio: aviso ámbar y total en euros vacío", async () => {
    const bd = bdDePrueba();
    const { repo, id } = subir(bd, "A");
    await procesarDocumento(repo, id, deps(ticket({ moneda: "USD" }), { cambio: async () => null }));
    const doc = repo.obtenerDocumento(id)!;
    expect(doc.total_eur_centimos).toBeNull();
    expect(JSON.parse(doc.avisos_json!).map((a: { codigo: string }) => a.codigo)).toContain("sin_tipo_cambio");
  });

  it("un documento solo se procesa una vez y su extracción no se puede reescribir", async () => {
    const bd = bdDePrueba();
    const { repo, id } = subir(bd, "A");
    await procesarDocumento(repo, id, deps(ticket()));
    expect(await procesarDocumento(repo, id, deps(ticket()))).toBeNull();
    expect(() => bd.prepare("UPDATE documentos SET extraccion_json = '{}' WHERE id = ?").run(id)).toThrow();
  });
});

describe("cola y aislamiento", () => {
  it("procesa los de todas las empresas, cada uno dentro de la suya", async () => {
    const bd = bdDePrueba();
    const a = subir(bd, "A", png(1));
    const b = subir(bd, "B", png(2));
    expect(await procesarPendientes(bd, deps(ticket()))).toBe(2);
    expect(a.repo.obtenerDocumento(a.id)!.estado).toBe("pendiente_revision");
    expect(b.repo.obtenerDocumento(b.id)!.estado).toBe("pendiente_revision");
    // Cada línea de IVA y cada periodo pertenecen a la empresa de su documento
    const cruzadas = bd.prepare("SELECT count(*) n FROM lineas_iva l JOIN documentos d ON d.id = l.documento_id WHERE l.empresa_id <> d.empresa_id").get() as { n: number };
    expect(cruzadas.n).toBe(0);
    expect(a.repo.lineasIva(b.id)).toEqual([]); // A no ve el IVA de B
    const periodos = bd.prepare("SELECT empresa_id FROM periodos ORDER BY empresa_id").all();
    expect(periodos).toEqual([{ empresa_id: "A" }, { empresa_id: "B" }]);
  });

  it("recupera documentos que se quedaron en 'procesando' (servidor caído)", async () => {
    const bd = bdDePrueba();
    const { repo, id } = subir(bd, "A");
    repo.reclamarParaLectura(id, new Date(HOY.getTime() - 60 * 60_000)); // hace una hora
    expect(await procesarPendientes(bd, deps(ticket()))).toBe(1);
    expect(repo.obtenerDocumento(id)!.estado).toBe("pendiente_revision");
  });
});

describe("tipo de cambio con caché", () => {
  it("pregunta una sola vez por cada moneda y fecha", async () => {
    const bd = bdDePrueba();
    let llamadas = 0;
    const proveedor = async () => (llamadas++, { valor: 0.86, fecha_bce: "2026-09-04" });
    await tipoDeCambio(bd, "GBP", "2026-09-06", proveedor);
    expect(await tipoDeCambio(bd, "GBP", "2026-09-06", proveedor)).toEqual({ valor: 0.86, fecha_bce: "2026-09-04" });
    expect(llamadas).toBe(1);
  });
});
