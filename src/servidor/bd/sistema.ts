// Consultas de sistema que NO pertenecen a ninguna empresa (datos de
// referencia y diagnóstico). Nunca devuelvas aquí datos de clientes.

import type { Bd } from "./conexion";

export interface EstadoSistema {
  planes: {
    id: string;
    nombre: string;
    precio_centimos: number;
    limite_docs_mes: number | null;
    limite_docs_total: number | null;
    dias_prueba: number | null;
    disponible: number;
  }[];
  empresas: number;  // solo el recuento, nunca la lista
}

export function estadoSistema(bd: Bd): EstadoSistema {
  return {
    planes: bd.prepare("SELECT * FROM planes ORDER BY disponible DESC, precio_centimos").all() as EstadoSistema["planes"],
    empresas: (bd.prepare("SELECT count(*) AS n FROM empresas").get() as { n: number }).n,
  };
}
