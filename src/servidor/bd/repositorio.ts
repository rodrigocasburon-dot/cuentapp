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
import { mesDe } from "@/dominio/formato";

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
      // rowid desempata los subidos en el mismo segundo (el último, primero)
      return bd
        .prepare("SELECT * FROM documentos WHERE empresa_id = ? ORDER BY creado_en DESC, rowid DESC")
        .all(empresaId) as FilaDocumento[];
    },

    /** Devuelve undefined si el documento no existe O es de otra empresa (no distinguimos, a propósito). */
    obtenerDocumento(id: string): FilaDocumento | undefined {
      return bd
        .prepare("SELECT * FROM documentos WHERE id = ? AND empresa_id = ?")
        .get(id, empresaId) as FilaDocumento | undefined;
    },

    /**
     * Da de alta un documento (estado "recibido") y suma 1 al uso del mes,
     * en la misma transacción: o se hacen las dos cosas o ninguna.
     */
    crearDocumento(datos: NuevoDocumento, ahora = new Date()): string {
      const id = randomUUID();
      bd.transaction(() => {
        bd.prepare(
          `INSERT INTO documentos (id, empresa_id, origen, nombre_original, mime, tamano_bytes, ruta_original, hash_sha256)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(id, empresaId, datos.origen, datos.nombre_original, datos.mime, datos.tamano_bytes, datos.ruta_original, datos.hash_sha256);
        bd.prepare(
          `INSERT INTO uso_mensual (empresa_id, mes, documentos) VALUES (?, ?, 1)
           ON CONFLICT (empresa_id, mes) DO UPDATE SET documentos = documentos + 1`,
        ).run(empresaId, mesDe(ahora));
      })();
      return id;
    },

    /** Documentos dados de alta en un mes ("AAAA-MM"). */
    usoDelMes(mes: string): number {
      const fila = bd.prepare("SELECT documentos FROM uso_mensual WHERE empresa_id = ? AND mes = ?").get(empresaId, mes) as
        | { documentos: number }
        | undefined;
      return fila?.documentos ?? 0;
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
