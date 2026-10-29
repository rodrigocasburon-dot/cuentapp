// npm run db:reset
// Borra la base de datos local, la vuelve a crear con bd/esquema.sql y
// carga los planes, dos empresas de prueba y un usuario en cada una.
// Los ORIGINALES no se tocan: si existen, este script se niega a seguir
// (perderíamos la relación documento ↔ original). Para empezar de cero,
// bórralos tú a mano.
//
// CUENTAS DE PRUEBA (solo para el entorno local; no son datos reales):
//   ana@panaderia.test  / prueba-panaderia-2026  → Panadería Ejemplo S.L. (plan Cuentapp)
//   beto@talleres.test  / prueba-talleres-2026   → Talleres Ficticios S.L. (plan Prueba)

import fs from "node:fs";
import { abrirBd, aplicarEsquema, insertarPlanes } from "../src/servidor/bd/conexion";
import { cifrarContrasena } from "../src/servidor/auth/contrasenas";
import { RUTA_BD, CARPETA_ORIGINALES } from "../src/config";

const CUENTAS = [
  {
    empresa: { id: "empresa-a", nombre: "Panadería Ejemplo S.L.", nif: "B00000000", plan: "cuentapp", prueba_hasta: null, buzon: "panaderia@buzon.cuentapp.local" },
    usuario: { id: "usuario-a", nombre: "Ana Prueba", email: "ana@panaderia.test", contrasena: "prueba-panaderia-2026" },
  },
  {
    empresa: { id: "empresa-b", nombre: "Talleres Ficticios S.L.", nif: "B11111119", plan: "prueba", prueba_hasta: "2099-12-31T00:00:00Z", buzon: "talleres@buzon.cuentapp.local" },
    usuario: { id: "usuario-b", nombre: "Beto Prueba", email: "beto@talleres.test", contrasena: "prueba-talleres-2026" },
  },
];

async function principal() {
  const hayOriginales = fs.existsSync(CARPETA_ORIGINALES) && fs.readdirSync(CARPETA_ORIGINALES).length > 0;
  if (hayOriginales) {
    console.error(`Hay originales en ${CARPETA_ORIGINALES}. No reinicio la base de datos para no dejarlos huérfanos.`);
    process.exit(1);
  }

  for (const sufijo of ["", "-wal", "-shm"]) fs.rmSync(RUTA_BD + sufijo, { force: true });

  const bd = abrirBd();
  aplicarEsquema(bd);
  insertarPlanes(bd);

  for (const { empresa: e, usuario: u } of CUENTAS) {
    bd.prepare("INSERT INTO empresas (id, nombre, nif, plan_id, prueba_hasta, buzon) VALUES (?, ?, ?, ?, ?, ?)").run(e.id, e.nombre, e.nif, e.plan, e.prueba_hasta, e.buzon);
    bd.prepare("INSERT INTO usuarios (id, email, hash_contrasena, nombre) VALUES (?, ?, ?, ?)").run(u.id, u.email, await cifrarContrasena(u.contrasena), u.nombre);
    bd.prepare("INSERT INTO membresias (usuario_id, empresa_id, rol) VALUES (?, ?, 'titular')").run(u.id, e.id);
  }

  bd.close();
  console.log(`Base de datos creada en ${RUTA_BD}: 3 planes, ${CUENTAS.length} empresas y sus usuarios de prueba (ver scripts/bd-reset.ts).`);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
