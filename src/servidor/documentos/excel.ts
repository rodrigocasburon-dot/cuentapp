// Generador de Excel del trimestre para el gestor (RF-09).
// Exporta los documentos con sus importes en euros, desglose de IVA y sumas.

import ExcelJS from "exceljs";
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, type TipoDocumento } from "@/dominio/estados";
import type { FilaDocumento, FilaLineaIva } from "@/servidor/bd/repositorio";
import type { ResultadoSemaforo } from "@/dominio/semaforo";

export interface DatosExportacionTrimestre {
  empresa: {
    nombre: string;
    nif: string | null;
  };
  anio: number;
  trimestre: number;
  semaforo: ResultadoSemaforo;
  documentos: (FilaDocumento & { lineasIva: FilaLineaIva[] })[];
  generadoEn?: Date;
}

const COLOR_SEMAFORO_EXCEL: Record<string, string> = {
  verde: "15803D", // verde oscuro
  ambar: "B45309", // ámbar oscuro
  rojo: "B91C1C",  // rojo oscuro
  vacio: "6B5B4E", // gris marrón
};

export async function generarExcelTrimestre(datos: DatosExportacionTrimestre): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cuentapp";
  wb.created = datos.generadoEn ?? new Date();

  const ws = wb.addWorksheet(`Trimestre ${datos.trimestre}T ${datos.anio}`, {
    views: [{ showGridLines: true }],
  });

  // 1) Cabecera de la empresa y trimestre
  ws.mergeCells("A1:K1");
  const celdaTitulo = ws.getCell("A1");
  celdaTitulo.value = "CUENTAPP — RESUMEN CONTABLE TRIMESTRAL";
  celdaTitulo.font = { bold: true, size: 14, color: { argb: "FFFFFF" } };
  celdaTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2E1C14" } }; // marrón oscuro
  celdaTitulo.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 30;

  ws.getCell("A3").value = "Empresa:";
  ws.getCell("B3").value = datos.empresa.nombre;
  ws.getCell("D3").value = "NIF:";
  ws.getCell("E3").value = datos.empresa.nif ?? "No consta";

  ws.getCell("A4").value = "Periodo:";
  ws.getCell("B4").value = `${datos.trimestre}T ${datos.anio}`;
  ws.getCell("D4").value = "Generado el:";
  ws.getCell("E4").value = (datos.generadoEn ?? new Date()).toISOString().slice(0, 10);

  // Semáforo en la cabecera
  ws.getCell("G3").value = "Semáforo del trimestre:";
  ws.getCell("G3").font = { bold: true };
  const celdaSemaforo = ws.getCell("H3");
  celdaSemaforo.value = datos.semaforo.color === "vacio" ? "SIN DOCUMENTOS" : datos.semaforo.color.toUpperCase();
  celdaSemaforo.font = { bold: true, color: { argb: "FFFFFF" } };
  celdaSemaforo.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOR_SEMAFORO_EXCEL[datos.semaforo.color] ?? "000000" },
  };
  celdaSemaforo.alignment = { horizontal: "center" };

  ws.getCell("G4").value = "Diagnóstico:";
  ws.getCell("H4").value = datos.semaforo.motivo;
  ws.mergeCells("H4:K4");

  ["A3", "A4", "D3", "D4"].forEach((c) => {
    ws.getCell(c).font = { bold: true, color: { argb: "555555" } };
  });

  // 2) Tabla de documentos
  const filaInicioTabla = 6;
  const columnas = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Tipo", key: "tipo", width: 20 },
    { header: "Número", key: "numero", width: 16 },
    { header: "Emisor", key: "emisor", width: 28 },
    { header: "NIF Emisor", key: "nif_emisor", width: 15 },
    { header: "NIF Receptor", key: "nif_receptor", width: 15 },
    { header: "Base (€)", key: "base", width: 14 },
    { header: "Tipo IVA", key: "tipo_iva", width: 12 },
    { header: "Cuota IVA (€)", key: "cuota", width: 14 },
    { header: "Total (€)", key: "total", width: 16 },
    { header: "Estado", key: "estado", width: 18 },
  ];

  const filaCabecera = ws.getRow(filaInicioTabla);
  columnas.forEach((col, idx) => {
    const celda = filaCabecera.getCell(idx + 1);
    celda.value = col.header;
    celda.font = { bold: true, color: { argb: "FFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4A3528" } };
    celda.alignment = { vertical: "middle", horizontal: idx >= 6 && idx <= 9 ? "right" : "left" };
    ws.getColumn(idx + 1).width = col.width;
  });
  filaCabecera.height = 24;

  let numFilaActual = filaInicioTabla + 1;

  for (const doc of datos.documentos) {
    const totalEur = (doc.total_eur_centimos ?? doc.total_centimos ?? 0) / 100;
    const tipoTexto = doc.tipo ? ETIQUETA_TIPO[doc.tipo as TipoDocumento] : "No consta";
    const estadoTexto = ETIQUETA_ESTADO[doc.estado] ?? doc.estado;

    if (doc.lineasIva.length > 0) {
      // Documento con una o varias líneas de IVA
      doc.lineasIva.forEach((l, lIdx) => {
        const row = ws.getRow(numFilaActual);
        row.getCell(1).value = doc.fecha_emision ?? "";
        row.getCell(2).value = tipoTexto;
        row.getCell(3).value = doc.numero ?? "";
        row.getCell(4).value = doc.nombre_emisor ?? "";
        row.getCell(5).value = doc.nif_emisor ?? "";
        row.getCell(6).value = doc.nif_receptor ?? "";
        row.getCell(7).value = l.base_centimos / 100;
        row.getCell(8).value = `${l.tipo_iva} %`;
        row.getCell(9).value = l.cuota_centimos / 100;
        // El total lo mostramos en la primera línea del documento
        row.getCell(10).value = lIdx === 0 ? totalEur : null;
        row.getCell(11).value = estadoTexto;

        // Formatos numéricos
        row.getCell(7).numFmt = '#,##0.00 "€"';
        row.getCell(9).numFmt = '#,##0.00 "€"';
        row.getCell(10).numFmt = '#,##0.00 "€"';
        row.getCell(8).alignment = { horizontal: "center" };

        numFilaActual++;
      });
    } else {
      // Sin desglose de IVA (ej. ticket simple sin líneas leídas aún)
      const baseEur = (doc.base_centimos ?? 0) / 100;
      const cuotaEur = (doc.cuota_centimos ?? 0) / 100;
      const row = ws.getRow(numFilaActual);
      row.getCell(1).value = doc.fecha_emision ?? "";
      row.getCell(2).value = tipoTexto;
      row.getCell(3).value = doc.numero ?? "";
      row.getCell(4).value = doc.nombre_emisor ?? "";
      row.getCell(5).value = doc.nif_emisor ?? "";
      row.getCell(6).value = doc.nif_receptor ?? "";
      row.getCell(7).value = baseEur;
      row.getCell(8).value = "—";
      row.getCell(9).value = cuotaEur;
      row.getCell(10).value = totalEur;
      row.getCell(11).value = estadoTexto;

      row.getCell(7).numFmt = '#,##0.00 "€"';
      row.getCell(9).numFmt = '#,##0.00 "€"';
      row.getCell(10).numFmt = '#,##0.00 "€"';
      row.getCell(8).alignment = { horizontal: "center" };

      numFilaActual++;
    }
  }

  // 3) Fila de Totales
  const filaTotales = ws.getRow(numFilaActual);
  filaTotales.getCell(1).value = "TOTALES";
  filaTotales.getCell(1).font = { bold: true };
  ws.mergeCells(`A${numFilaActual}:F${numFilaActual}`);
  filaTotales.getCell(1).alignment = { horizontal: "right" };

  filaTotales.getCell(7).value = datos.semaforo.baseCentimos / 100;
  filaTotales.getCell(7).numFmt = '#,##0.00 "€"';
  filaTotales.getCell(7).font = { bold: true };

  filaTotales.getCell(9).value = datos.semaforo.cuotaCentimos / 100;
  filaTotales.getCell(9).numFmt = '#,##0.00 "€"';
  filaTotales.getCell(9).font = { bold: true };

  filaTotales.getCell(10).value = datos.semaforo.totalCentimos / 100;
  filaTotales.getCell(10).numFmt = '#,##0.00 "€"';
  filaTotales.getCell(10).font = { bold: true };

  filaTotales.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F0ECE1" } };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "double" },
    };
  });

  // 4) Hoja 2: Desglose por tipo de IVA
  if (datos.semaforo.desgloseIva.length > 0) {
    const wsIva = wb.addWorksheet("Resumen IVA");
    wsIva.views = [{ showGridLines: true }];

    wsIva.mergeCells("A1:C1");
    wsIva.getCell("A1").value = `RESUMEN IVA — ${datos.trimestre}T ${datos.anio}`;
    wsIva.getCell("A1").font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
    wsIva.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2E1C14" } };
    wsIva.getCell("A1").alignment = { horizontal: "center" };

    const cabIva = wsIva.getRow(3);
    cabIva.getCell(1).value = "Tipo IVA";
    cabIva.getCell(2).value = "Base Imponible (€)";
    cabIva.getCell(3).value = "Cuota IVA (€)";
    [1, 2, 3].forEach((i) => {
      cabIva.getCell(i).font = { bold: true, color: { argb: "FFFFFF" } };
      cabIva.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4A3528" } };
    });
    wsIva.getColumn(1).width = 16;
    wsIva.getColumn(2).width = 24;
    wsIva.getColumn(3).width = 24;

    let fIva = 4;
    for (const item of datos.semaforo.desgloseIva) {
      const r = wsIva.getRow(fIva);
      r.getCell(1).value = `${item.tipo_iva} %`;
      r.getCell(1).alignment = { horizontal: "center" };
      r.getCell(2).value = item.base_centimos / 100;
      r.getCell(2).numFmt = '#,##0.00 "€"';
      r.getCell(3).value = item.cuota_centimos / 100;
      r.getCell(3).numFmt = '#,##0.00 "€"';
      fIva++;
    }

    const rTot = wsIva.getRow(fIva);
    rTot.getCell(1).value = "TOTAL";
    rTot.getCell(1).font = { bold: true };
    rTot.getCell(2).value = datos.semaforo.baseCentimos / 100;
    rTot.getCell(2).numFmt = '#,##0.00 "€"';
    rTot.getCell(2).font = { bold: true };
    rTot.getCell(3).value = datos.semaforo.cuotaCentimos / 100;
    rTot.getCell(3).numFmt = '#,##0.00 "€"';
    rTot.getCell(3).font = { bold: true };
    rTot.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F0ECE1" } };
      c.border = { top: { style: "thin" }, bottom: { style: "double" } };
    });
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(arrayBuffer);
}
