// npm run originales:verificar
// RF-08: comprueba que el original de CADA documento existe y sigue
// coincidiendo con su SHA-256. Termina con código 1 si alguno falla, para
// poder usarlo en la prueba de aceptación. No modifica nada.

import { leerOriginal } from "../src/servidor/almacen/originales";
import { abrirBd } from "../src/servidor/bd/conexion";
import { referenciasDeOriginales } from "../src/servidor/bd/sistema";
import { RUTA_BD } from "../src/config";

const bd = abrirBd(RUTA_BD, false);
const refs = referenciasDeOriginales(bd);
bd.close();

const fallos = refs
  .map((r) => ({ ...r, lectura: leerOriginal(r.ruta_original, r.hash_sha256) }))
  .filter((r) => !r.lectura.ok);

for (const f of fallos) {
  console.error(`✖ ${f.id} · ${f.ruta_original} · ${f.lectura.ok ? "" : f.lectura.motivo === "no_existe" ? "NO EXISTE" : "ALTERADO"}`);
}
console.log(`${refs.length - fallos.length} de ${refs.length} originales intactos.`);
process.exit(fallos.length ? 1 : 0);
