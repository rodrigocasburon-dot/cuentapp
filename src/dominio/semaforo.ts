// Reglas del Semáforo del Trimestre (propuesta de valor de Cuentapp).
// Determina si los documentos de un trimestre están listos para el gestor:
//   Rojo: alguna incidencia bloqueante ABIERTA (duplicado sin resolver,
//         ilegible, problema documental). Una incidencia resuelta ya no cuenta.
//   Ámbar: algún documento sin validar (recibido, procesando, pendiente), o
//          sin validar con avisos ámbar (campos dudosos, factura sin NIF…).
//          Validar es la decisión manual de que el documento está bien, así
//          que los avisos ámbar de un documento VALIDADO ya no cuentan.
//   Verde: todo validado y sin incidencias abiertas.
//   Sin documentos: trimestre vacío (no es «listo para el gestor»).
//   Los avisos «info» (p. ej. ticket sin NIF del receptor) nunca cambian el color.

import type { Estado, TipoDocumento } from "./estados";
import type { Aviso } from "./validaciones";

export type ColorSemaforo = "verde" | "ambar" | "rojo" | "vacio";

export const ICONO_SEMAFORO: Record<ColorSemaforo, string> = {
  verde: "🟢",
  ambar: "🟡",
  rojo: "🔴",
  vacio: "⚪",
};

export const TEXTO_SEMAFORO: Record<ColorSemaforo, string> = {
  verde: "Verde · Listo para el gestor",
  ambar: "Ámbar · Revisión pendiente",
  rojo: "Rojo · Incidencias bloqueantes",
  vacio: "Sin documentos",
};

export interface DocumentoParaSemaforo {
  id: string;
  estado: Estado;
  tipo: TipoDocumento | null;
  nif_emisor: string | null;
  nif_receptor: string | null;
  total_eur_centimos: number | null;
  total_centimos: number | null;
  base_centimos: number | null;
  cuota_centimos: number | null;
  avisos: Aviso[];
  tieneIncidenciasBloqueantes: boolean;
  descartado: boolean;
}

export interface LineaIvaResumen {
  tipo_iva: number;
  base_centimos: number;
  cuota_centimos: number;
}

export interface ResultadoSemaforo {
  color: ColorSemaforo;
  motivo: string;
  totalDocumentos: number;
  validados: number;
  pendientes: number;
  incidencias: number;
  descartados: number;
  totalCentimos: number;
  baseCentimos: number;
  cuotaCentimos: number;
  desgloseIva: LineaIvaResumen[];
}

export function fechasTrimestre(anio: number, trimestre: number): { inicio: string; fin: string } {
  const t = Math.min(Math.max(trimestre, 1), 4);
  switch (t) {
    case 1:
      return { inicio: `${anio}-01-01`, fin: `${anio}-03-31` };
    case 2:
      return { inicio: `${anio}-04-01`, fin: `${anio}-06-30` };
    case 3:
      return { inicio: `${anio}-07-01`, fin: `${anio}-09-30` };
    case 4:
    default:
      return { inicio: `${anio}-10-01`, fin: `${anio}-12-31` };
  }
}

/**
 * Calcula el color del semáforo para un conjunto de documentos de un trimestre.
 */
export function calcularSemaforo(
  documentos: DocumentoParaSemaforo[],
  lineasIva: LineaIvaResumen[] = [],
): ResultadoSemaforo {
  const activos = documentos.filter((d) => !d.descartado);
  const descartados = documentos.filter((d) => d.descartado).length;

  const validados = activos.filter((d) => d.estado === "validado").length;
  const incidencias = activos.filter(
    (d) => d.estado === "incidencia" || d.tieneIncidenciasBloqueantes,
  ).length;
  const pendientes = activos.filter(
    (d) => d.estado !== "validado" && d.estado !== "incidencia" && !d.tieneIncidenciasBloqueantes,
  ).length;

  const totalCentimos = activos.reduce(
    (acc, d) => acc + (d.total_eur_centimos ?? d.total_centimos ?? 0),
    0,
  );
  const baseCentimos = activos.reduce((acc, d) => acc + (d.base_centimos ?? 0), 0);
  const cuotaCentimos = activos.reduce((acc, d) => acc + (d.cuota_centimos ?? 0), 0);

  // Consolidar líneas de IVA agrupadas por tipo
  const mapaIva = new Map<number, { base: number; cuota: number }>();
  for (const l of lineasIva) {
    const prev = mapaIva.get(l.tipo_iva) ?? { base: 0, cuota: 0 };
    mapaIva.set(l.tipo_iva, {
      base: prev.base + l.base_centimos,
      cuota: prev.cuota + l.cuota_centimos,
    });
  }
  const desgloseIva: LineaIvaResumen[] = Array.from(mapaIva.entries())
    .map(([tipo_iva, { base, cuota }]) => ({
      tipo_iva,
      base_centimos: base,
      cuota_centimos: cuota,
    }))
    .sort((a, b) => b.tipo_iva - a.tipo_iva);

  if (activos.length === 0) {
    return {
      color: "vacio",
      motivo: "Sin documentos en este trimestre.",
      totalDocumentos: 0,
      validados: 0,
      pendientes: 0,
      incidencias: 0,
      descartados,
      totalCentimos: 0,
      baseCentimos: 0,
      cuotaCentimos: 0,
      desgloseIva: [],
    };
  }

  // 1) ROJO: incidencias bloqueantes abiertas (no avisos antiguos ya resueltos)
  const bloqueantes = activos.filter((d) => d.tieneIncidenciasBloqueantes);
  if (bloqueantes.length > 0) {
    return {
      color: "rojo",
      motivo: `${bloqueantes.length} ${
        bloqueantes.length === 1 ? "documento tiene incidencias bloqueantes" : "documentos tienen incidencias bloqueantes"
      } (duplicados, ilegibles o problemas documentales).`,
      totalDocumentos: activos.length,
      validados,
      pendientes,
      incidencias,
      descartados,
      totalCentimos,
      baseCentimos,
      cuotaCentimos,
      desgloseIva,
    };
  }

  // 2) ÁMBAR: documentos sin validar (los validados ya los revisó una persona)
  const sinValidar = activos.filter((d) => d.estado !== "validado");
  const conAvisosAmbar = sinValidar.filter((d) => d.avisos.some((a) => a.nivel === "ambar"));
  if (sinValidar.length > 0 || conAvisosAmbar.length > 0) {
    const motivos: string[] = [];
    if (sinValidar.length > 0) {
      motivos.push(`${sinValidar.length} pendiente${sinValidar.length === 1 ? "" : "s"} de validación`);
    }
    if (conAvisosAmbar.length > 0) {
      motivos.push(`${conAvisosAmbar.length} con advertencias o campos dudosos`);
    }
    return {
      color: "ambar",
      motivo: `Revisión requerida: ${motivos.join(", ")}.`,
      totalDocumentos: activos.length,
      validados,
      pendientes,
      incidencias,
      descartados,
      totalCentimos,
      baseCentimos,
      cuotaCentimos,
      desgloseIva,
    };
  }

  // 3) VERDE: todo validado y sin incidencias
  return {
    color: "verde",
    motivo: "Todos los documentos están validados y sin incidencias. Listos para el gestor.",
    totalDocumentos: activos.length,
    validados,
    pendientes: 0,
    incidencias: 0,
    descartados,
    totalCentimos,
    baseCentimos,
    cuotaCentimos,
    desgloseIva,
  };
}
