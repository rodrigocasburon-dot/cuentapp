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

/**
 * Para el verificador de integridad (npm run originales:verificar): solo
 * la ruta y el hash de cada original, sin datos del documento. No usar en páginas.
 */
export function referenciasDeOriginales(bd: Bd): { id: string; ruta_original: string; hash_sha256: string }[] {
  return bd.prepare("SELECT id, ruta_original, hash_sha256 FROM documentos ORDER BY creado_en").all() as {
    id: string;
    ruta_original: string;
    hash_sha256: string;
  }[];
}

export function estadoSistema(bd: Bd): EstadoSistema {
  return {
    planes: bd.prepare("SELECT * FROM planes ORDER BY disponible DESC, precio_centimos").all() as EstadoSistema["planes"],
    empresas: (bd.prepare("SELECT count(*) AS n FROM empresas").get() as { n: number }).n,
  };
}
