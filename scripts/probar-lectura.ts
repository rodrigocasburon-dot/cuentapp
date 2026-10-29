// npm run lectura:probar
// Pasa el banco sintético por la lectura REAL de la app (extractInvoice +
// validaciones), igual que lo haría la cola de procesado, y compara con la
// verdad. Incluye las versiones PDF de las facturas (vía "texto del PDF").
// Sirve para comprobar que el motor está bien instalado y no ha empeorado.

import fs from "node:fs";
import path from "node:path";
import { puntuar } from "../comparativa/puntuar";
import { leerBanco } from "../comparativa/verdad";
import { validar } from "../src/dominio/validaciones";
import { CAMPOS } from "../src/lectura/esquema";
import { extractInvoice } from "../src/servidor/lectura/extraer";
import { servicioOcr } from "../src/servidor/lectura/servicio-ocr";

async function principal() {
  const carpeta = path.join(process.cwd(), "banco-tickets", "sinteticos");
  const docs = leerBanco(carpeta).flatMap(({ verdad, imagen }) => {
    const pdf = path.join(carpeta, `${verdad.id}.pdf`);
    return fs.existsSync(pdf) ? [{ verdad, archivo: imagen }, { verdad, archivo: pdf }] : [{ verdad, archivo: imagen }];
  });

  let correctos = 0;
  let total = 0;
  for (const { verdad, archivo } of docs) {
    const r = await extractInvoice(archivo);
    const p = puntuar(verdad, r.extraccion);
    const avisos = validar(r.extraccion).filter((a) => a.nivel !== "info").map((a) => a.codigo);
    correctos += p.correctos;
    total += CAMPOS.length;
    const fallos = p.campos.filter((c) => c.resultado !== "correcto").map((c) => `${c.campo}:${c.resultado}`);
    console.log(
      `${path.basename(archivo).padEnd(28)} ${String(p.correctos).padStart(2)}/${CAMPOS.length}  ${r.segundos.toFixed(2).padStart(5)} s  ${r.motor.padEnd(26)} avisos: ${avisos.join(", ") || "—"}${fallos.length ? `  · fallos: ${fallos.join(", ")}` : ""}`,
    );
  }
  console.log(`\nCampos correctos: ${correctos}/${total} (${((100 * correctos) / total).toFixed(0)} %)`);
  servicioOcr().detener();
}

principal().catch((e) => {
  console.error(e);
  servicioOcr().detener();
  process.exit(1);
});
