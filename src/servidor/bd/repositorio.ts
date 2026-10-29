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
import type { Estado, TipoDocumento, TipoIncidencia } from "@/dominio/estados";
import { mesDe } from "@/dominio/formato";
import type { Aviso } from "@/dominio/validaciones";
import type { Extraccion } from "@/lectura/esquema";
import type { TipoCambio } from "./cambios";

/** Fecha ISO sin milisegundos, como las que escribe SQLite. */
const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z";

/** "2026-08-19" → { anio: 2026, trimestre: 3 } */
export function trimestreDe(fecha: string): { anio: number; trimestre: number } {
  return { anio: Number(fecha.slice(0, 4)), trimestre: Math.ceil(Number(fecha.slice(5, 7)) / 3) };
}

/** Avisos que se convierten en incidencia (con su tipo de incidencia). */
const INCIDENCIA_DE_AVISO: Record<string, TipoIncidencia> = { ilegible: "ilegible", receptor_ajeno: "documental" };

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
  tipo_detectado: TipoDocumento | null;
  nif_emisor: string | null;
  nombre_emisor: string | null;
  nif_receptor: string | null;
  numero: string | null;
  fecha_emision: string | null;
  moneda: string | null;
  base_centimos: number | null;
  cuota_centimos: number | null;
  total_centimos: number | null;
  tipo_cambio: number | null;
  fecha_cambio: string | null;
  total_eur_centimos: number | null;
  extraccion_json: string | null;
  confianza_json: string | null;
  motor_lectura: string | null;
  avisos_json: string | null;
  procesado_en: string | null;
  procesando_desde: string | null;
  creado_en: string;
}

export interface FilaLineaIva {
  tipo_iva: number;
  base_centimos: number;
  cuota_centimos: number;
}

export interface FilaIncidencia {
  id: string;
  documento_id: string;
  tipo: TipoIncidencia;
  bloqueante: number;
  estado: "abierta" | "resuelta";
  descripcion: string;
  creada_en: string;
}

/** Lo que guarda la lectura automática de un documento (fase 5). */
export interface DatosLectura {
  extraccion: Extraccion;
  motor: string;
  avisos: Aviso[];
  cambio: TipoCambio | null;
  estado: Estado;
  ahora: Date;
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

  /** Periodo (trimestre) de esta empresa; lo crea si no existe. */
  function periodoDe(anio: number, trimestre: number): string {
    bd.prepare("INSERT OR IGNORE INTO periodos (id, empresa_id, anio, trimestre) VALUES (?, ?, ?, ?)").run(randomUUID(), empresaId, anio, trimestre);
    return (bd.prepare("SELECT id FROM periodos WHERE empresa_id = ? AND anio = ? AND trimestre = ?").get(empresaId, anio, trimestre) as { id: string }).id;
  }

  /** Periodo de una fecha AAAA-MM-DD, o null si no hay fecha o el año es absurdo (lectura errónea). */
  function periodoDeFecha(fecha: string | null): string | null {
    if (!fecha) return null;
    const { anio, trimestre } = trimestreDe(fecha);
    return anio >= 2000 && anio <= 2100 ? periodoDe(anio, trimestre) : null;
  }

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

    // ----- Lectura automática (fase 5) -----

    /**
     * Pasa un documento de "recibido" a "procesando". Devuelve false si no
     * estaba en "recibido" (otro proceso ya lo cogió) o no es de esta empresa.
     */
    reclamarParaLectura(id: string, ahora = new Date()): boolean {
      return (
        bd
          .prepare("UPDATE documentos SET estado = 'procesando', procesando_desde = ? WHERE id = ? AND empresa_id = ? AND estado = 'recibido'")
          .run(iso(ahora), id, empresaId).changes > 0
      );
    },

    periodoDe,

    /** NIF de esta empresa (para comprobar que los documentos van a su nombre). */
    nifEmpresa(): string | null {
      return (bd.prepare("SELECT nif FROM empresas WHERE id = ?").get(empresaId) as { nif: string | null } | undefined)?.nif ?? null;
    },

    /**
     * Guarda el resultado de la lectura, todo en una transacción: campos,
     * extracción original (inmutable), confianza, avisos, desglose de IVA,
     * periodo, incidencias bloqueantes y nuevo estado.
     */
    guardarLectura(id: string, d: DatosLectura): void {
      const ex = d.extraccion;
      const lineas = ex.lineas_iva.valor;
      const suma = (f: (l: (typeof lineas)[number]) => number) => (lineas.length ? lineas.reduce((s, l) => s + f(l), 0) : null);
      const total = ex.total_centimos.valor;
      const moneda = ex.moneda.valor;
      const totalEur = total === null ? null : moneda === "EUR" ? total : d.cambio ? Math.round(total / d.cambio.valor) : null;
      const confianza = Object.fromEntries(Object.entries(ex).map(([campo, v]) => [campo, v.confianza]));

      bd.transaction(() => {
        const periodo = periodoDeFecha(ex.fecha_emision.valor);
        const r = bd
          .prepare(
            `UPDATE documentos SET
               tipo = ?, tipo_detectado = ?, nif_emisor = ?, nombre_emisor = ?, nif_receptor = ?, numero = ?,
               fecha_emision = ?, moneda = ?, base_centimos = ?, cuota_centimos = ?, total_centimos = ?,
               tipo_cambio = ?, fecha_cambio = ?, total_eur_centimos = ?,
               extraccion_json = ?, confianza_json = ?, motor_lectura = ?, avisos_json = ?,
               periodo_id = ?, estado = ?, procesado_en = ?, procesando_desde = NULL
             WHERE id = ? AND empresa_id = ? AND estado = 'procesando'`,
          )
          .run(
            ex.tipo.valor, ex.tipo.valor, ex.nif_emisor.valor, ex.nombre_emisor.valor, ex.nif_receptor.valor, ex.numero.valor,
            ex.fecha_emision.valor, moneda, suma((l) => l.base_centimos), suma((l) => l.cuota_centimos), total,
            moneda === "EUR" ? null : (d.cambio?.valor ?? null), moneda === "EUR" ? null : (d.cambio?.fecha_bce ?? null), totalEur,
            JSON.stringify(ex), JSON.stringify(confianza), d.motor, JSON.stringify(d.avisos),
            periodo, d.estado, iso(d.ahora),
            id, empresaId,
          );
        if (r.changes === 0) throw new Error("El documento no está en 'procesando' o no es de esta empresa");

        const linea = bd.prepare("INSERT INTO lineas_iva (id, empresa_id, documento_id, tipo_iva, base_centimos, cuota_centimos) VALUES (?, ?, ?, ?, ?, ?)");
        for (const l of lineas) linea.run(randomUUID(), empresaId, id, l.tipo_iva, l.base_centimos, l.cuota_centimos);

        const incidencia = bd.prepare("INSERT INTO incidencias (id, empresa_id, documento_id, tipo, bloqueante, descripcion) VALUES (?, ?, ?, ?, 1, ?)");
        for (const a of d.avisos) {
          if (a.nivel === "rojo" && INCIDENCIA_DE_AVISO[a.codigo]) incidencia.run(randomUUID(), empresaId, id, INCIDENCIA_DE_AVISO[a.codigo], a.texto);
        }
      })();
    },

    lineasIva(documentoId: string): FilaLineaIva[] {
      return bd
        .prepare("SELECT tipo_iva, base_centimos, cuota_centimos FROM lineas_iva WHERE documento_id = ? AND empresa_id = ? ORDER BY tipo_iva")
        .all(documentoId, empresaId) as FilaLineaIva[];
    },

    incidencias(documentoId: string): FilaIncidencia[] {
      return bd
        .prepare("SELECT id, documento_id, tipo, bloqueante, estado, descripcion, creada_en FROM incidencias WHERE documento_id = ? AND empresa_id = ? ORDER BY creada_en")
        .all(documentoId, empresaId) as FilaIncidencia[];
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
