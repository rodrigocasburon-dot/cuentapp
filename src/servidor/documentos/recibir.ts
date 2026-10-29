// Recepción de un archivo (RF-02): comprobar, guardar el original y dar de
// alta el documento en estado "recibido". Lo usan la subida y, en la fase 8,
// el buzón simulado.
//
// Orden importante: PRIMERO se guarda el original y DESPUÉS se crea la fila.
// Si algo falla entre medias, como mucho queda un original sin fila (inofensivo),
// pero nunca una fila sin su original.

import path from "node:path";
import { TAMANO_MAXIMO, TEXTO_FORMATOS, type ResultadoArchivo } from "@/dominio/subida";
import { detectarTipo, guardarOriginal } from "@/servidor/almacen/originales";
import type { Repositorio } from "@/servidor/bd/repositorio";

/** Nombre presentable y seguro: sin carpetas, sin caracteres de control, máximo 200. */
export function limpiarNombre(nombre: string): string {
  const limpio = path.basename(nombre.replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return limpio.slice(0, 200) || "documento";
}

export function recibirArchivo(
  repo: Repositorio,
  archivo: { nombre: string; bytes: Uint8Array },
  origen: "subida" | "buzon" = "subida",
  carpeta?: string,
  ahora = new Date(),
): ResultadoArchivo {
  const nombre = limpiarNombre(archivo.nombre);
  if (archivo.bytes.length === 0) return { nombre, ok: false, motivo: "El archivo está vacío." };
  if (archivo.bytes.length > TAMANO_MAXIMO) return { nombre, ok: false, motivo: "Ocupa más de 10 MB." };
  if (!detectarTipo(archivo.bytes)) return { nombre, ok: false, motivo: `Formato no admitido. Sube ${TEXTO_FORMATOS}.` };

  const original = guardarOriginal(repo.empresaId, archivo.bytes, carpeta);
  const previo = repo.buscarPorHash(original.hash)[0];
  const id = repo.crearDocumento(
    {
      origen,
      nombre_original: nombre,
      mime: original.tipo.mime,
      tamano_bytes: original.tamano,
      ruta_original: original.ruta,
      hash_sha256: original.hash,
    },
    ahora,
  );
  // Duplicado exacto (RF-07): crea incidencia bloqueante apuntando al original
  if (previo) {
    repo.crearIncidencia({
      documentoId: id,
      tipo: "duplicado",
      bloqueante: 1,
      descripcion: `Es un duplicado exacto de ${previo.nombre_original}.`,
      documentoReferenciaId: previo.id,
    });
  }
  return { nombre, ok: true, id, duplicadoDe: previo?.nombre_original };
}
