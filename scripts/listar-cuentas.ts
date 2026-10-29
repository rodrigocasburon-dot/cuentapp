// npm run cuentas:listar — quién se ha registrado en ESTA base de datos local.
// Solo lectura. Las contraseñas no se pueden ver: se guardan cifradas (scrypt).
// Cada copia de la app (tu portátil, cada codespace) tiene su propia base de datos.

import Database from "better-sqlite3";
import { RUTA_BD } from "@/config";

function principal() {
  const bd = new Database(RUTA_BD, { readonly: true, fileMustExist: true });
  const filas = bd
    .prepare(
      `SELECT u.creado_en AS alta, u.nombre, u.email, e.nombre AS empresa, e.nif, e.plan_id AS plan, m.rol,
              (SELECT count(*) FROM documentos d WHERE d.empresa_id = e.id) AS documentos
       FROM usuarios u
       JOIN membresias m ON m.usuario_id = u.id
       JOIN empresas e ON e.id = m.empresa_id
       ORDER BY u.creado_en DESC`,
    )
    .all();
  bd.close();
  console.log(`${filas.length} cuenta(s) en ${RUTA_BD}\n`);
  console.table(filas);
}

principal();
