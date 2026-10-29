"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
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
