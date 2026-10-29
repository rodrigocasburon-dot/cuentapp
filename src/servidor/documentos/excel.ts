// Generador de Excel del trimestre para el gestor (RF-09).
// Por defecto solo documentos VALIDADOS; con «incluir pendientes», todos, con
// su estado (guía legal, cap. 13). Los totales se calculan con lo exportado.

import ExcelJS from "exceljs";
import { etiquetaCategoria } from "@/dominio/categorias";
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, type TipoDocumento } from "@/dominio/estados";
import { AVISO } from "@/dominio/legal";
import type { ResultadoSemaforo } from "@/dominio/semaforo";
import type { FilaDocumento, FilaLineaIva } from "@/servidor/bd/repositorio";

export interface DatosExportacionTrimestre {
  empresa: {
    nombre: string;
    nif: string | null;
  };
  anio: number;
  trimestre: number;
  semaforo: ResultadoSemaforo;
  documentos: (FilaDocumento & { lineasIva: FilaLineaIva[] })[];
  /** false (por defecto): solo validados. true: todos, con su estado. */
  incluirPendientes?: boolean;
  generadoEn?: Date;
}

const COLOR_SEMAFORO_EXCEL: Record<string, string> = {
  verde: "15803D",
  ambar: "B45309",
  rojo: "B91C1C",
  vacio: "6B5B4E",
};

/**
 * Texto de terceros (emisor, número…) que empieza como una fórmula se guarda
 * con un apóstrofo delante, para que ninguna hoja de cálculo lo ejecute.
 */
export function textoSeguro(v: string | null | undefined): string {
  const t = v ?? "";
  return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
}

const EUROS = '#,##0.00 "€"';

export async function generarExcelTrimestre(datos: DatosExportacionTrimestre): Promise<Uint8Array> {
  const docs = datos.incluirPendientes ? datos.documentos : datos.documentos.filter((d) => d.estado === "validado");
  const excluidos = datos.documentos.length - docs.length;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cuentapp";
  wb.created = datos.generadoEn ?? new Date();

  const ws = wb.addWorksheet(`Documentos ${datos.trimestre}T ${datos.anio}`, { views: [{ showGridLines: true }] });

  // 1) Cabecera
  ws.mergeCells("A1:P1");
  const titulo = ws.getCell("A1");
  titulo.value = "CUENTAPP — RESUMEN DEL TRIMESTRE";
  titulo.font = { bold: true, size: 14, color: { argb: "FFFFFF" } };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "15171C" } };
  titulo.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 30;

  ws.getCell("A3").value = "Empresa:";
  ws.getCell("B3").value = textoSeguro(datos.empresa.nombre);
  ws.getCell("D3").value = "NIF:";
  ws.getCell("E3").value = textoSeguro(datos.empresa.nif ?? "No consta");
  ws.getCell("A4").value = "Periodo:";
  ws.getCell("B4").value = `${datos.trimestre}T ${datos.anio}`;
  ws.getCell("D4").value = "Generado el:";
  ws.getCell("E4").value = (datos.generadoEn ?? new Date()).toISOString().slice(0, 10);
  ws.getCell("A5").value = "Incluye:";
  ws.getCell("B5").value = datos.incluirPendientes
    ? `Todos los documentos (${docs.length}), con su estado`
    : `Solo validados (${docs.length}); excluidos ${excluidos} sin validar`;

  ws.getCell("G3").value = "Semáforo del trimestre:";
  ws.getCell("G3").font = { bold: true };
  const celdaSemaforo = ws.getCell("H3");
  celdaSemaforo.value = datos.semaforo.color === "vacio" ? "SIN DOCUMENTOS" : datos.semaforo.color.toUpperCase();
  celdaSemaforo.font = { bold: true, color: { argb: "FFFFFF" } };
  celdaSemaforo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SEMAFORO_EXCEL[datos.semaforo.color] ?? "000000" } };
  celdaSemaforo.alignment = { horizontal: "center" };
  ws.getCell("G4").value = "Diagnóstico:";
  ws.getCell("H4").value = datos.semaforo.motivo;
  ws.mergeCells("H4:P4");
  ws.mergeCells("A6:P6");
  ws.getCell("A6").value = AVISO.excel;
  ws.getCell("A6").font = { italic: true, color: { argb: "4A4F57" } };
  ["A3", "A4", "A5", "D3", "D4"].forEach((c) => (ws.getCell(c).font = { bold: true, color: { argb: "4A4F57" } }));

  // 2) Tabla: una fila por línea de IVA
  const filaInicio = 8;
  const columnas = [
    ["Fecha", 12], ["Tipo", 20], ["Número", 16], ["Emisor", 28], ["NIF emisor", 14], ["NIF receptor", 14],
    ["Base (€)", 13], ["Tipo IVA", 10], ["Cuota (€)", 13], ["Total (€)", 14],
    ["Moneda", 9], ["Total original", 14], ["Tipo de cambio", 14], ["Estado", 20], ["Referencia", 12], ["Categoría", 26],
  ] as const;
  const cabecera = ws.getRow(filaInicio);
  columnas.forEach(([nombre, ancho], i) => {
    const c = cabecera.getCell(i + 1);
    c.value = nombre;
    c.font = { bold: true, color: { argb: "FFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2A2D35" } };
    ws.getColumn(i + 1).width = ancho;
  });
  cabecera.height = 24;

  let fila = filaInicio + 1;
  let base = 0, cuota = 0, total = 0;
  const desglose = new Map<number, { base: number; cuota: number }>();
  const porCategoria = new Map<string, { documentos: number; base: number; cuota: number; total: number }>();

  for (const d of docs) {
    // En euros: si es moneda extranjera, base y cuota se convierten con el mismo tipo que el total
    const cambio = d.moneda && d.moneda !== "EUR" && d.tipo_cambio ? d.tipo_cambio : 1;
    const eur = (c: number) => Math.round(c / cambio);
    const totalEur = d.total_eur_centimos ?? d.total_centimos ?? 0;
    total += totalEur;
    const categoria = etiquetaCategoria(d.categoria);
    const cat = porCategoria.get(categoria) ?? { documentos: 0, base: 0, cuota: 0, total: 0 };
    cat.documentos++;
    cat.total += totalEur;
    porCategoria.set(categoria, cat);
    const lineas = d.lineasIva.length ? d.lineasIva : [{ tipo_iva: null, base_centimos: d.base_centimos ?? 0, cuota_centimos: d.cuota_centimos ?? 0 }];

    lineas.forEach((l, i) => {
      const r = ws.getRow(fila++);
      const b = eur(l.base_centimos), q = eur(l.cuota_centimos);
      base += b;
      cuota += q;
      cat.base += b;
      cat.cuota += q;
      if (l.tipo_iva !== null) {
        const acc = desglose.get(l.tipo_iva) ?? { base: 0, cuota: 0 };
        desglose.set(l.tipo_iva, { base: acc.base + b, cuota: acc.cuota + q });
      }
      r.values = [
        d.fecha_emision ?? "",
        d.tipo ? ETIQUETA_TIPO[d.tipo as TipoDocumento] : "No consta",
        textoSeguro(d.numero),
        textoSeguro(d.nombre_emisor),
        textoSeguro(d.nif_emisor),
        textoSeguro(d.nif_receptor),
        b / 100,
        l.tipo_iva === null ? "—" : `${l.tipo_iva} %`,
        q / 100,
        i === 0 ? totalEur / 100 : null,
        d.moneda ?? "",
        i === 0 && d.moneda && d.moneda !== "EUR" && d.total_centimos !== null ? d.total_centimos / 100 : null,
        i === 0 && d.tipo_cambio ? `${d.tipo_cambio} (BCE ${d.fecha_cambio ?? "—"})` : "",
        ETIQUETA_ESTADO[d.estado] ?? d.estado,
        d.id.slice(0, 8),
        categoria,
      ];
      [7, 9, 10, 12].forEach((c) => (r.getCell(c).numFmt = c === 12 ? "#,##0.00" : EUROS));
    });
  }

  // 3) Totales (de lo exportado)
  const tot = ws.getRow(fila);
  tot.getCell(1).value = "TOTALES";
  ws.mergeCells(`A${fila}:F${fila}`);
  tot.getCell(1).alignment = { horizontal: "right" };
  tot.getCell(7).value = base / 100;
  tot.getCell(9).value = cuota / 100;
  tot.getCell(10).value = total / 100;
  [7, 9, 10].forEach((c) => (tot.getCell(c).numFmt = EUROS));
  tot.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EEF1E6" } };
    c.border = { top: { style: "thin" }, bottom: { style: "double" } };
  });

  // 4) Hoja 2: desglose por tipo de IVA
  if (desglose.size > 0) {
    const h = wb.addWorksheet("Desglose IVA");
    h.mergeCells("A1:C1");
    h.getCell("A1").value = `DESGLOSE DE IVA — ${datos.trimestre}T ${datos.anio}`;
    h.getCell("A1").font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
    h.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "15171C" } };
    h.getRow(3).values = ["Tipo IVA", "Base imponible (€)", "Cuota IVA (€)"];
    h.getRow(3).font = { bold: true };
    [16, 22, 22].forEach((w, i) => (h.getColumn(i + 1).width = w));
    let f = 4;
    for (const [tipo, v] of [...desglose].sort((a, b) => b[0] - a[0])) {
      h.getRow(f).values = [`${tipo} %`, v.base / 100, v.cuota / 100];
      h.getRow(f).getCell(2).numFmt = EUROS;
      h.getRow(f).getCell(3).numFmt = EUROS;
      f++;
    }
    h.getRow(f).values = ["TOTAL", base / 100, cuota / 100];
    h.getRow(f).font = { bold: true };
    h.getRow(f).getCell(2).numFmt = EUROS;
    h.getRow(f).getCell(3).numFmt = EUROS;
  }

  // 5) Hoja 3: gasto por categoría (RFQ, «Informes»)
  if (porCategoria.size > 0) {
    const h = wb.addWorksheet("Por categoría");
    h.mergeCells("A1:E1");
    h.getCell("A1").value = `GASTO POR CATEGORÍA — ${datos.trimestre}T ${datos.anio}`;
    h.getCell("A1").font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
    h.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "15171C" } };
    h.getRow(3).values = ["Categoría", "Documentos", "Base imponible (€)", "Cuota IVA (€)", "Total (€)"];
    h.getRow(3).font = { bold: true };
    [32, 13, 20, 18, 16].forEach((w, i) => (h.getColumn(i + 1).width = w));
    let f = 4;
    for (const [nombre, v] of [...porCategoria].sort((a, b) => b[1].total - a[1].total)) {
      h.getRow(f).values = [nombre, v.documentos, v.base / 100, v.cuota / 100, v.total / 100];
      [3, 4, 5].forEach((c) => (h.getRow(f).getCell(c).numFmt = EUROS));
      f++;
    }
    h.getRow(f).values = ["TOTAL", docs.length, base / 100, cuota / 100, total / 100];
    h.getRow(f).font = { bold: true };
    [3, 4, 5].forEach((c) => (h.getRow(f).getCell(c).numFmt = EUROS));
  }

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
