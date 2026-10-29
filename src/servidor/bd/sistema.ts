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

/**
 * Cola de lectura: documentos en "recibido" de TODAS las empresas, el más
 * antiguo primero. Solo devuelve id y empresa: el procesador abre después
 * el repositorio de cada empresa para trabajar con sus datos.
 */
export function documentosPorLeer(bd: Bd, limite = 20): { id: string; empresa_id: string }[] {
  return bd
    .prepare("SELECT id, empresa_id FROM documentos WHERE estado = 'recibido' ORDER BY creado_en, rowid LIMIT ?")
    .all(limite) as { id: string; empresa_id: string }[];
}

/** Devuelve a "recibido" los que llevan en "procesando" desde antes de `antesDe` (servidor caído a medias). */
export function recuperarAtascados(bd: Bd, antesDe: string): number {
  return bd
    .prepare("UPDATE documentos SET estado = 'recibido', procesando_desde = NULL WHERE estado = 'procesando' AND procesando_desde < ?")
    .run(antesDe).changes;
}

/**
 * Buzón simulado (fase 8): ¿de qué empresa ACTIVA es esta dirección? Solo
 * devuelve el id; después se trabaja con repositorioDeEmpresa(bd, id).
 */
export function empresaPorBuzon(bd: Bd, direccion: string): string | null {
  const fila = bd.prepare("SELECT id FROM empresas WHERE buzon = ? COLLATE NOCASE AND baja_en IS NULL").get(direccion.trim()) as { id: string } | undefined;
  return fila?.id ?? null;
}

export function estadoSistema(bd: Bd): EstadoSistema {
  return {
    planes: bd.prepare("SELECT * FROM planes ORDER BY disponible DESC, precio_centimos").all() as EstadoSistema["planes"],
    empresas: (bd.prepare("SELECT count(*) AS n FROM empresas").get() as { n: number }).n,
  };
}
