"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  esquemaCorreccion,
  parsearImporteACentimos,
  type EstadoFormularioCorreccion,
} from "@/dominio/correccion";
import { MAX_ARCHIVOS_POR_SUBIDA, TAMANO_MAXIMO, type EstadoSubida, type ResultadoArchivo } from "@/dominio/subida";
import { repositorioActual } from "@/servidor/auth/sesion";
import { limpiarNombre, recibirArchivo } from "@/servidor/documentos/recibir";
import { lanzarCola } from "@/servidor/lectura/cola";

export async function subirDocumentos(_previo: EstadoSubida, f: FormData): Promise<EstadoSubida> {
  const { repo } = await repositorioActual(); // la empresa sale de la sesión
  // Un <input type="file"> vacío envía un File sin nombre y de 0 bytes
  const archivos = f.getAll("archivos").filter((a): a is File => a instanceof File && a.name !== "");
  if (archivos.length === 0) return { mensaje: "Elige al menos un archivo." };
  if (archivos.length > MAX_ARCHIVOS_POR_SUBIDA) return { mensaje: `Sube como máximo ${MAX_ARCHIVOS_POR_SUBIDA} archivos cada vez.` };

  const resultados: ResultadoArchivo[] = [];
  for (const a of archivos) {
    // Comprobamos el tamaño antes de leerlo entero en memoria
    if (a.size > TAMANO_MAXIMO) {
      resultados.push({ nombre: limpiarNombre(a.name), ok: false, motivo: "Ocupa más de 10 MB." });
      continue;
    }
    resultados.push(recibirArchivo(repo, { nombre: a.name, bytes: new Uint8Array(await a.arrayBuffer()) }));
  }
  // La lectura automática empieza DESPUÉS de responder: la subida no espera al OCR
  if (resultados.some((r) => r.ok)) after(lanzarCola);
  revalidatePath("/documentos");
  revalidatePath("/panel");
  return { resultados };
}

/**
 * Corrección manual de un documento (RF-06). Valida con Zod en servidor,
 * guarda cambios en 'correcciones', re-ejecuta validar() y actualiza avisos.
 */
export async function corregirDocumentoAction(
  documentoId: string,
  _previo: EstadoFormularioCorreccion,
  f: FormData,
): Promise<EstadoFormularioCorreccion> {
  const { repo, sesion } = await repositorioActual();

  const totalRaw = f.get("total");
  const total_centimos = totalRaw !== null && totalRaw !== "" ? parsearImporteACentimos(String(totalRaw)) : null;
  if (totalRaw !== null && totalRaw !== "" && total_centimos === null) {
    return { ok: false, errores: { total: "Introduce un importe válido (ej. 12,50)." } };
  }

  let lineas_iva: { tipo_iva: number; base_centimos: number; cuota_centimos: number }[] | undefined = undefined;
  const lineasJson = f.get("lineas_iva_json");
  if (lineasJson && typeof lineasJson === "string") {
    try {
      lineas_iva = JSON.parse(lineasJson);
    } catch {
      return { ok: false, mensaje: "El desglose de IVA tiene un formato incorrecto." };
    }
  }

  const parseo = esquemaCorreccion.safeParse({
    tipo: f.get("tipo"),
    nombre_emisor: f.get("nombre_emisor"),
    nif_emisor: f.get("nif_emisor"),
    nif_receptor: f.get("nif_receptor"),
    numero: f.get("numero"),
    fecha_emision: f.get("fecha_emision"),
    moneda: f.get("moneda"),
    total_centimos,
    lineas_iva,
  });

  if (!parseo.success) {
    const errores: Record<string, string> = {};
    for (const issue of parseo.error.issues) {
      const campo = issue.path[0]?.toString() ?? "general";
      if (!errores[campo]) errores[campo] = issue.message;
    }
    return { ok: false, errores };
  }

  try {
    repo.corregirDocumento(documentoId, sesion.usuario.id, {
      ...parseo.data,
      lineas_iva,
    });
    revalidatePath(`/documentos/${documentoId}`);
    revalidatePath("/documentos");
    revalidatePath("/panel");
    return { ok: true, mensaje: "Documento actualizado correctamente." };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "Error al guardar la corrección." };
  }
}

/**
 * Pasa un documento a 'validado' (RF-06). Solo se activa si no hay
 * incidencias bloqueantes abiertas.
 */
export async function validarDocumentoAction(documentoId: string): Promise<{ ok: boolean; mensaje?: string }> {
  const { repo, sesion } = await repositorioActual();
  try {
    repo.validarDocumento(documentoId, sesion.usuario.id);
    revalidatePath(`/documentos/${documentoId}`);
    revalidatePath("/documentos");
    revalidatePath("/panel");
    return { ok: true };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "Error al validar el documento." };
  }
}

/**
 * Resuelve una incidencia de duplicado u otro tipo (RF-07).
 */
export async function resolverIncidenciaAction(
  incidenciaId: string,
  documentoId: string,
  resolucion: "no_duplicado" | "descartado",
): Promise<{ ok: boolean; mensaje?: string }> {
  const { repo, sesion } = await repositorioActual();
  try {
    const resuelta = repo.resolverIncidencia(incidenciaId, resolucion, sesion.usuario.id);
    if (!resuelta) return { ok: false, mensaje: "No se encontró la incidencia." };
    revalidatePath(`/documentos/${documentoId}`);
    revalidatePath("/documentos");
    revalidatePath("/panel");
    return { ok: true };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "Error al resolver la incidencia." };
  }
}
