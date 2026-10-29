// Comparativa de motores de lectura (fase 2). Script independiente de la app.
//
//   npm run comparar                      → banco sintético, todos los motores disponibles
//   npm run comparar -- --banco reales    → documentos reales (solo motores locales)
//   npm run comparar -- --motores A,B     → solo esos motores
//
// Escribe en banco-tickets/resultados/<banco>/<fecha>/:
//   informe.md        resumen legible con el veredicto PL-01..PL-04
//   resultados.csv    una fila por motor y documento (para la hoja del equipo)
//   resultados.json   todo el detalle, incluido el texto leído

import fs from "node:fs";
import path from "node:path";
import { CAMPOS } from "@/lectura/esquema";
import { evaluar, type DocumentoPuntuado, type Veredicto } from "./criterios";
import { ollama } from "./motores/ollama";
import { rapidocr } from "./motores/rapidocr";
import { tesseract } from "./motores/tesseract";
import type { Lectura, Motor } from "./motores/tipos";
import { puntuar } from "./puntuar";
import { leerBanco, type Verdad } from "./verdad";

interface ResultadoMotor {
  motor: Motor;
  omitido?: string;
  carga_segundos?: number;
  docs?: (DocumentoPuntuado & { lectura: Lectura })[];
  veredictos?: Veredicto[];
}

// ---------------------------------------------------------------------------
// 1. Medir: cada motor lee todos los documentos y se puntúa
// ---------------------------------------------------------------------------
async function medir(banco: string, motores: Motor[], documentos: { verdad: Verdad; imagen: string }[]) {
  const resultados: ResultadoMotor[] = [];
  for (const motor of motores) {
    // Regla de privacidad: los documentos reales nunca van a un motor externo
    if (banco !== "sinteticos" && !motor.local) {
      resultados.push({ motor, omitido: "motor externo: no se usa con documentos reales" });
      continue;
    }
    const disp = await motor.disponible();
    if (disp !== true) {
      resultados.push({ motor, omitido: disp });
      console.log(`– ${motor.id} ${motor.nombre}: omitido (${disp})`);
      continue;
    }
    console.log(`▶ ${motor.id} ${motor.nombre}: leyendo ${documentos.length} documentos...`);
    const { carga_segundos, lecturas } = await motor.leer(documentos.map((d) => d.imagen));
    const docs = documentos.map(({ verdad, imagen }) => {
      const lectura = lecturas.find((l) => path.resolve(l.archivo) === path.resolve(imagen))!;
      return { verdad, lectura, p: puntuar(verdad, lectura.extraccion), segundos: lectura.segundos, coste_eur: lectura.coste_eur };
    });
    const veredictos = evaluar(docs, motor.local);
    resultados.push({ motor, carga_segundos, docs, veredictos });
    console.log(`  ${veredictos.map((v) => `${v.prueba} ${v.supera === null ? "—" : v.supera ? "✔" : "✖"}`).join("  ")}`);
  }
  return resultados;
}

// ---------------------------------------------------------------------------
// 2. Ordenar según la regla de elección
// ---------------------------------------------------------------------------
function clave(r: ResultadoMotor) {
  return {
    superadas: r.veredictos!.filter((v) => v.supera).length,
    confiados: r.docs!.reduce((s, d) => s + d.p.errores_confiados, 0),
    segundos: r.docs!.reduce((s, d) => s + d.segundos, 0),
  };
}

function ordenar(resultados: ResultadoMotor[]): ResultadoMotor[] {
  return resultados
    .filter((r) => r.docs)
    .sort((a, b) => {
      const [x, y] = [clave(a), clave(b)];
      return y.superadas - x.superadas || x.confiados - y.confiados || x.segundos - y.segundos;
    });
}

// ---------------------------------------------------------------------------
// 3. Escribir informe.md, resultados.csv y resultados.json
// ---------------------------------------------------------------------------
const icono = (s: boolean | null) => (s === null ? "— sin datos" : s ? "✔ supera" : "✖ no supera");
const marcaCorta = (s: boolean | null) => (s === null ? "—" : s ? "✔" : "✖");
const pct = (x: number) => `${(x * 100).toFixed(0)} %`;
const formato = (v: unknown) =>
  v === null
    ? "∅"
    : Array.isArray(v)
      ? v.map((l) => `${l.tipo_iva}%:${l.base_centimos}/${l.cuota_centimos}`).join(" ") || "∅"
      : String(v);

function informe(banco: string, marca: string, nDocs: number, resultados: ResultadoMotor[], medidos: ResultadoMotor[]): string {
  let md = `# Comparativa de lectura · banco "${banco}" · ${marca.replace("_", " ")}\n\n`;
  md += `Documentos: ${nDocs}. Criterios y umbrales: docs/pruebas-lectura.md (propuesta, pendiente del documento consolidado).\n\n`;
  md += `## Resumen\n\n| Motor | Local | Carga | s/doc | Campos correctos | Errores | Errores confiados | Correcciones | PL-01 | PL-02 | PL-03 | PL-04 |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of resultados) {
    if (!r.docs) {
      md += `| ${r.motor.id} · ${r.motor.nombre} | ${r.motor.local ? "sí" : "no"} | omitido: ${r.omitido} | | | | | | | | | |\n`;
      continue;
    }
    const n = r.docs.length;
    const suma = (f: (d: DocumentoPuntuado) => number) => r.docs!.reduce((t, d) => t + f(d), 0);
    md += `| ${r.motor.id} · ${r.motor.nombre} | ${r.motor.local ? "sí" : "no"} | ${r.carga_segundos!.toFixed(1)} s | ${(suma((d) => d.segundos) / n).toFixed(2)} | ${pct(suma((d) => d.p.correctos) / (n * CAMPOS.length))} | ${suma((d) => d.p.errores)} | ${suma((d) => d.p.errores_confiados)} | ${suma((d) => d.p.correcciones)} | ${r.veredictos!.map((v) => marcaCorta(v.supera)).join(" | ")} |\n`;
  }

  md += `\n## Veredicto\n\n`;
  if (medidos.length) {
    md += `Orden según la regla de elección (pruebas superadas → menos errores confiados → más rápido): **${medidos.map((r) => `${r.motor.id} (${clave(r).superadas}/4)`).join(" > ")}**.\n\n`;
    if (banco === "sinteticos") md += `> Resultado provisional: el banco sintético sobrestima la precisión. Repetir con documentos reales antes de decidir.\n\n`;
  }
  for (const r of medidos) {
    md += `### ${r.motor.id} · ${r.motor.nombre}\n\n`;
    for (const v of r.veredictos!) md += `- **${v.prueba}** ${icono(v.supera)}: ${v.medida}\n`;
    md += `\n| Documento | Correctos | Errores (confiados) | Vacíos | Total | IVA | Tipo | s | Correcciones | Fallos |\n|---|---|---|---|---|---|---|---|---|---|\n`;
    for (const d of r.docs!) {
      const fallos = d.p.campos
        .filter((c) => c.resultado !== "correcto")
        .map((c) => `${c.campo}: ${c.resultado} (leído ${formato(c.leido)}, real ${formato(c.real)}, conf. ${c.confianza})`);
      md += `| ${d.verdad.id} | ${d.p.correctos}/${CAMPOS.length} | ${d.p.errores} (${d.p.errores_confiados}) | ${d.p.vacios} | ${marcaCorta(d.p.total_ok)} | ${marcaCorta(d.p.desglose_ok)} | ${marcaCorta(d.p.tipo_ok)} | ${d.segundos.toFixed(2)} | ${d.p.correcciones} | ${fallos.join("<br>").replace(/\|/g, "/") || "—"} |\n`;
    }
    md += "\n";
  }
  return md;
}

function csv(medidos: ResultadoMotor[]): string {
  const filas = medidos.flatMap((r) =>
    r.docs!.map((d) =>
      [
        r.motor.id, d.verdad.id, d.verdad.degradacion, d.p.correctos, d.p.errores, d.p.errores_confiados, d.p.vacios,
        d.p.total_ok ? 1 : 0, d.p.desglose_ok ? 1 : 0, d.p.tipo_ok ? 1 : 0, d.segundos.toFixed(3), d.coste_eur, d.p.correcciones,
        `"${d.p.campos.filter((c) => c.resultado !== "correcto").map((c) => `${c.campo}:${c.resultado}`).join(" ")}"`,
      ].join(","),
    ),
  );
  const cabecera = "motor,documento,degradacion,campos_correctos,errores,errores_confiados,vacios,total_ok,desglose_iva_ok,tipo_ok,segundos,coste_eur,correcciones,fallos";
  return [cabecera, ...filas].join("\n") + "\n";
}

function detalleJson(resultados: ResultadoMotor[]): string {
  return JSON.stringify(
    resultados.map((r) => ({
      motor: { id: r.motor.id, nombre: r.motor.nombre, local: r.motor.local },
      omitido: r.omitido,
      carga_segundos: r.carga_segundos,
      veredictos: r.veredictos,
      documentos: r.docs?.map((d) => ({
        id: d.verdad.id,
        segundos: d.segundos,
        puntuacion: d.p,
        extraccion: d.lectura.extraccion,
        texto: d.lectura.texto,
        error: d.lectura.error,
      })),
    })),
    null,
    2,
  ) + "\n";
}

// ---------------------------------------------------------------------------
// Programa principal
// ---------------------------------------------------------------------------
async function principal() {
  const args = process.argv.slice(2);
  const arg = (nombre: string) => {
    const i = args.indexOf(`--${nombre}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const banco = arg("banco") ?? "sinteticos";
  const pedidos = (arg("motores") ?? "A,B,C").split(",");
  const motores = [tesseract, rapidocr, ollama].filter((m) => pedidos.includes(m.id));

  const carpetaBanco = path.join(process.cwd(), "banco-tickets", banco);
  const documentos = fs.existsSync(carpetaBanco) ? leerBanco(carpetaBanco) : [];
  if (!documentos.length) {
    console.error(`No hay documentos con verdad (.json + imagen) en ${carpetaBanco}`);
    process.exit(1);
  }

  const resultados = await medir(banco, motores, documentos);
  const medidos = ordenar(resultados);

  // Hora local, p. ej. "2026-10-29_0912"
  const ahora = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  const marca = `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}_${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
  const salida = path.join(process.cwd(), "banco-tickets", "resultados", banco, marca);
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, "informe.md"), informe(banco, marca, documentos.length, resultados, medidos), "utf8");
  fs.writeFileSync(path.join(salida, "resultados.csv"), csv(medidos), "utf8");
  fs.writeFileSync(path.join(salida, "resultados.json"), detalleJson(resultados), "utf8");
  console.log(`\nInforme: ${path.join(salida, "informe.md")}`);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
