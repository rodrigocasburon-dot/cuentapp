// Interfaz común de los motores de la comparativa.

import type { Extraccion } from "@/lectura/esquema";

export interface Lectura {
  archivo: string;
  extraccion: Extraccion;
  texto: string;         // texto en bruto (OCR) o JSON devuelto (modelo de visión), para revisar a mano
  segundos: number;      // tiempo de este documento, sin la carga del motor
  coste_eur: number;     // 0 en motores locales
  error?: string;
}

export interface Motor {
  id: "A" | "B" | "C" | "D";
  nombre: string;
  local: boolean;        // true = ningún dato sale del equipo
  /** Comprueba si el motor se puede usar en esta máquina. Devuelve el motivo si no. */
  disponible(): Promise<true | string>;
  /** Lee todos los documentos. Devuelve también la carga inicial en segundos. */
  leer(archivos: string[]): Promise<{ carga_segundos: number; lecturas: Lectura[] }>;
}
