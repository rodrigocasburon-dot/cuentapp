// extractInvoice: la ÚNICA puerta de la app a la lectura automática.
// Hoy usa el motor B (RapidOCR + analizador común), elegido en la fase 2.
// Si se cambia de motor, solo cambia este fichero: el resto de la app recibe
// siempre una Extraccion validada con zod y con confianza por campo.

import { analizarTexto } from "@/lectura/analizar-texto";
import { ExtraccionSchema, type Extraccion } from "@/lectura/esquema";
import { servicioOcr } from "./servicio-ocr";

export interface ResultadoLectura {
  extraccion: Extraccion;
  motor: string;     // se guarda en documentos.motor_lectura
  segundos: number;
}

/**
 * El archivo está dañado (p. ej. un PDF que no se puede abrir). Es un
 * problema DEL DOCUMENTO, no del motor: acaba como incidencia "ilegible".
 */
export class DocumentoDanado extends Error {}

/** @param rutaOriginal Ruta absoluta del original (ya comprobado contra su hash). */
export async function extractInvoice(rutaOriginal: string): Promise<ResultadoLectura> {
  let l;
  try {
    l = await servicioOcr().leer(rutaOriginal);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    if (/^PdfiumError/.test(mensaje)) throw new DocumentoDanado(mensaje);
    throw e;
  }
  return {
    extraccion: ExtraccionSchema.parse(analizarTexto(l.texto, l.confianza)),
    motor: l.fuente === "pdf-texto" ? "pdf-texto + analizador" : "rapidocr-3.10 + analizador",
    segundos: l.segundos,
  };
}
