// Motor A: Tesseract 5 (tesseract.js, compilado a WebAssembly), en local.
// Los datos de idioma (español, modelo LSTM "best_int") se leen de
// node_modules/@tesseract.js-data/spa: no se descarga nada al ejecutar.

import path from "node:path";
import { createWorker, OEM } from "tesseract.js";
import { analizarTexto } from "@/lectura/analizar-texto";
import type { Lectura, Motor } from "./tipos";

const DATOS_IDIOMA = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "spa", "4.0.0_best_int");

export const tesseract: Motor = {
  id: "A",
  nombre: "Tesseract 5 (tesseract.js, español)",
  local: true,

  async disponible() {
    return true;
  },

  async leer(archivos) {
    const t0 = performance.now();
    const worker = await createWorker("spa", OEM.LSTM_ONLY, {
      langPath: DATOS_IDIOMA,
      gzip: true,
      cacheMethod: "none", // no escribir cachés fuera del proyecto
    });
    const carga_segundos = (performance.now() - t0) / 1000;

    const lecturas: Lectura[] = [];
    for (const archivo of archivos) {
      const t = performance.now();
      try {
        const { data } = await worker.recognize(archivo);
        const confianza = (data.confidence ?? 0) / 100;
        lecturas.push({
          archivo,
          texto: data.text,
          extraccion: analizarTexto(data.text, confianza),
          segundos: (performance.now() - t) / 1000,
          coste_eur: 0,
        });
      } catch (e) {
        lecturas.push({ archivo, texto: "", extraccion: analizarTexto(""), segundos: (performance.now() - t) / 1000, coste_eur: 0, error: String(e) });
      }
    }
    await worker.terminate();
    return { carga_segundos, lecturas };
  },
};
