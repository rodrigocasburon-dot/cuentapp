// Compara lo que leyó un motor con la verdad, campo a campo.
// Definiciones en docs/pruebas-lectura.md.

import { normalizarNif } from "@/dominio/nif";
import { CAMPOS, type Campo, type Extraccion, type LineaIva } from "@/lectura/esquema";
import { plano } from "@/lectura/analizar-texto";
import type { Verdad } from "./verdad";

export type Resultado = "correcto" | "erroneo" | "vacio" | "inventado";
export const CONFIANZA_ALTA = 0.8;

export interface PuntuacionCampo {
  campo: Campo;
  resultado: Resultado;
  real: unknown;
  leido: unknown;
  confianza: number;
}

export interface PuntuacionDocumento {
  id: string;
  campos: PuntuacionCampo[];
  correctos: number;
  errores: number;          // erróneos + inventados
  vacios: number;
  errores_confiados: number;
  correcciones: number;     // errores + vacíos
  total_ok: boolean;
  desglose_ok: boolean;
  tipo_ok: boolean;
}

/** Similitud 0..1 basada en la distancia de Levenshtein. */
export function similitud(a: string, b: string): number {
  if (a === b) return 1;
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return 1 - fila[b.length] / Math.max(a.length, b.length, 1);
}

const soloLetrasYCifras = (s: string) => plano(s).replace(/[^A-Z0-9]/g, "");

function ivaIgual(a: LineaIva[], b: LineaIva[]): boolean {
  if (a.length !== b.length) return false;
  const orden = (x: LineaIva[]) => [...x].sort((p, q) => p.tipo_iva - q.tipo_iva);
  return orden(a).every((l, i) => {
    const m = orden(b)[i];
    return l.tipo_iva === m.tipo_iva && l.base_centimos === m.base_centimos && l.cuota_centimos === m.cuota_centimos;
  });
}

function iguales(campo: Campo, real: unknown, leido: unknown): boolean {
  switch (campo) {
    case "nombre_emisor":
      return similitud(soloLetrasYCifras(String(real)), soloLetrasYCifras(String(leido))) >= 0.85;
    case "nif_emisor":
    case "nif_receptor":
      return normalizarNif(String(real)) === normalizarNif(String(leido));
    case "numero":
      return soloLetrasYCifras(String(real)) === soloLetrasYCifras(String(leido));
    case "lineas_iva":
      return ivaIgual(real as LineaIva[], leido as LineaIva[]);
    default:
      return real === leido;
  }
}

export function puntuar(verdad: Verdad, ex: Extraccion): PuntuacionDocumento {
  const campos = CAMPOS.map((campo): PuntuacionCampo => {
    const real = verdad[campo];
    const { valor: leido, confianza } = ex[campo];
    const realVacio = real === null || (Array.isArray(real) && real.length === 0);
    const leidoVacio = leido === null || (Array.isArray(leido) && leido.length === 0);
    let resultado: Resultado;
    if (realVacio) resultado = leidoVacio ? "correcto" : "inventado";
    else if (leidoVacio) resultado = "vacio";
    else resultado = iguales(campo, real, leido) ? "correcto" : "erroneo";
    return { campo, resultado, real, leido, confianza };
  });

  const cuenta = (r: Resultado) => campos.filter((c) => c.resultado === r).length;
  const errores = cuenta("erroneo") + cuenta("inventado");
  const ok = (campo: Campo) => campos.find((c) => c.campo === campo)!.resultado === "correcto";
  return {
    id: verdad.id,
    campos,
    correctos: cuenta("correcto"),
    errores,
    vacios: cuenta("vacio"),
    errores_confiados: campos.filter((c) => (c.resultado === "erroneo" || c.resultado === "inventado") && c.confianza >= CONFIANZA_ALTA).length,
    correcciones: errores + cuenta("vacio"),
    total_ok: ok("total_centimos"),
    desglose_ok: ok("lineas_iva"),
    tipo_ok: ok("tipo"),
  };
}
