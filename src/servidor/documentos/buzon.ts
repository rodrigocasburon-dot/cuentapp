// Buzón de correo SIMULADO (fase 8, FA-02). Cada empresa tiene una dirección
// (empresas.buzon); los adjuntos de un correo enviado a ella entran como
// documentos con origen "buzon", igual que una subida.
//
// MVP local: no hay servidor de correo. Los correos se simulan desde la
// página «Buzón» o con `npm run buzon:simular`. En producción, un proveedor de
// correo entrante llamaría a esta misma función (ver SUPUESTOS.md).

import type { ResultadoArchivo } from "@/dominio/subida";
import { MAX_ARCHIVOS_POR_SUBIDA } from "@/dominio/subida";
import type { Bd } from "@/servidor/bd/conexion";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { empresaPorBuzon } from "@/servidor/bd/sistema";
import { cupoDisponible } from "./limites";
import { limpiarNombre, recibirArchivo } from "./recibir";

export interface Correo {
  para: string;
  de: string;
  asunto: string;
  adjuntos: { nombre: string; bytes: Uint8Array }[];
}

export type ResultadoCorreo = { ok: false; motivo: string } | { ok: true; empresaId: string; resultados: ResultadoArchivo[] };

/** Texto corto y sin caracteres de control (remitente y asunto vienen de fuera). */
const limpio = (texto: string, max: number) => texto.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export function recibirCorreo(bd: Bd, correo: Correo, carpeta?: string, ahora = new Date()): ResultadoCorreo {
  const empresaId = empresaPorBuzon(bd, correo.para);
  // Mismo mensaje si no existe o está dada de baja: no revelamos qué direcciones existen
  if (!empresaId) return { ok: false, motivo: "No hay ningún buzón con esa dirección." };
  if (correo.adjuntos.length === 0) return { ok: false, motivo: "El correo no trae adjuntos." };

  const repo = repositorioDeEmpresa(bd, empresaId);
  const de = limpio(correo.de, 200) || "remitente desconocido";
  const asunto = limpio(correo.asunto, 200);
  const { disponibles, motivo: motivoCupo } = cupoDisponible(repo, ahora);
  let cupo = disponibles;

  const resultados: ResultadoArchivo[] = correo.adjuntos.map((adjunto, i) => {
    if (i >= MAX_ARCHIVOS_POR_SUBIDA) return { nombre: limpiarNombre(adjunto.nombre), ok: false, motivo: `Solo se admiten ${MAX_ARCHIVOS_POR_SUBIDA} adjuntos por correo.` };
    if (cupo <= 0) return { nombre: limpiarNombre(adjunto.nombre), ok: false, motivo: motivoCupo ?? "Límite del plan alcanzado." };
    const r = recibirArchivo(repo, adjunto, "buzon", carpeta, ahora);
    if (r.ok) {
      cupo--;
      repo.anotarCorreo(r.id, de, asunto);
    }
    return r;
  });
  return { ok: true, empresaId, resultados };
}
