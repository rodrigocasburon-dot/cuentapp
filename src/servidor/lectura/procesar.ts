// Procesado automático de documentos (RF-05): recibido → procesando →
// pendiente de revisión (o incidencia si es ilegible).
//
// Se ejecuta en segundo plano, de uno en uno: la subida responde al momento
// y la lista se actualiza sola cuando termina la lectura.

import path from "node:path";
import { CARPETA_ORIGINALES } from "@/config";
import { validar, type Aviso } from "@/dominio/validaciones";
import { extraccionVacia } from "@/lectura/esquema";
import { leerOriginal } from "@/servidor/almacen/originales";
import type { Bd } from "@/servidor/bd/conexion";
import type { TipoCambio } from "@/servidor/bd/cambios";
import { repositorioDeEmpresa, type Repositorio } from "@/servidor/bd/repositorio";
import { documentosPorLeer, recuperarAtascados } from "@/servidor/bd/sistema";
import { DocumentoDanado, type ResultadoLectura } from "./extraer";

/** Lo que necesita el procesador. En las pruebas se sustituye por versiones falsas. */
export interface Dependencias {
  extraer: (rutaOriginal: string) => Promise<ResultadoLectura>;
  cambio: (moneda: string, fecha: string) => Promise<TipoCambio | null>;
  carpeta?: string;
  ahora?: () => Date;
}

const MINUTOS_ATASCO = 10;

/** Procesa un documento. Devuelve el estado final, o null si no estaba pendiente. */
export async function procesarDocumento(repo: Repositorio, id: string, deps: Dependencias): Promise<string | null> {
  const ahora = deps.ahora ?? (() => new Date());
  if (!repo.reclamarParaLectura(id, ahora())) return null;
  const doc = repo.obtenerDocumento(id)!;
  const carpeta = deps.carpeta ?? CARPETA_ORIGINALES;

  // 1) El original debe seguir intacto antes de leerlo
  const original = leerOriginal(doc.ruta_original, doc.hash_sha256, carpeta);
  if (!original.ok) {
    console.error(`[RF-08] Original ${original.motivo} al procesar ${id}`);
    const avisos: Aviso[] = [{ codigo: "ilegible", nivel: "rojo", texto: "El original no supera la comprobación de integridad." }];
    repo.guardarLectura(id, { extraccion: extraccionVacia(), motor: "ninguno", avisos, cambio: null, estado: "incidencia", ahora: ahora() });
    return "incidencia";
  }

  // 2) Lectura. Si el motor falla, el documento pasa a revisión manual: no se queda atascado.
  let lectura: ResultadoLectura;
  try {
    lectura = await deps.extraer(path.resolve(carpeta, doc.ruta_original));
  } catch (e) {
    if (e instanceof DocumentoDanado) {
      const avisos: Aviso[] = [{ codigo: "ilegible", nivel: "rojo", texto: "El archivo está dañado y no se puede abrir. Vuelve a pedirlo al emisor." }];
      repo.guardarLectura(id, { extraccion: extraccionVacia(), motor: "ninguno", avisos, cambio: null, estado: "incidencia", ahora: ahora() });
      return "incidencia";
    }
    console.error(`[lectura] ${id}: ${e instanceof Error ? e.message : e}`);
    const avisos: Aviso[] = [{ codigo: "lectura_fallida", nivel: "ambar", texto: "No se ha podido leer automáticamente. Completa los datos a mano." }];
    repo.guardarLectura(id, { extraccion: extraccionVacia(), motor: "fallido", avisos, cambio: null, estado: "pendiente_revision", ahora: ahora() });
    return "pendiente_revision";
  }

  // 3) Validaciones deterministas y tipo de cambio
  const ex = lectura.extraccion;
  const avisos = validar(ex, ahora(), { nifEmpresa: repo.nifEmpresa() });
  let cambio: TipoCambio | null = null;
  const { valor: moneda } = ex.moneda;
  const { valor: fecha } = ex.fecha_emision;
  if (moneda && moneda !== "EUR" && fecha && fecha <= ahora().toISOString().slice(0, 10)) {
    cambio = await deps.cambio(moneda, fecha);
    if (!cambio) avisos.push({ codigo: "sin_tipo_cambio", nivel: "ambar", texto: `No se ha podido obtener el cambio ${moneda}/EUR del ${fecha}. ¿Hay conexión a internet?` });
  }

  // 3.5) Duplicado lógico (RF-07): se comprueba al terminar la lectura
  const dupLogico = repo.buscarDuplicadoLogico(id, {
    nif_emisor: ex.nif_emisor.valor,
    numero: ex.numero.valor,
    fecha_emision: ex.fecha_emision.valor,
    total_centimos: ex.total_centimos.valor,
  });
  if (dupLogico) {
    const yaExiste = repo
      .incidencias(id)
      .some((i) => i.tipo === "duplicado" && i.estado === "abierta" && i.documento_referencia_id === dupLogico.id);
    if (!yaExiste) {
      repo.crearIncidencia({
        documentoId: id,
        tipo: "duplicado",
        bloqueante: 1,
        descripcion: `Posible duplicado de ${dupLogico.nombre_original} (mismo emisor, número, fecha y total).`,
        documentoReferenciaId: dupLogico.id,
      });
    }
  }

  // 4) Guardar y decidir el estado (la validación final siempre es manual)
  const incidenciasAbiertas = repo.incidencias(id).filter((i) => i.bloqueante === 1 && i.estado === "abierta");
  const estado = avisos.some((a) => a.nivel === "rojo") || incidenciasAbiertas.length > 0 ? "incidencia" : "pendiente_revision";
  repo.guardarLectura(id, { extraccion: ex, motor: lectura.motor, avisos, cambio, estado, ahora: ahora() });
  return estado;
}

/** Procesa toda la cola (todas las empresas), de uno en uno. */
export async function procesarPendientes(bd: Bd, deps: Dependencias): Promise<number> {
  const ahora = deps.ahora ?? (() => new Date());
  recuperarAtascados(bd, new Date(ahora().getTime() - MINUTOS_ATASCO * 60_000).toISOString().slice(0, 19) + "Z");
  let hechos = 0;
  for (let lote = documentosPorLeer(bd); lote.length; lote = documentosPorLeer(bd)) {
    for (const { id, empresa_id } of lote) {
      if ((await procesarDocumento(repositorioDeEmpresa(bd, empresa_id), id, deps)) !== null) hechos++;
    }
  }
  return hechos;
}
