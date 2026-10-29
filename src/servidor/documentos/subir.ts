// Subida de varios archivos con los límites del plan. La usan el formulario
// de «Documentos» (Server Action) y «compartir desde el móvil» (/compartir):
// las dos vías aplican exactamente las mismas reglas.

import { MAX_ARCHIVOS_POR_SUBIDA, TAMANO_MAXIMO, type EstadoSubida, type ResultadoArchivo } from "@/dominio/subida";
import type { Repositorio } from "@/servidor/bd/repositorio";
import { cupoDisponible } from "./limites";
import { limpiarNombre, recibirArchivo } from "./recibir";

export async function subirArchivos(repo: Repositorio, archivos: File[]): Promise<EstadoSubida> {
  if (archivos.length === 0) return { mensaje: "Elige al menos un archivo." };
  if (archivos.length > MAX_ARCHIVOS_POR_SUBIDA) return { mensaje: `Sube como máximo ${MAX_ARCHIVOS_POR_SUBIDA} archivos cada vez.` };

  // Límites del plan (fase 9): prueba caducada, 30 en total o el límite mensual del plan
  const cupo = cupoDisponible(repo);
  if (cupo.disponibles === 0) return { mensaje: cupo.motivo };
  let quedan = cupo.disponibles;

  const resultados: ResultadoArchivo[] = [];
  for (const a of archivos) {
    // Comprobamos el tamaño antes de leerlo entero en memoria
    if (a.size > TAMANO_MAXIMO) {
      resultados.push({ nombre: limpiarNombre(a.name), ok: false, motivo: "Ocupa más de 10 MB." });
      continue;
    }
    if (quedan <= 0) {
      resultados.push({ nombre: limpiarNombre(a.name), ok: false, motivo: cupo.motivo ?? "Límite del plan alcanzado." });
      continue;
    }
    const r = recibirArchivo(repo, { nombre: a.name, bytes: new Uint8Array(await a.arrayBuffer()) });
    if (r.ok) quedan--;
    resultados.push(r);
  }
  return { resultados };
}

/** Archivos de un FormData (un <input type="file"> vacío envía un File sin nombre y de 0 bytes). */
export function archivosDe(f: FormData, campo = "archivos"): File[] {
  return f.getAll(campo).filter((a): a is File => a instanceof File && a.name !== "");
}
