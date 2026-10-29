// Copia local del trimestre (fase 8): sustituto en el MVP de «Google Drive».
// Copia los originales VALIDADOS de un trimestre a una carpeta ordenada:
//
//   <CARPETA_COPIA>/<empresa>/<año>/T<n>/Facturas completas/2026-08-19_Bar Prueba_T-1.pdf
//                                       /Tickets/…
//                                       /resumen-<año>-T<n>.xlsx
//
// Nunca toca los originales: los lee (comprobando su SHA-256) y escribe una
// copia. Es idempotente: lo que ya está copiado e igual no se vuelve a escribir.

import fs from "node:fs";
import path from "node:path";
import { CARPETA_COPIA, CARPETA_ORIGINALES } from "@/config";
import { leerOriginal, sha256 } from "@/servidor/almacen/originales";
import type { Repositorio } from "@/servidor/bd/repositorio";
import { generarExcelTrimestre } from "./excel";

export interface ResultadoCopia {
  carpeta: string;     // carpeta del trimestre
  copiados: number;
  yaEstaban: number;
  sinValidar: number;  // no se copian hasta validarlos
  fallidos: number;    // originales que no superan la comprobación de integridad
}

/** Trozo de nombre de fichero seguro en Windows, macOS y Linux. */
export function parteSegura(texto: string | null | undefined, max = 40): string {
  const limpio = (texto ?? "")
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, max)
    .trim();
  return limpio || "sin-dato";
}

export async function copiarTrimestre(
  repo: Repositorio,
  anio: number,
  trimestre: number,
  destino = CARPETA_COPIA,
  carpetaOriginales = CARPETA_ORIGINALES,
): Promise<ResultadoCopia> {
  const empresa = repo.datosEmpresa();
  const carpeta = path.join(destino, `${parteSegura(empresa.nombre)} (${repo.empresaId.slice(0, 8)})`, String(anio), `T${trimestre}`);
  const docs = repo.documentosDelTrimestre(anio, trimestre);
  const r: ResultadoCopia = { carpeta, copiados: 0, yaEstaban: 0, sinValidar: 0, fallidos: 0 };
  const usados = new Set<string>();

  for (const d of docs) {
    if (d.estado !== "validado") {
      r.sinValidar++;
      continue;
    }
    const original = leerOriginal(d.ruta_original, d.hash_sha256, carpetaOriginales);
    if (!original.ok) {
      r.fallidos++;
      continue;
    }
    const categoria = d.tipo === "factura_completa" ? "Facturas completas" : "Tickets";
    const ext = path.extname(d.ruta_original);
    let base = [parteSegura(d.fecha_emision, 10), parteSegura(d.nombre_emisor), parteSegura(d.numero, 30)].join("_");
    // Dos documentos con el mismo nombre: se distinguen por el principio del hash
    if (usados.has(`${categoria}/${base}`)) base += `_${d.hash_sha256.slice(0, 8)}`;
    usados.add(`${categoria}/${base}`);

    const fichero = path.join(carpeta, categoria, base + ext);
    if (fs.existsSync(fichero) && sha256(fs.readFileSync(fichero)) === d.hash_sha256) {
      r.yaEstaban++;
      continue;
    }
    fs.mkdirSync(path.dirname(fichero), { recursive: true });
    fs.writeFileSync(fichero, original.bytes);
    r.copiados++;
  }

  // Resumen en Excel del trimestre, el mismo que se descarga desde el panel
  fs.mkdirSync(carpeta, { recursive: true });
  const excel = await generarExcelTrimestre({
    empresa: { nombre: empresa.nombre, nif: empresa.nif },
    anio,
    trimestre,
    semaforo: repo.resumenTrimestre(anio, trimestre),
    documentos: docs,
  });
  fs.writeFileSync(path.join(carpeta, `resumen-${anio}-T${trimestre}.xlsx`), excel);
  return r;
}
