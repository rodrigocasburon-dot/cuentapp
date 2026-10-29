// Conexión a SQLite. ÚNICO sitio (junto con repositorio.ts y los scripts de
// bd) que puede tocar la base de datos directamente. El resto del código usa
// repositorioDeEmpresa(), que añade siempre el filtro por empresa.

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { RUTA_BD } from "@/config";

export type Bd = Database.Database;

const RUTA_ESQUEMA = path.join(process.cwd(), "bd", "esquema.sql");

/**
 * Abre la base de datos con las opciones que necesitamos.
 * Con crear = false falla si el fichero no existe (así el servidor no crea
 * una base de datos vacía por error; hay que ejecutar npm run db:reset).
 */
export function abrirBd(ruta: string = RUTA_BD, crear = true): Bd {
  if (crear && ruta !== ":memory:") fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const bd = new Database(ruta, { fileMustExist: !crear });
  bd.pragma("journal_mode = WAL"); // lecturas y escrituras concurrentes sin bloquearse
  bd.pragma("foreign_keys = ON"); // SQLite las trae desactivadas por defecto
  return bd;
}

/** Crea todas las tablas y triggers. Solo para una base de datos vacía. */
export function aplicarEsquema(bd: Bd): void {
  bd.exec(fs.readFileSync(RUTA_ESQUEMA, "utf8"));
}

/** Datos de referencia: los tres planes (importes provisionales, sin IVA). */
export function insertarPlanes(bd: Bd): void {
  const insertar = bd.prepare(
    `INSERT INTO planes (id, nombre, precio_centimos, limite_docs_mes, limite_docs_total, dias_prueba, disponible)
     VALUES (@id, @nombre, @precio_centimos, @limite_docs_mes, @limite_docs_total, @dias_prueba, @disponible)`,
  );
  insertar.run({ id: "prueba", nombre: "Prueba", precio_centimos: 0, limite_docs_mes: null, limite_docs_total: 30, dias_prueba: 14, disponible: 1 });
  insertar.run({ id: "cuentapp", nombre: "Cuentapp", precio_centimos: 2000, limite_docs_mes: 250, limite_docs_total: null, dias_prueba: null, disponible: 1 });
  insertar.run({ id: "despacho", nombre: "Despacho", precio_centimos: 0, limite_docs_mes: null, limite_docs_total: null, dias_prueba: null, disponible: 0 });
}

// Una sola conexión compartida por el servidor de Next.js
let compartida: Bd | undefined;
export function bd(): Bd {
  compartida ??= abrirBd(RUTA_BD, false);
  return compartida;
}
