// Pruebas de RF-06 (corrección manual y validación) y RF-07 (duplicados exactos y lógicos).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Extraccion } from "@/lectura/esquema";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { recibirArchivo } from "@/servidor/documentos/recibir";
import { procesarDocumento, type Dependencias } from "@/servidor/lectura/procesar";
import { bdDePrueba, ORIGINAL } from "./ayudas";

const PNG_A = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PNG_B = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 5, 6]);
const HOY = new Date("2026-10-29T10:00:00Z");

let carpeta: string;
beforeEach(() => (carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cuentapp-fase6-"))));
afterEach(() => {
  const soltar = (d: string): void =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? soltar(path.join(d, e.name)) : fs.chmodSync(path.join(d, e.name), 0o666)));
  soltar(carpeta);
  fs.rmSync(carpeta, { recursive: true, force: true });
});

function ticket(cambios: Partial<Record<keyof Extraccion, unknown>> = {}): Extraccion {
  const c = <T>(valor: T) => ({ valor, confianza: 0.9 });
  const ex: Extraccion = {
    tipo: c("ticket_simplificado" as const),
    nombre_emisor: c("Restaurante Plaza"),
    nif_emisor: c("B12345678"),
    nif_receptor: c(null),
    numero: c("T-2026-001"),
    fecha_emision: c("2026-08-19"),
    moneda: c("EUR"),
    total_centimos: c(2500),
    lineas_iva: c([{ tipo_iva: 10, base_centimos: 2273, cuota_centimos: 227 }]),
  };
  for (const [k, v] of Object.entries(cambios)) (ex as Record<string, unknown>)[k] = { valor: v, confianza: 0.9 };
  return ex;
}

const deps = (ex: Extraccion): Dependencias => ({
  extraer: async () => ({ extraccion: ex, motor: "falso", segundos: 0 }),
  cambio: async () => null,
  carpeta,
  ahora: () => HOY,
});

describe("RF-06 · Corrección manual y revalidación", () => {
  it("guarda cada cambio en 'correcciones' y actualiza columnas sin tocar extraccion_json", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const r = recibirArchivo(repo, { nombre: "ticket.png", bytes: PNG_A }, "subida", carpeta, HOY);
    expect(r.ok).toBe(true);
    const id = r.ok ? r.id : "";

    // Simular paso a procesando y guardar lectura
    repo.reclamarParaLectura(id, HOY);
    repo.guardarLectura(id, {
      extraccion: ticket(),
      motor: "falso",
      avisos: [],
      cambio: null,
      estado: "pendiente_revision",
      ahora: HOY,
    });

    const docAntes = repo.obtenerDocumento(id)!;
    const extraccionOriginal = docAntes.extraccion_json;
    expect(docAntes.nombre_emisor).toBe("Restaurante Plaza");
    expect(docAntes.total_centimos).toBe(2500);

    // Corregir emisor, número y líneas de IVA
    const docDespues = repo.corregirDocumento(
      id,
      "uA",
      {
        nombre_emisor: "Restaurante Plaza Mayor",
        numero: "T-2026-002",
        total_centimos: 3000,
        lineas_iva: [{ tipo_iva: 10, base_centimos: 2727, cuota_centimos: 273 }],
      },
      HOY,
    );

    expect(docDespues.nombre_emisor).toBe("Restaurante Plaza Mayor");
    expect(docDespues.numero).toBe("T-2026-002");
    expect(docDespues.total_centimos).toBe(3000);
    expect(docDespues.base_centimos).toBe(2727);
    expect(docDespues.cuota_centimos).toBe(273);

    // extraccion_json NO se modifica (inmutable por trigger y diseño)
    expect(docDespues.extraccion_json).toBe(extraccionOriginal);

    // Las correcciones quedan registradas con campo, valor_anterior, valor_nuevo, usuario y fecha
    const corrs = repo.listarCorrecciones(id);
    expect(corrs).toHaveLength(4); // nombre_emisor, numero, total_centimos, lineas_iva
    expect(corrs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: "nombre_emisor",
          valor_anterior: "Restaurante Plaza",
          valor_nuevo: "Restaurante Plaza Mayor",
          usuario_id: "uA",
        }),
        expect.objectContaining({
          campo: "numero",
          valor_anterior: "T-2026-001",
          valor_nuevo: "T-2026-002",
          usuario_id: "uA",
        }),
        expect.objectContaining({
          campo: "total_centimos",
          valor_anterior: "2500",
          valor_nuevo: "3000",
          usuario_id: "uA",
        }),
      ]),
    );
  });

  it("re-ejecuta validar(): al corregir un NIF ajeno se resuelve la incidencia documental", () => {
    const bd = bdDePrueba();
    bd.prepare("UPDATE empresas SET nif = 'B11111119' WHERE id = 'A'").run();
    const repo = repositorioDeEmpresa(bd, "A");
    const r = recibirArchivo(repo, { nombre: "factura.png", bytes: PNG_A }, "subida", carpeta, HOY);
    const id = r.ok ? r.id : "";

    // Subida con NIF de receptor erróneo que bloquea
    repo.reclamarParaLectura(id, HOY);
    const exConError = ticket({ tipo: "factura_completa", nif_receptor: "B99999999" });
    repo.guardarLectura(id, {
      extraccion: exConError,
      motor: "falso",
      avisos: [{ codigo: "receptor_ajeno", nivel: "rojo", texto: "El documento va a nombre de otro NIF." }],
      cambio: null,
      estado: "incidencia",
      ahora: HOY,
    });

    expect(repo.obtenerDocumento(id)?.estado).toBe("incidencia");
    expect(repo.incidencias(id).filter((i) => i.estado === "abierta")).toHaveLength(1);

    // El usuario corrige el NIF del receptor para poner el de su empresa
    const docCorregido = repo.corregirDocumento(id, "uA", { nif_receptor: "B11111119" }, HOY);

    // La incidencia documental se ha resuelto automáticamente y el documento pasa a pendiente_revision
    expect(docCorregido.estado).toBe("pendiente_revision");
    const incs = repo.incidencias(id);
    expect(incs.find((i) => i.tipo === "documental")?.estado).toBe("resuelta");
  });

  it("si un documento validado se corrige, pierde la validación y vuelve a pendiente_revision", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const id = repo.crearDocumento(ORIGINAL, HOY);
    repo.corregirDocumento(
      id,
      "uA",
      {
        nombre_emisor: "Cafetería Sol",
        nif_emisor: "B12345678",
        fecha_emision: "2026-08-19",
        total_centimos: 500,
        numero: "FAC-100",
      },
      HOY,
    );

    // Validar manualmente
    const validado = repo.validarDocumento(id, "uA", HOY);
    expect(validado.estado).toBe("validado");
    expect(validado.validado_en).not.toBeNull();
    expect(validado.validado_por).toBe("uA");

    // Corregir un campo
    const trasCorreccion = repo.corregirDocumento(id, "uA", { numero: "FAC-999" }, HOY);
    expect(trasCorreccion.estado).toBe("pendiente_revision");
    expect(trasCorreccion.validado_en).toBeNull();
    expect(trasCorreccion.validado_por).toBeNull();
  });
});

describe("RF-06 · Botón «Validar»", () => {
  it("se bloquea si hay incidencias bloqueantes abiertas y solo valida cuando no hay", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const id = repo.crearDocumento(ORIGINAL, HOY);
    repo.cambiarEstado(id, "incidencia");
    repo.crearIncidencia({
      documentoId: id,
      tipo: "ilegible",
      bloqueante: 1,
      descripcion: "Ilegible",
    });

    // Intentar validar falla
    expect(() => repo.validarDocumento(id, "uA", HOY)).toThrow(/incidencias bloqueantes/);

    // Corregir los datos para que sea legible
    repo.corregirDocumento(
      id,
      "uA",
      {
        nombre_emisor: "Empresa Emisora SL",
        nif_emisor: "B12345678",
        numero: "FAC-1",
        fecha_emision: "2026-08-19",
        total_centimos: 1000,
        lineas_iva: [{ tipo_iva: 21, base_centimos: 826, cuota_centimos: 174 }],
      },
      HOY,
    );

    // Ahora no hay incidencias bloqueantes: se valida con éxito
    const docVal = repo.validarDocumento(id, "uA", HOY);
    expect(docVal.estado).toBe("validado");
    expect(docVal.validado_por).toBe("uA");
    expect(docVal.validado_en).not.toBeNull();
  });

  it("se bloquea si el documento está descartado", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const id = repo.crearDocumento(ORIGINAL, HOY);
    const incId = repo.crearIncidencia({
      documentoId: id,
      tipo: "duplicado",
      bloqueante: 1,
      descripcion: "Duplicado",
    });

    // El usuario descarta el documento
    repo.resolverIncidencia(incId, "descartado", "uA", HOY);
    const doc = repo.obtenerDocumento(id)!;
    expect(doc.descartado_en).not.toBeNull();

    expect(() => repo.validarDocumento(id, "uA", HOY)).toThrow(/descartado/);
  });
});

describe("RF-07 · Duplicados exactos y lógicos", () => {
  it("duplicado exacto: crea incidencia bloqueante que apunta al original", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const r1 = recibirArchivo(repo, { nombre: "doc1.png", bytes: PNG_A }, "subida", carpeta, HOY);
    expect(r1.ok).toBe(true);
    const r2 = recibirArchivo(repo, { nombre: "doc2.png", bytes: PNG_A }, "subida", carpeta, HOY);

    if (!r1.ok || !r2.ok) throw new Error("Subida fallida");
    expect(r2.duplicadoDe).toBe("doc1.png");

    const id1 = r1.id;
    const id2 = r2.id;

    const incs = repo.incidencias(id2);
    expect(incs).toHaveLength(1);
    expect(incs[0]).toMatchObject({
      tipo: "duplicado",
      bloqueante: 1,
      estado: "abierta",
      documento_referencia_id: id1,
    });
  });

  it("duplicado lógico: detectado tras lectura cuando coinciden NIF emisor, número, fecha y total", async () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");

    // Primer documento (subido con bytes PNG_A)
    const r1 = recibirArchivo(repo, { nombre: "factura1.png", bytes: PNG_A }, "subida", carpeta, HOY);
    const id1 = r1.ok ? r1.id : "";
    await procesarDocumento(
      repo,
      id1,
      deps(ticket({ nif_emisor: "B12345678", numero: "INV-100", fecha_emision: "2026-08-19", total_centimos: 5000 })),
    );

    // Segundo documento (bytes diferentes PNG_B, no es duplicado exacto)
    const r2 = recibirArchivo(repo, { nombre: "factura2.png", bytes: PNG_B }, "subida", carpeta, HOY);
    if (!r2.ok) throw new Error("Subida fallida");
    const id2 = r2.id;
    expect(r2.duplicadoDe).toBeUndefined();

    // Al procesar el segundo documento con los mismos datos clave:
    const estadoFinal = await procesarDocumento(
      repo,
      id2,
      deps(ticket({ nif_emisor: "B-12345678", numero: " inv-100 ", fecha_emision: "2026-08-19", total_centimos: 5000 })),
    );

    expect(estadoFinal).toBe("incidencia");
    const incs = repo.incidencias(id2);
    expect(incs).toEqual([
      expect.objectContaining({
        tipo: "duplicado",
        bloqueante: 1,
        estado: "abierta",
        documento_referencia_id: id1,
      }),
    ]);
  });

  it("duplicado lógico: detectado tras corrección y resuelto si se cambia el número", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");

    // Documento 1 existente
    const id1 = repo.crearDocumento(ORIGINAL, HOY);
    repo.corregirDocumento(
      id1,
      "uA",
      { nif_emisor: "A88888888", numero: "FAC-50", fecha_emision: "2026-07-01", total_centimos: 4000 },
      HOY,
    );

    // Documento 2 inicialmente diferente
    const id2 = repo.crearDocumento({ ...ORIGINAL, hash_sha256: "b".repeat(64), ruta_original: "A/bc.png" }, HOY);
    repo.corregirDocumento(
      id2,
      "uA",
      { nif_emisor: "A88888888", numero: "FAC-99", fecha_emision: "2026-07-01", total_centimos: 4000 },
      HOY,
    );
    expect(repo.incidencias(id2).filter((i) => i.tipo === "duplicado" && i.estado === "abierta")).toHaveLength(0);

    // El usuario edita documento 2 y pone el mismo número que documento 1
    repo.corregirDocumento(id2, "uA", { numero: "FAC-50" }, HOY);
    const incs2 = repo.incidencias(id2).filter((i) => i.tipo === "duplicado" && i.estado === "abierta");
    expect(incs2).toHaveLength(1);
    expect(incs2[0].documento_referencia_id).toBe(id1);

    // El usuario corrige de nuevo el número a uno diferente: la incidencia se resuelve
    repo.corregirDocumento(id2, "uA", { numero: "FAC-51" }, HOY);
    const incs2Despues = repo.incidencias(id2);
    expect(incs2Despues.find((i) => i.tipo === "duplicado")?.estado).toBe("resuelta");
  });

  it("resolución de duplicado: usuario marca 'no es duplicado' o 'descartar este documento'", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");

    const r1 = recibirArchivo(repo, { nombre: "doc1.png", bytes: PNG_A }, "subida", carpeta, HOY);
    expect(r1.ok).toBe(true);
    const r2 = recibirArchivo(repo, { nombre: "doc2.png", bytes: PNG_A }, "subida", carpeta, HOY);
    const id2 = r2.ok ? r2.id : "";

    const inc = repo.incidencias(id2)[0];
    expect(inc.estado).toBe("abierta");

    // Caso A: «No es duplicado»
    repo.resolverIncidencia(inc.id, "no_duplicado", "uA", HOY);
    const incResuelta = repo.incidencias(id2)[0];
    expect(incResuelta.estado).toBe("resuelta");
    expect(incResuelta.resuelta_por).toBe("uA");
    expect(incResuelta.motivo_resolucion).toBe("no_duplicado");
    expect(incResuelta.resuelta_en).not.toBeNull();

    // Caso B: nuevo duplicado que se descarta
    const r3 = recibirArchivo(repo, { nombre: "doc3.png", bytes: PNG_A }, "subida", carpeta, HOY);
    const id3 = r3.ok ? r3.id : "";
    const inc3 = repo.incidencias(id3)[0];
    repo.resolverIncidencia(inc3.id, "descartado", "uA", HOY);

    const doc3 = repo.obtenerDocumento(id3)!;
    expect(doc3.descartado_en).not.toBeNull();
    expect(doc3.descartado_por).toBe("uA");
  });
});

describe("Aislamiento entre empresas (RF-06 y RF-07)", () => {
  it("la empresa A no puede corregir ni validar documentos de la empresa B", () => {
    const bd = bdDePrueba();
    const repoA = repositorioDeEmpresa(bd, "A");
    const repoB = repositorioDeEmpresa(bd, "B");

    const idB = repoB.crearDocumento(ORIGINAL, HOY);

    expect(() => repoA.corregirDocumento(idB, "uA", { numero: "HACK" }, HOY)).toThrow(/otra empresa|no encontrado/);
    expect(() => repoA.validarDocumento(idB, "uA", HOY)).toThrow(/otra empresa|no encontrado/);
  });

  it("la empresa B no ve ni detecta duplicados frente a documentos de la empresa A", () => {
    const bd = bdDePrueba();
    const repoA = repositorioDeEmpresa(bd, "A");
    const repoB = repositorioDeEmpresa(bd, "B");

    // Empresa A sube un archivo
    const rA = recibirArchivo(repoA, { nombre: "a.png", bytes: PNG_A }, "subida", carpeta, HOY);
    const idA = rA.ok ? rA.id : "";
    repoA.corregirDocumento(
      idA,
      "uA",
      { nif_emisor: "B12345678", numero: "INV-1", fecha_emision: "2026-08-19", total_centimos: 1000 },
      HOY,
    );

    // Empresa B sube el MISMO archivo idéntico (mismo hash)
    const rB = recibirArchivo(repoB, { nombre: "b.png", bytes: PNG_A }, "subida", carpeta, HOY);
    if (!rB.ok) throw new Error("Subida fallida");
    expect(rB.duplicadoDe).toBeUndefined(); // Para B es nuevo
    const idB = rB.id;
    expect(repoB.incidencias(idB)).toHaveLength(0);

    // Empresa B pone los mismos datos fiscales que A en su documento: NO es duplicado porque es otra empresa
    const dupLogicoB = repoB.buscarDuplicadoLogico(idB, {
      nif_emisor: "B12345678",
      numero: "INV-1",
      fecha_emision: "2026-08-19",
      total_centimos: 1000,
    });
    expect(dupLogicoB).toBeUndefined();
  });

  it("el trigger de integridad de la BD impide asociar documento_referencia_id de otra empresa", () => {
    const bd = bdDePrueba();
    const idA = repositorioDeEmpresa(bd, "A").crearDocumento(ORIGINAL, HOY);
    const idB = repositorioDeEmpresa(bd, "B").crearDocumento({ ...ORIGINAL, ruta_original: "B/b.png" }, HOY);

    // Intentar colar en B una incidencia que apunte como referencia a un doc de A
    expect(() =>
      bd.prepare(
        "INSERT INTO incidencias (id, empresa_id, documento_id, tipo, bloqueante, descripcion, documento_referencia_id) VALUES ('i1', 'B', ?, 'duplicado', 1, 'x', ?)",
      ).run(idB, idA),
    ).toThrow(/referencia no pertenece a la misma empresa/);
  });
});
