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
import {
  calcularSemaforo,
  fechasTrimestre,
  type DocumentoParaSemaforo,
  type LineaIvaResumen,
  type ResultadoSemaforo,
} from "@/dominio/semaforo";
import { validar, type Aviso } from "@/dominio/validaciones";
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
  validado_en: string | null;
  validado_por: string | null;
  descartado_en: string | null;
  descartado_por: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface FilaLineaIva {
  tipo_iva: number;
  base_centimos: number;
  cuota_centimos: number;
}

export interface FilaIncidencia {
  id: string;
  empresa_id: string;
  documento_id: string;
  tipo: TipoIncidencia;
  bloqueante: number;
  estado: "abierta" | "resuelta";
  descripcion: string;
  creada_en: string;
  resuelta_en: string | null;
  resuelta_por: string | null;
  motivo_resolucion: string | null;
  documento_referencia_id: string | null;
}

export interface FilaCorreccion {
  id: string;
  empresa_id: string;
  documento_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  usuario_id: string;
  nombre_usuario?: string;
  creada_en: string;
}

export interface DatosCorreccion {
  tipo?: TipoDocumento | null;
  nombre_emisor?: string | null;
  nif_emisor?: string | null;
  nif_receptor?: string | null;
  numero?: string | null;
  fecha_emision?: string | null;
  moneda?: string | null;
  total_centimos?: number | null;
  lineas_iva?: { tipo_iva: number; base_centimos: number; cuota_centimos: number }[];
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

  function buscarDuplicadoLogicoInterno(
    documentoId: string,
    datos: { nif_emisor: string | null; numero: string | null; fecha_emision: string | null; total_centimos: number | null },
  ): FilaDocumento | undefined {
    if (!datos.nif_emisor || !datos.numero || !datos.fecha_emision || datos.total_centimos === null || datos.total_centimos === undefined) {
      return undefined;
    }
    const nifNorm = datos.nif_emisor.replace(/[\s-]/g, "").toUpperCase();
    const numNorm = datos.numero.trim().toLowerCase();

    const candidatos = bd
      .prepare(
        `SELECT * FROM documentos
         WHERE empresa_id = ?
           AND id <> ?
           AND descartado_en IS NULL
           AND fecha_emision = ?
           AND total_centimos = ?
         ORDER BY creado_en ASC, rowid ASC`,
      )
      .all(empresaId, documentoId, datos.fecha_emision, datos.total_centimos) as FilaDocumento[];

    return candidatos.find((c) => {
      if (!c.nif_emisor || !c.numero) return false;
      return c.nif_emisor.replace(/[\s-]/g, "").toUpperCase() === nifNorm && c.numero.trim().toLowerCase() === numNorm;
    });
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
        .prepare(
          `SELECT id, empresa_id, documento_id, tipo, bloqueante, estado, descripcion, creada_en,
                  resuelta_en, resuelta_por, motivo_resolucion, documento_referencia_id
           FROM incidencias
           WHERE documento_id = ? AND empresa_id = ?
           ORDER BY creada_en`,
        )
        .all(documentoId, empresaId) as FilaIncidencia[];
    },

    /** Crea una incidencia para un documento de esta empresa. */
    crearIncidencia(datos: {
      documentoId: string;
      tipo: TipoIncidencia;
      bloqueante: number;
      descripcion: string;
      documentoReferenciaId?: string | null;
    }): string {
      const id = randomUUID();
      bd.prepare(
        `INSERT INTO incidencias (id, empresa_id, documento_id, tipo, bloqueante, descripcion, documento_referencia_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, empresaId, datos.documentoId, datos.tipo, datos.bloqueante, datos.descripcion, datos.documentoReferenciaId ?? null);
      return id;
    },

    /**
     * Resuelve una incidencia ("no_duplicado" o "descartado").
     * Si se descarta, marca el documento. Si no es duplicado y no quedan más
     * bloqueantes, pasa el documento a "pendiente_revision".
     */
    resolverIncidencia(incidenciaId: string, resolucion: "no_duplicado" | "descartado", usuarioId: string, ahora = new Date()): boolean {
      return bd.transaction(() => {
        const inc = bd.prepare("SELECT * FROM incidencias WHERE id = ? AND empresa_id = ?").get(incidenciaId, empresaId) as FilaIncidencia | undefined;
        if (!inc) return false;

        bd.prepare(
          `UPDATE incidencias
           SET estado = 'resuelta', resuelta_en = ?, resuelta_por = ?, motivo_resolucion = ?
           WHERE id = ? AND empresa_id = ?`,
        ).run(iso(ahora), usuarioId, resolucion, incidenciaId, empresaId);

        if (resolucion === "descartado") {
          bd.prepare(
            `UPDATE documentos
             SET descartado_en = ?, descartado_por = ?
             WHERE id = ? AND empresa_id = ?`,
          ).run(iso(ahora), usuarioId, inc.documento_id, empresaId);
        } else if (resolucion === "no_duplicado") {
          const bloqueantes = bd
            .prepare("SELECT COUNT(*) as c FROM incidencias WHERE documento_id = ? AND empresa_id = ? AND bloqueante = 1 AND estado = 'abierta'")
            .get(inc.documento_id, empresaId) as { c: number };
          if (bloqueantes.c === 0) {
            bd.prepare("UPDATE documentos SET estado = 'pendiente_revision' WHERE id = ? AND empresa_id = ? AND estado = 'incidencia'").run(
              inc.documento_id,
              empresaId,
            );
          }
        }
        return true;
      })();
    },

    /**
     * Duplicado lógico (RF-07): mismo NIF de emisor + número + fecha + total
     * en documentos activos de ESTA empresa. Devuelve el original o undefined.
     */
    buscarDuplicadoLogico: buscarDuplicadoLogicoInterno,

    /** Registra una corrección en el historial (RF-06). */
    registrarCorreccion(
      documentoId: string,
      campo: string,
      valorAnterior: string | null,
      valorNuevo: string | null,
      usuarioId: string,
      ahora = new Date(),
    ): string {
      const id = randomUUID();
      bd.prepare(
        `INSERT INTO correcciones (id, empresa_id, documento_id, campo, valor_anterior, valor_nuevo, usuario_id, creada_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, empresaId, documentoId, campo, valorAnterior, valorNuevo, usuarioId, iso(ahora));
      return id;
    },

    /** Historial de correcciones del documento. */
    listarCorrecciones(documentoId: string): FilaCorreccion[] {
      return bd
        .prepare(
          `SELECT c.id, c.empresa_id, c.documento_id, c.campo, c.valor_anterior, c.valor_nuevo, c.usuario_id, c.creada_en,
                  u.nombre AS nombre_usuario
           FROM correcciones c
           LEFT JOIN usuarios u ON u.id = c.usuario_id
           WHERE c.documento_id = ? AND c.empresa_id = ?
           ORDER BY c.creada_en DESC, c.rowid DESC`,
        )
        .all(documentoId, empresaId) as FilaCorreccion[];
    },

    /**
     * Aplica correcciones manuales a un documento (RF-06): guarda cada cambio
     * en la tabla correcciones, recalcula IVA, periodo, re-ejecuta validar()
     * determinista, actualiza avisos e incidencias y ajusta el estado.
     */
    corregirDocumento(id: string, usuarioId: string, datos: DatosCorreccion, ahora = new Date()): FilaDocumento {
      return bd.transaction(() => {
        const doc = bd.prepare("SELECT * FROM documentos WHERE id = ? AND empresa_id = ?").get(id, empresaId) as FilaDocumento | undefined;
        if (!doc) throw new Error("Documento no encontrado o pertenece a otra empresa");

        // 1) Historial de correcciones
        const registrarSiCambia = (campo: string, anterior: unknown, nuevo: unknown) => {
          const antStr = anterior === null || anterior === undefined ? null : String(anterior);
          const nvoStr = nuevo === null || nuevo === undefined ? null : String(nuevo);
          if (antStr !== nvoStr) {
            bd.prepare(
              `INSERT INTO correcciones (id, empresa_id, documento_id, campo, valor_anterior, valor_nuevo, usuario_id, creada_en)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(randomUUID(), empresaId, id, campo, antStr, nvoStr, usuarioId, iso(ahora));
          }
        };

        if (datos.tipo !== undefined) registrarSiCambia("tipo", doc.tipo, datos.tipo);
        if (datos.nombre_emisor !== undefined) registrarSiCambia("nombre_emisor", doc.nombre_emisor, datos.nombre_emisor);
        if (datos.nif_emisor !== undefined) registrarSiCambia("nif_emisor", doc.nif_emisor, datos.nif_emisor);
        if (datos.nif_receptor !== undefined) registrarSiCambia("nif_receptor", doc.nif_receptor, datos.nif_receptor);
        if (datos.numero !== undefined) registrarSiCambia("numero", doc.numero, datos.numero);
        if (datos.fecha_emision !== undefined) registrarSiCambia("fecha_emision", doc.fecha_emision, datos.fecha_emision);
        if (datos.moneda !== undefined) registrarSiCambia("moneda", doc.moneda, datos.moneda);
        if (datos.total_centimos !== undefined) registrarSiCambia("total_centimos", doc.total_centimos, datos.total_centimos);

        // 2) Líneas de IVA
        let lineasFinales: FilaLineaIva[];
        if (datos.lineas_iva !== undefined) {
          const lineasAnteriores = bd
            .prepare("SELECT tipo_iva, base_centimos, cuota_centimos FROM lineas_iva WHERE documento_id = ? AND empresa_id = ? ORDER BY tipo_iva")
            .all(id, empresaId) as FilaLineaIva[];
          const jsonAnt = JSON.stringify(lineasAnteriores);
          const jsonNvo = JSON.stringify(datos.lineas_iva);
          if (jsonAnt !== jsonNvo) {
            bd.prepare(
              `INSERT INTO correcciones (id, empresa_id, documento_id, campo, valor_anterior, valor_nuevo, usuario_id, creada_en)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(randomUUID(), empresaId, id, "lineas_iva", jsonAnt, jsonNvo, usuarioId, iso(ahora));
          }
          bd.prepare("DELETE FROM lineas_iva WHERE documento_id = ? AND empresa_id = ?").run(id, empresaId);
          const insLinea = bd.prepare("INSERT INTO lineas_iva (id, empresa_id, documento_id, tipo_iva, base_centimos, cuota_centimos) VALUES (?, ?, ?, ?, ?, ?)");
          for (const l of datos.lineas_iva) {
            insLinea.run(randomUUID(), empresaId, id, l.tipo_iva, l.base_centimos, l.cuota_centimos);
          }
          lineasFinales = datos.lineas_iva;
        } else {
          lineasFinales = bd
            .prepare("SELECT tipo_iva, base_centimos, cuota_centimos FROM lineas_iva WHERE documento_id = ? AND empresa_id = ? ORDER BY tipo_iva")
            .all(id, empresaId) as FilaLineaIva[];
        }

        const sumaBase = lineasFinales.length ? lineasFinales.reduce((s, l) => s + l.base_centimos, 0) : null;
        const sumaCuota = lineasFinales.length ? lineasFinales.reduce((s, l) => s + l.cuota_centimos, 0) : null;

        const tipo = datos.tipo !== undefined ? datos.tipo : doc.tipo;
        const nombre_emisor = datos.nombre_emisor !== undefined ? datos.nombre_emisor : doc.nombre_emisor;
        const nif_emisor = datos.nif_emisor !== undefined ? datos.nif_emisor : doc.nif_emisor;
        const nif_receptor = datos.nif_receptor !== undefined ? datos.nif_receptor : doc.nif_receptor;
        const numero = datos.numero !== undefined ? datos.numero : doc.numero;
        const fecha_emision = datos.fecha_emision !== undefined ? datos.fecha_emision : doc.fecha_emision;
        const moneda = datos.moneda !== undefined ? datos.moneda : doc.moneda;
        const total_centimos = datos.total_centimos !== undefined ? datos.total_centimos : doc.total_centimos;

        let total_eur_centimos = doc.total_eur_centimos;
        if (moneda === "EUR") {
          total_eur_centimos = total_centimos;
        } else if (moneda && total_centimos !== null && doc.tipo_cambio) {
          total_eur_centimos = Math.round(total_centimos / doc.tipo_cambio);
        }

        const periodoId = periodoDeFecha(fecha_emision);

        // 3) Revalidar
        const ex: Extraccion = {
          tipo: { valor: tipo, confianza: 1.0 },
          nombre_emisor: { valor: nombre_emisor, confianza: 1.0 },
          nif_emisor: { valor: nif_emisor, confianza: 1.0 },
          nif_receptor: { valor: nif_receptor, confianza: 1.0 },
          numero: { valor: numero, confianza: 1.0 },
          fecha_emision: { valor: fecha_emision, confianza: 1.0 },
          moneda: { valor: moneda, confianza: 1.0 },
          total_centimos: { valor: total_centimos, confianza: 1.0 },
          lineas_iva: { valor: lineasFinales, confianza: 1.0 },
        };
        const nifEmp = (bd.prepare("SELECT nif FROM empresas WHERE id = ?").get(empresaId) as { nif: string | null } | undefined)?.nif ?? null;
        const avisos = validar(ex, ahora, { nifEmpresa: nifEmp });

        // 4) Recalcular incidencias automáticas (ilegible y receptor_ajeno)
        const tieneIlegibleAviso = avisos.some((a) => a.codigo === "ilegible" && a.nivel === "rojo");
        const tieneReceptorAjenoAviso = avisos.some((a) => a.codigo === "receptor_ajeno" && a.nivel === "rojo");

        if (!tieneIlegibleAviso) {
          bd.prepare(
            `UPDATE incidencias SET estado = 'resuelta', resuelta_en = ?, resuelta_por = ?, motivo_resolucion = 'corregido'
             WHERE documento_id = ? AND empresa_id = ? AND tipo = 'ilegible' AND estado = 'abierta'`,
          ).run(iso(ahora), usuarioId, id, empresaId);
        } else {
          const existe = bd.prepare("SELECT 1 FROM incidencias WHERE documento_id = ? AND empresa_id = ? AND tipo = 'ilegible' AND estado = 'abierta'").get(id, empresaId);
          if (!existe) {
            bd.prepare("INSERT INTO incidencias (id, empresa_id, documento_id, tipo, bloqueante, descripcion) VALUES (?, ?, ?, 'ilegible', 1, 'Datos insuficientes para validar.')").run(
              randomUUID(),
              empresaId,
              id,
            );
          }
        }

        if (!tieneReceptorAjenoAviso) {
          bd.prepare(
            `UPDATE incidencias SET estado = 'resuelta', resuelta_en = ?, resuelta_por = ?, motivo_resolucion = 'corregido'
             WHERE documento_id = ? AND empresa_id = ? AND tipo = 'documental' AND estado = 'abierta'`,
          ).run(iso(ahora), usuarioId, id, empresaId);
        } else {
          const existe = bd.prepare("SELECT 1 FROM incidencias WHERE documento_id = ? AND empresa_id = ? AND tipo = 'documental' AND estado = 'abierta'").get(id, empresaId);
          if (!existe) {
            const texto = avisos.find((a) => a.codigo === "receptor_ajeno")?.texto ?? "Documento a nombre de otra empresa.";
            bd.prepare("INSERT INTO incidencias (id, empresa_id, documento_id, tipo, bloqueante, descripcion) VALUES (?, ?, ?, 'documental', 1, ?)").run(
              randomUUID(),
              empresaId,
              id,
              texto,
            );
          }
        }

        // 5) Duplicado lógico tras corrección
        const dupLogico = buscarDuplicadoLogicoInterno(id, { nif_emisor, numero, fecha_emision, total_centimos });
        if (dupLogico) {
          const yaExiste = bd
            .prepare(
              `SELECT 1 FROM incidencias
               WHERE documento_id = ? AND empresa_id = ? AND tipo = 'duplicado' AND estado = 'abierta' AND documento_referencia_id = ?`,
            )
            .get(id, empresaId, dupLogico.id);
          if (!yaExiste) {
            bd.prepare(
              `INSERT INTO incidencias (id, empresa_id, documento_id, tipo, bloqueante, descripcion, documento_referencia_id)
               VALUES (?, ?, ?, 'duplicado', 1, ?, ?)`,
            ).run(randomUUID(), empresaId, id, `Posible duplicado de ${dupLogico.nombre_original} (mismo emisor, número, fecha y total).`, dupLogico.id);
          }
        } else {
          // Resolver incidencias abiertas de duplicado lógico si ya no coinciden (excluyendo duplicados exactos)
          const incDuplicados = bd
            .prepare(
              `SELECT i.id, d.hash_sha256 AS ref_hash
               FROM incidencias i
               LEFT JOIN documentos d ON d.id = i.documento_referencia_id
               WHERE i.documento_id = ? AND i.empresa_id = ? AND i.tipo = 'duplicado' AND i.estado = 'abierta'`,
            )
            .all(id, empresaId) as { id: string; ref_hash: string | null }[];

          for (const inc of incDuplicados) {
            if (inc.ref_hash && inc.ref_hash !== doc.hash_sha256) {
              bd.prepare(
                `UPDATE incidencias SET estado = 'resuelta', resuelta_en = ?, resuelta_por = ?, motivo_resolucion = 'corregido'
                 WHERE id = ? AND empresa_id = ?`,
              ).run(iso(ahora), usuarioId, inc.id, empresaId);
            }
          }
        }

        // 6) Estado final
        const bloqueantesRestantes = bd
          .prepare("SELECT COUNT(*) as c FROM incidencias WHERE documento_id = ? AND empresa_id = ? AND bloqueante = 1 AND estado = 'abierta'")
          .get(id, empresaId) as { c: number };

        const nuevoEstado: Estado = bloqueantesRestantes.c > 0 ? "incidencia" : "pendiente_revision";

        // 7) Actualizar documento
        bd.prepare(
          `UPDATE documentos SET
             tipo = ?, nombre_emisor = ?, nif_emisor = ?, nif_receptor = ?, numero = ?,
             fecha_emision = ?, moneda = ?, base_centimos = ?, cuota_centimos = ?, total_centimos = ?,
             total_eur_centimos = ?, periodo_id = ?, avisos_json = ?,
             estado = ?, validado_en = NULL, validado_por = NULL
           WHERE id = ? AND empresa_id = ?`,
        ).run(
          tipo, nombre_emisor, nif_emisor, nif_receptor, numero,
          fecha_emision, moneda, sumaBase, sumaCuota, total_centimos,
          total_eur_centimos, periodoId, JSON.stringify(avisos),
          nuevoEstado,
          id, empresaId,
        );

        return bd.prepare("SELECT * FROM documentos WHERE id = ? AND empresa_id = ?").get(id, empresaId) as FilaDocumento;
      })();
    },

    /**
     * Valida manualmente un documento (RF-06). Solo se permite si no hay
     * incidencias bloqueantes abiertas y no está descartado.
     */
    validarDocumento(id: string, usuarioId: string, ahora = new Date()): FilaDocumento {
      return bd.transaction(() => {
        const doc = bd.prepare("SELECT * FROM documentos WHERE id = ? AND empresa_id = ?").get(id, empresaId) as FilaDocumento | undefined;
        if (!doc) throw new Error("Documento no encontrado");
        if (doc.descartado_en) throw new Error("Un documento descartado no se puede validar");

        const bloqueantes = bd
          .prepare("SELECT COUNT(*) as c FROM incidencias WHERE documento_id = ? AND empresa_id = ? AND bloqueante = 1 AND estado = 'abierta'")
          .get(id, empresaId) as { c: number };
        if (bloqueantes.c > 0) {
          throw new Error("No se puede validar mientras haya incidencias bloqueantes abiertas");
        }

        bd.prepare(
          `UPDATE documentos
           SET estado = 'validado', validado_en = ?, validado_por = ?
           WHERE id = ? AND empresa_id = ?`,
        ).run(iso(ahora), usuarioId, id, empresaId);

        return bd.prepare("SELECT * FROM documentos WHERE id = ? AND empresa_id = ?").get(id, empresaId) as FilaDocumento;
      })();
    },

    /** Documentos con el mismo hash en ESTA empresa (duplicados exactos, RF-07). */
    buscarPorHash(hash: string): FilaDocumento[] {
      return bd
        .prepare("SELECT * FROM documentos WHERE empresa_id = ? AND hash_sha256 = ?")
        .all(empresaId, hash) as FilaDocumento[];
    },

    /**
     * Documentos activos de un trimestre con sus líneas de IVA (Fase 7 · RF-09).
     */
    documentosDelTrimestre(anio: number, trimestre: number): (FilaDocumento & { lineasIva: FilaLineaIva[] })[] {
      const { inicio, fin } = fechasTrimestre(anio, trimestre);
      const docs = bd
        .prepare(
          `SELECT d.* FROM documentos d
           LEFT JOIN periodos p ON p.id = d.periodo_id
           WHERE d.empresa_id = ?
             AND d.descartado_en IS NULL
             AND (
               (p.anio = ? AND p.trimestre = ?)
               OR (d.fecha_emision >= ? AND d.fecha_emision <= ?)
             )
           ORDER BY d.fecha_emision ASC, d.creado_en ASC, d.rowid ASC`,
        )
        .all(empresaId, anio, trimestre, inicio, fin) as FilaDocumento[];

      const insLineas = bd.prepare(
        "SELECT tipo_iva, base_centimos, cuota_centimos FROM lineas_iva WHERE documento_id = ? AND empresa_id = ? ORDER BY tipo_iva",
      );

      return docs.map((d) => ({
        ...d,
        lineasIva: insLineas.all(d.id, empresaId) as FilaLineaIva[],
      }));
    },

    /**
     * Resumen y cálculo del semáforo para un trimestre (Fase 7).
     */
    resumenTrimestre(anio: number, trimestre: number): ResultadoSemaforo {
      const docs = this.documentosDelTrimestre(anio, trimestre);
      const incsAbiertasStmt = bd.prepare(
        "SELECT 1 FROM incidencias WHERE documento_id = ? AND empresa_id = ? AND bloqueante = 1 AND estado = 'abierta'",
      );

      const docsParaSemaforo: DocumentoParaSemaforo[] = docs.map((d) => ({
        id: d.id,
        estado: d.estado,
        tipo: d.tipo,
        nif_emisor: d.nif_emisor,
        nif_receptor: d.nif_receptor,
        total_eur_centimos: d.total_eur_centimos,
        total_centimos: d.total_centimos,
        base_centimos: d.base_centimos,
        cuota_centimos: d.cuota_centimos,
        avisos: d.avisos_json ? JSON.parse(d.avisos_json) : [],
        tieneIncidenciasBloqueantes: !!incsAbiertasStmt.get(d.id, empresaId),
        descartado: !!d.descartado_en,
      }));

      const todasLineas: LineaIvaResumen[] = docs.flatMap((d) =>
        d.lineasIva.map((l) => ({
          tipo_iva: l.tipo_iva,
          base_centimos: l.base_centimos,
          cuota_centimos: l.cuota_centimos,
        })),
      );

      return calcularSemaforo(docsParaSemaforo, todasLineas);
    },

    /**
     * Lista los trimestres que tienen documentos en esta empresa, más el actual.
     */
    listarTrimestres(): { anio: number; trimestre: number; totalDocumentos: number }[] {
      const filas = bd
        .prepare(
          `SELECT
             COALESCE(p.anio, CAST(SUBSTR(d.fecha_emision, 1, 4) AS INTEGER)) AS anio,
             COALESCE(p.trimestre, CAST((CAST(SUBSTR(d.fecha_emision, 6, 2) AS INTEGER) + 2) / 3 AS INTEGER)) AS trimestre,
             COUNT(*) AS totalDocumentos
           FROM documentos d
           LEFT JOIN periodos p ON p.id = d.periodo_id
           WHERE d.empresa_id = ? AND d.descartado_en IS NULL AND (p.anio IS NOT NULL OR d.fecha_emision IS NOT NULL)
           GROUP BY anio, trimestre
           ORDER BY anio DESC, trimestre DESC`,
        )
        .all(empresaId) as { anio: number; trimestre: number; totalDocumentos: number }[];

      const ahora = new Date();
      const actual = { anio: ahora.getFullYear(), trimestre: Math.ceil((ahora.getMonth() + 1) / 3) };

      if (!filas.some((f) => f.anio === actual.anio && f.trimestre === actual.trimestre)) {
        filas.unshift({ anio: actual.anio, trimestre: actual.trimestre, totalDocumentos: 0 });
      }

      return filas.filter((f) => f.anio >= 2000 && f.anio <= 2100 && f.trimestre >= 1 && f.trimestre <= 4);
    },
  };
}

export type Repositorio = ReturnType<typeof repositorioDeEmpresa>;
