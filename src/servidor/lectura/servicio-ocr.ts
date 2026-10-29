// Puente Node ↔ Python con el servicio OCR (lectura-py/servicio_ocr.py).
// Arranca el proceso la primera vez que se necesita y lo reutiliza. Si el
// proceso muere, la siguiente petición lo vuelve a arrancar.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PYTHON = path.join(process.cwd(), ".venv-ocr", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const SCRIPT = path.join(process.cwd(), "lectura-py", "servicio_ocr.py");
const TIEMPO_MAXIMO_MS = 120_000; // por documento

export interface LecturaOcr {
  texto: string;
  confianza: number;      // 0..1, media del OCR (0,98 si el PDF ya traía texto)
  fuente: "ocr" | "pdf-texto";
  segundos: number;
}

interface Pendiente {
  resolver: (l: LecturaOcr) => void;
  rechazar: (e: Error) => void;
  temporizador: NodeJS.Timeout;
}

class ServicioOcr {
  private proceso?: ChildProcessWithoutNullStreams;
  private listo?: Promise<void>;
  private pendientes = new Map<number, Pendiente>();
  private siguienteId = 1;
  private resto = "";

  disponible(): boolean {
    return fs.existsSync(PYTHON) && fs.existsSync(SCRIPT);
  }

  private arrancar(): Promise<void> {
    const proceso = spawn(PYTHON, ["-I", SCRIPT], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    this.proceso = proceso;
    this.listo = new Promise((resolver, rechazar) => {
      proceso.stdout.setEncoding("utf8").on("data", (trozo: string) => {
        this.resto += trozo;
        let fin: number;
        while ((fin = this.resto.indexOf("\n")) >= 0) {
          const linea = this.resto.slice(0, fin).trim();
          this.resto = this.resto.slice(fin + 1);
          if (!linea) continue;
          const m = JSON.parse(linea);
          if (m.listo) resolver();
          else this.responder(m);
        }
      });
      // RapidOCR escribe mucho [INFO] por stderr: solo mostramos avisos y errores
      proceso.stderr.setEncoding("utf8").on("data", (d: string) => {
        const importantes = d.split(/\r?\n/).filter((l) => l.trim() && !l.includes("[INFO]") && !/^C:\\|^\/.+\.onnx$/.test(l.trim()));
        if (importantes.length) console.error(`[ocr] ${importantes.join("\n")}`);
      });
      proceso.on("error", rechazar);
      proceso.on("exit", (codigo) => {
        this.proceso = undefined;
        this.listo = undefined;
        rechazar(new Error(`El servicio OCR terminó (código ${codigo})`));
        for (const [id, p] of this.pendientes) {
          clearTimeout(p.temporizador);
          p.rechazar(new Error("El servicio OCR se detuvo"));
          this.pendientes.delete(id);
        }
      });
    });
    return this.listo;
  }

  private responder(m: { id: number; error?: string } & LecturaOcr) {
    const p = this.pendientes.get(m.id);
    if (!p) return;
    clearTimeout(p.temporizador);
    this.pendientes.delete(m.id);
    if (m.error) p.rechazar(new Error(m.error));
    else p.resolver({ texto: m.texto, confianza: m.confianza, fuente: m.fuente, segundos: m.segundos });
  }

  async leer(rutaAbsoluta: string): Promise<LecturaOcr> {
    if (!this.disponible()) throw new Error("Motor OCR no instalado (falta .venv-ocr; ver README)");
    if (!this.proceso) await this.arrancar();
    else await this.listo;
    const id = this.siguienteId++;
    return new Promise((resolver, rechazar) => {
      const temporizador = setTimeout(() => {
        this.pendientes.delete(id);
        rechazar(new Error("El OCR tardó demasiado"));
      }, TIEMPO_MAXIMO_MS);
      this.pendientes.set(id, { resolver, rechazar, temporizador });
      this.proceso!.stdin.write(JSON.stringify({ id, ruta: rutaAbsoluta }) + "\n");
    });
  }

  detener() {
    this.proceso?.kill();
  }
}

// Una sola instancia por proceso de Node (globalThis sobrevive a la recarga en caliente de Next)
const g = globalThis as unknown as { __cuentappOcr?: ServicioOcr };
export function servicioOcr(): ServicioOcr {
  g.__cuentappOcr ??= new ServicioOcr();
  return g.__cuentappOcr;
}
