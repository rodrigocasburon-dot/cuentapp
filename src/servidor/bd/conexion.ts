// Conexión a SQLite. ÚNICO sitio (junto con repositorio.ts y los scripts de
// bd) que puede tocar la base de datos directamente. El resto del código usa
// repositorioDeEmpresa(), que añade siempre el filtro por empresa.

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { RUTA_BD } from "@/config";

export type Bd = Database.Database;

const RUTA_ESQUEMA = path.join(process.cwd(), "bd", "esquema.sql");
const CARPETA_MIGRACIONES = path.join(process.cwd(), "bd", "migraciones");

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

/**
 * Base de datos NUEVA: crea el esquema base (bd/esquema.sql, versión 2) y
 * aplica después todas las migraciones. Así una base nueva y una migrada
 * acaban exactamente iguales.
 */
export function aplicarEsquema(bd: Bd): void {
  bd.exec(fs.readFileSync(RUTA_ESQUEMA, "utf8"));
  migrar(bd);
}

/**
 * Aplica, en orden, las migraciones de bd/migraciones con número mayor que
 * la versión actual ("003-lectura.sql" → versión 3). Cada una va en su
 * propia transacción: si falla, la base de datos queda como estaba.
 * Devuelve los ficheros aplicados.
 */
export function migrar(bd: Bd): string[] {
  const actual = bd.pragma("user_version", { simple: true }) as number;
  const pendientes = fs
    .readdirSync(CARPETA_MIGRACIONES)
    .filter((f) => /^\d{3}-.+\.sql$/.test(f))
    .sort()
    .filter((f) => Number(f.slice(0, 3)) > actual);
  for (const f of pendientes) {
    bd.transaction(() => {
      bd.exec(fs.readFileSync(path.join(CARPETA_MIGRACIONES, f), "utf8"));
      bd.pragma(`user_version = ${Number(f.slice(0, 3))}`);
    })();
  }
  return pendientes;
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

/** Número de la última migración de bd/migraciones (una prueba lo comprueba). */
export const VERSION_ESQUEMA = 3;

// Una sola conexión compartida por el servidor de Next.js
let compartida: Bd | undefined;
export function bd(): Bd {
  if (!compartida) {
    const nueva = abrirBd(RUTA_BD, false);
    const version = nueva.pragma("user_version", { simple: true });
    if (version !== VERSION_ESQUEMA) {
      nueva.close();
      throw new Error(`La base de datos es de la versión ${version} y el código espera la ${VERSION_ESQUEMA}. Ejecuta npm run db:migrar.`);
    }
    compartida = nueva;
  }
  return compartida;
}
