// npm run buzon:simular -- <dirección del buzón> <archivo> [archivo…] [--de x@y.com] [--asunto "texto"]
// Simula la llegada de un correo con adjuntos al buzón de una empresa (fase 8).
// Los documentos se leen solos la próxima vez que alguien abra «Documentos».

import fs from "node:fs";
import path from "node:path";
import { bd } from "@/servidor/bd/conexion";
import { recibirCorreo } from "@/servidor/documentos/buzon";

function principal() {
  const args = process.argv.slice(2);
  const opcion = (nombre: string) => {
    const i = args.indexOf(nombre);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const de = opcion("--de") ?? "simulador@cuentapp.local";
  const asunto = opcion("--asunto") ?? "Correo simulado";
  const [para, ...archivos] = args;
  if (!para || archivos.length === 0) {
    console.error('Uso: npm run buzon:simular -- <buzón> <archivo> [archivo…] [--de x@y.com] [--asunto "texto"]');
    process.exit(1);
  }
  const adjuntos = archivos.map((a) => ({ nombre: path.basename(a), bytes: new Uint8Array(fs.readFileSync(a)) }));
  const r = recibirCorreo(bd(), { para, de, asunto, adjuntos });
  if (!r.ok) {
    console.error(r.motivo);
    process.exit(1);
  }
  for (const x of r.resultados) console.log(x.ok ? `✔ ${x.nombre}` : `✖ ${x.nombre}: ${x.motivo}`);
}

principal();
