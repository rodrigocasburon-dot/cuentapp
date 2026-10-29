// Motor B: RapidOCR (modelos PP-OCR de PaddleOCR sobre ONNX Runtime).
// Se ejecuta en Python, en el entorno virtual .venv-ocr del proyecto:
//   python -m venv .venv-ocr
//   .venv-ocr\Scripts\python -m pip install rapidocr==3.10.0 onnxruntime==1.31.1

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { analizarTexto } from "@/lectura/analizar-texto";
import type { Lectura, Motor } from "./tipos";

const PYTHON = path.join(process.cwd(), ".venv-ocr", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const SCRIPT = path.join(process.cwd(), "comparativa", "motores", "rapidocr_leer.py");

export const rapidocr: Motor = {
  id: "B",
  nombre: "RapidOCR 3.10 (PP-OCRv6 en ONNX, CPU)",
  local: true,

  async disponible() {
    return fs.existsSync(PYTHON) ? true : `No existe ${PYTHON}: crea el entorno virtual (ver README de la comparativa).`;
  },

  leer(archivos) {
    return new Promise((resolver, rechazar) => {
      const proceso = spawn(PYTHON, ["-I", SCRIPT, ...archivos], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
      let salida = "";
      let errores = "";
      proceso.stdout.setEncoding("utf8").on("data", (d) => (salida += d));
      proceso.stderr.setEncoding("utf8").on("data", (d) => (errores += d));
      proceso.on("error", rechazar);
      proceso.on("close", (codigo) => {
        if (codigo !== 0) return rechazar(new Error(`RapidOCR terminó con código ${codigo}: ${errores.slice(-500)}`));
        let carga_segundos = 0;
        const lecturas: Lectura[] = [];
        for (const linea of salida.split(/\r?\n/).filter(Boolean)) {
          const j = JSON.parse(linea);
          if ("carga_segundos" in j) carga_segundos = j.carga_segundos;
          else
            lecturas.push({
              archivo: j.archivo,
              texto: j.texto,
              extraccion: analizarTexto(j.texto, j.confianza),
              segundos: j.segundos,
              coste_eur: 0,
            });
        }
        resolver({ carga_segundos, lecturas });
      });
    });
  },
};
