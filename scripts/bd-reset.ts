// npm run db:reset
// Borra la base de datos local, la vuelve a crear con bd/esquema.sql y
// carga los planes y dos empresas de prueba. Los ORIGINALES no se tocan:
// si existen, este script se niega a seguir (perderíamos la relación
// documento ↔ original). Para empezar de cero, bórralos tú a mano.

import fs from "node:fs";
import { abrirBd, aplicarEsquema, insertarPlanes } from "../src/servidor/bd/conexion";
import { RUTA_BD, CARPETA_ORIGINALES } from "../src/config";

const hayOriginales =
  fs.existsSync(CARPETA_ORIGINALES) && fs.readdirSync(CARPETA_ORIGINALES).length > 0;
if (hayOriginales) {
  console.error(`Hay originales en ${CARPETA_ORIGINALES}. No reinicio la base de datos para no dejarlos huérfanos.`);
  process.exit(1);
}

for (const sufijo of ["", "-wal", "-shm"]) fs.rmSync(RUTA_BD + sufijo, { force: true });

const bd = abrirBd();
aplicarEsquema(bd);
insertarPlanes(bd);

// Dos empresas ficticias para probar el aislamiento desde el primer día
const empresas = bd.prepare(
  "INSERT INTO empresas (id, nombre, nif, plan_id, prueba_hasta, buzon) VALUES (?, ?, ?, ?, ?, ?)",
);
empresas.run("empresa-a", "Panadería Ejemplo S.L.", "B00000000", "cuentapp", null, "panaderia@buzon.cuentapp.local");
empresas.run("empresa-b", "Talleres Ficticios S.L.", "B11111119", "prueba", "2099-12-31", "talleres@buzon.cuentapp.local");

bd.close();
console.log(`Base de datos creada en ${RUTA_BD} con 3 planes y 2 empresas de prueba.`);
