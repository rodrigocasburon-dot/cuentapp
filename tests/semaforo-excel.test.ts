// Semáforo del trimestre y Excel para el gestor (RF-09, fase 7).

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { calcularSemaforo, type DocumentoParaSemaforo } from "@/dominio/semaforo";
import type { Aviso } from "@/dominio/validaciones";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { generarExcelTrimestre, textoSeguro } from "@/servidor/documentos/excel";
import { bdDePrueba, ORIGINAL } from "./ayudas";

const HOY = new Date("2026-10-29T10:00:00Z");
const ambar: Aviso = { codigo: "falta_nif_emisor", nivel: "ambar", texto: "x" };
const rojo: Aviso = { codigo: "receptor_ajeno", nivel: "rojo", texto: "x" };
const info: Aviso = { codigo: "ticket_sin_nif_receptor", nivel: "info", texto: "x" };

function doc(cambios: Partial<DocumentoParaSemaforo> = {}): DocumentoParaSemaforo {
  return {
    id: Math.random().toString(36), estado: "validado", tipo: "ticket_simplificado", nif_emisor: "B00000000", nif_receptor: null,
    total_eur_centimos: 121, total_centimos: 121, base_centimos: 100, cuota_centimos: 21,
    avisos: [], tieneIncidenciasBloqueantes: false, descartado: false, ...cambios,
  };
}

describe("reglas del semáforo", () => {
  it("verde: todo validado y sin incidencias abiertas; los avisos info no cuentan", () => {
    expect(calcularSemaforo([doc(), doc({ avisos: [info] })]).color).toBe("verde");
  });

  it("verde también si un documento VALIDADO conserva avisos ámbar o rojos ya resueltos", () => {
    expect(calcularSemaforo([doc({ avisos: [ambar] }), doc({ avisos: [rojo] })]).color).toBe("verde");
  });

  it("ámbar: algún documento sin validar (recibido, procesando o pendiente)", () => {
    for (const estado of ["recibido", "procesando", "pendiente_revision"] as const) {
      expect(calcularSemaforo([doc(), doc({ estado })]).color).toBe("ambar");
    }
  });

  it("rojo: alguna incidencia bloqueante abierta, aunque el resto esté validado", () => {
    const r = calcularSemaforo([doc(), doc({ estado: "incidencia", tieneIncidenciasBloqueantes: true })]);
    expect(r.color).toBe("rojo");
    expect(r.incidencias).toBe(1);
  });

  it("los documentos en la papelera no cuentan; un trimestre vacío no es «listo»", () => {
    expect(calcularSemaforo([doc({ estado: "pendiente_revision", descartado: true })]).color).toBe("vacio");
    expect(calcularSemaforo([]).color).toBe("vacio");
  });

  it("suma totales en euros y agrupa el IVA por tipo", () => {
    const r = calcularSemaforo([doc(), doc({ total_eur_centimos: 4304, total_centimos: 4999 })], [
      { tipo_iva: 21, base_centimos: 100, cuota_centimos: 21 },
      { tipo_iva: 21, base_centimos: 200, cuota_centimos: 42 },
      { tipo_iva: 10, base_centimos: 50, cuota_centimos: 5 },
    ]);
    expect(r.totalCentimos).toBe(121 + 4304);
    expect(r.desgloseIva).toEqual([
      { tipo_iva: 21, base_centimos: 300, cuota_centimos: 63 },
      { tipo_iva: 10, base_centimos: 50, cuota_centimos: 5 },
    ]);
  });
});

describe("semáforo desde la base de datos", () => {
  it("una incidencia resuelta deja de poner el trimestre en rojo", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const id = repo.crearDocumento(ORIGINAL, HOY);
    repo.corregirDocumento(id, "uA", { nombre_emisor: "Bar", nif_emisor: "B00000000", numero: "1", fecha_emision: "2026-08-19", total_centimos: 121, lineas_iva: [{ tipo_iva: 21, base_centimos: 100, cuota_centimos: 21 }] }, HOY);
    const otro = repo.crearDocumento({ ...ORIGINAL, hash_sha256: "b".repeat(64) }, HOY);
    const inc = repo.crearIncidencia({ documentoId: id, tipo: "duplicado", bloqueante: 1, descripcion: "x", documentoReferenciaId: otro });
    repo.moverAPapelera(otro, "uA", HOY);
    expect(repo.resumenTrimestre(2026, 3).color).toBe("rojo");
    repo.resolverIncidencia(inc, "no_duplicado", "uA", HOY);
    repo.validarDocumento(id, "uA", HOY);
    expect(repo.resumenTrimestre(2026, 3).color).toBe("verde");
    expect(repositorioDeEmpresa(bd, "B").resumenTrimestre(2026, 3).color).toBe("vacio"); // B no ve lo de A
  });
});

describe("Excel del trimestre", () => {
  it("genera un .xlsx con una fila por línea de IVA, totales y la hoja de resumen", async () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const id = repo.crearDocumento(ORIGINAL, HOY);
    repo.corregirDocumento(id, "uA", {
      nombre_emisor: "Bar Prueba", nif_emisor: "B00000000", numero: "T-1", fecha_emision: "2026-08-19", total_centimos: 1150,
      lineas_iva: [{ tipo_iva: 21, base_centimos: 500, cuota_centimos: 105 }, { tipo_iva: 10, base_centimos: 495, cuota_centimos: 50 }],
    }, HOY);

    const leer = async (incluirPendientes: boolean) => {
      const bytes = await generarExcelTrimestre({
        empresa: { nombre: "Empresa A", nif: null }, anio: 2026, trimestre: 3, incluirPendientes,
        semaforo: repo.resumenTrimestre(2026, 3), documentos: repo.documentosDelTrimestre(2026, 3), generadoEn: HOY,
      });
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
      return wb;
    };

    // Con pendientes: el documento sin validar aparece con su estado
    const wb = await leer(true);
    const hoja = wb.worksheets[0];
    expect(hoja.getCell("B3").value).toBe("Empresa A");
    expect(hoja.getCell("H3").value).toBe("AMBAR"); // sin validar
    expect(hoja.getRow(9).getCell(4).value).toBe("Bar Prueba");
    expect([hoja.getRow(9).getCell(7).value, hoja.getRow(10).getCell(7).value].sort()).toEqual([4.95, 5]);
    expect(hoja.getRow(9).getCell(14).value).toBe("Pendiente de revisión");
    expect(hoja.getRow(11).getCell(1).value).toBe("TOTALES");
    expect(hoja.getRow(11).getCell(10).value).toBe(11.5);
    expect(wb.getWorksheet("Desglose IVA")).toBeDefined();

    // Por defecto, solo validados: este no sale y los totales son cero
    const soloValidados = (await leer(false)).worksheets[0];
    expect(soloValidados.getCell("B5").value).toMatch(/Solo validados \(0\); excluidos 1/);
    expect(soloValidados.getRow(9).getCell(1).value).toBe("TOTALES");
  });

  it("un texto de terceros que parece una fórmula se guarda como texto", () => {
    expect(textoSeguro("=HYPERLINK(\"http://x\")")).toBe("'=HYPERLINK(\"http://x\")");
    expect(textoSeguro("+34 600")).toBe("'+34 600");
    expect(textoSeguro("Bar Pepe")).toBe("Bar Pepe");
    expect(textoSeguro(null)).toBe("");
  });
});
