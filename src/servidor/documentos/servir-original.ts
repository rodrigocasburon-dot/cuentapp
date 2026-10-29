// Entrega del original al navegador (RF-03, RF-08).
// Solo si el documento es de la empresa de la sesión (el repositorio ya
// filtra) y solo si el fichero sigue coincidiendo con su SHA-256.

import { leerOriginal } from "@/servidor/almacen/originales";
import type { Repositorio } from "@/servidor/bd/repositorio";

export interface RespuestaOriginal {
  estado: number;
  cuerpo: Uint8Array | string;
  cabeceras: Record<string, string>;
}

/** Cabecera Content-Disposition con nombre en UTF-8 y alternativa ASCII. */
function disposicion(nombre: string, descargar: boolean): string {
  const ascii = nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "_") || "documento";
  return `${descargar ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

const TEXTO = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };

export function respuestaOriginal(repo: Repositorio, id: string, descargar: boolean, carpeta?: string): RespuestaOriginal {
  const doc = repo.obtenerDocumento(id);
  // Mismo 404 si no existe o si es de otra empresa: no revelamos qué ids existen
  if (!doc) return { estado: 404, cuerpo: "Documento no encontrado.", cabeceras: TEXTO };

  const lectura = leerOriginal(doc.ruta_original, doc.hash_sha256, carpeta);
  if (!lectura.ok) {
    console.error(`[RF-08] Original ${lectura.motivo} · documento ${doc.id} · ${doc.ruta_original}`);
    return { estado: 500, cuerpo: "El original no supera la comprobación de integridad. Avisa al equipo.", cabeceras: TEXTO };
  }
  return {
    estado: 200,
    cuerpo: new Uint8Array(lectura.bytes),
    cabeceras: {
      "Content-Type": doc.mime,                 // detectado por sus bytes al subirlo, no el que dijo el navegador
      "Content-Length": String(lectura.bytes.length),
      "Content-Disposition": disposicion(doc.nombre_original, descargar),
      "X-Content-Type-Options": "nosniff",      // el navegador no debe "adivinar" otro tipo
      "Cache-Control": "private, no-store",     // nada de cachés compartidas
      ETag: `"${doc.hash_sha256}"`,
    },
  };
}

/** Para la ficha del documento: ¿el original sigue intacto? */
export function originalIntegro(ruta: string, hash: string, carpeta?: string): boolean {
  return leerOriginal(ruta, hash, carpeta).ok;
}
