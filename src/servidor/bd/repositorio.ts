// Capa de acceso a datos con aislamiento por empresa.
//
// REGLA: todas las consultas sobre datos de cliente pasan por aquí, y todas
// llevan "empresa_id = ?" con el id de la empresa de la sesión. Es nuestro
// sustituto de la RLS de Postgres. Nunca aceptes empresa_id desde el
// navegador: sale siempre de la sesión (fase 3).
//
// tests/aislamiento.test.ts comprueba que una empresa no ve, ni modifica,
// nada de otra, y que ningún otro fichero de src/ usa la base de datos a pelo.

import { randomUUID } from "node:crypto";
import type { Bd } from "./conexion";
import type { Estado, TipoDocumento } from "@/dominio/estados";

export interface FilaDocumento {
  id: string;
  empresa_id: string;
  periodo_id: string | null;
  origen: "subida" | "buzon";
  nombre_original: string;
  mime: string;
  tamano_bytes: number;
  ruta_original: string;
  hash_sha256: string;
  estado: Estado;
  tipo: TipoDocumento | null;
  creado_en: string;
}

export interface NuevoDocumento {
  origen: "subida" | "buzon";
  nombre_original: string;
  mime: string;
  tamano_bytes: number;
  ruta_original: string;
  hash_sha256: string;
}

export function repositorioDeEmpresa(bd: Bd, empresaId: string) {
  if (!empresaId) throw new Error("Falta la empresa: no se puede acceder a datos sin ella");

  return {
    empresaId,

    listarDocumentos(): FilaDocumento[] {
      return bd
        .prepare("SELECT * FROM documentos WHERE empresa_id = ? ORDER BY creado_en DESC")
        .all(empresaId) as FilaDocumento[];
    },

    /** Devuelve undefined si el documento no existe O es de otra empresa (no distinguimos, a propósito). */
    obtenerDocumento(id: string): FilaDocumento | undefined {
      return bd
        .prepare("SELECT * FROM documentos WHERE id = ? AND empresa_id = ?")
        .get(id, empresaId) as FilaDocumento | undefined;
    },

    crearDocumento(datos: NuevoDocumento): string {
      const id = randomUUID();
      bd.prepare(
        `INSERT INTO documentos (id, empresa_id, origen, nombre_original, mime, tamano_bytes, ruta_original, hash_sha256)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, empresaId, datos.origen, datos.nombre_original, datos.mime, datos.tamano_bytes, datos.ruta_original, datos.hash_sha256);
      return id;
    },

    /** Devuelve true si cambió algo. Con un id de otra empresa no cambia nada. */
    cambiarEstado(id: string, estado: Estado): boolean {
      const r = bd
        .prepare("UPDATE documentos SET estado = ? WHERE id = ? AND empresa_id = ?")
        .run(estado, id, empresaId);
      return r.changes > 0;
    },

    /** Documentos con el mismo hash en ESTA empresa (duplicados exactos, RF-07). */
    buscarPorHash(hash: string): FilaDocumento[] {
      return bd
        .prepare("SELECT * FROM documentos WHERE empresa_id = ? AND hash_sha256 = ?")
        .all(empresaId, hash) as FilaDocumento[];
    },
  };
}

export type Repositorio = ReturnType<typeof repositorioDeEmpresa>;
