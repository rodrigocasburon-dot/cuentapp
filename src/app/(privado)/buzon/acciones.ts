"use server";

// Simulación de un correo entrante (fase 8). Solo se puede «enviar» al buzón
// de la propia empresa: la dirección sale de la sesión, no del formulario.

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { TAMANO_MAXIMO, type EstadoSubida, type ResultadoArchivo } from "@/dominio/subida";
import { repositorioActual } from "@/servidor/auth/sesion";
import { bd } from "@/servidor/bd/conexion";
import { recibirCorreo } from "@/servidor/documentos/buzon";
import { limpiarNombre } from "@/servidor/documentos/recibir";
import { lanzarCola } from "@/servidor/lectura/cola";

export async function simularCorreo(_previo: EstadoSubida, f: FormData): Promise<EstadoSubida> {
  const { sesion } = await repositorioActual();
  const archivos = f.getAll("adjuntos").filter((a): a is File => a instanceof File && a.name !== "");
  if (archivos.length === 0) return { mensaje: "Adjunta al menos un documento." };

  const grandes: ResultadoArchivo[] = archivos
    .filter((a) => a.size > TAMANO_MAXIMO)
    .map((a) => ({ nombre: limpiarNombre(a.name), ok: false, motivo: "Ocupa más de 10 MB." }));
  const adjuntos = await Promise.all(
    archivos.filter((a) => a.size <= TAMANO_MAXIMO).map(async (a) => ({ nombre: a.name, bytes: new Uint8Array(await a.arrayBuffer()) })),
  );

  const r = recibirCorreo(bd(), {
    para: sesion.empresa.buzon,
    de: String(f.get("de") ?? ""),
    asunto: String(f.get("asunto") ?? ""),
    adjuntos,
  });
  if (!r.ok) return { mensaje: r.motivo, resultados: grandes.length ? grandes : undefined };
  if (r.resultados.some((x) => x.ok)) after(lanzarCola);
  revalidatePath("/documentos");
  revalidatePath("/panel");
  revalidatePath("/buzon");
  return { resultados: [...r.resultados, ...grandes] };
}
