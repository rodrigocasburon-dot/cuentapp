// npm run db:migrar
// Aplica las migraciones pendientes de bd/migraciones a la base de datos
// local SIN borrar datos. Antes copia la base de datos por si acaso.

import fs from "node:fs";
import { abrirBd, migrar } from "../src/servidor/bd/conexion";
import { RUTA_BD } from "../src/config";

if (!fs.existsSync(RUTA_BD)) {
  console.error(`No existe ${RUTA_BD}. Para crearla: npm run db:reset`);
  process.exit(1);
}

const bd = abrirBd(RUTA_BD, false);
const antes = bd.pragma("user_version", { simple: true });
const copia = `${RUTA_BD}.antes-de-migrar-v${antes}`;
bd.pragma("wal_checkpoint(TRUNCATE)"); // volcar el diario WAL al fichero antes de copiarlo
fs.copyFileSync(RUTA_BD, copia);

const aplicadas = migrar(bd);
const despues = bd.pragma("user_version", { simple: true });
bd.close();

if (aplicadas.length === 0) {
  fs.rmSync(copia);
  console.log(`La base de datos ya está al día (versión ${despues}).`);
} else {
  console.log(`Migrada de la versión ${antes} a la ${despues}: ${aplicadas.join(", ")}`);
  console.log(`Copia de seguridad previa: ${copia}`);
}
