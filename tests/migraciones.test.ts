// Las migraciones llevan una base de datos con datos a la versión actual sin perderlos.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { abrirBd, aplicarEsquema, migrar, VERSION_ESQUEMA } from "@/servidor/bd/conexion";

describe("migraciones", () => {
  it("VERSION_ESQUEMA es el número de la última migración", () => {
    const numeros = fs
      .readdirSync(path.resolve(__dirname, "..", "bd", "migraciones"))
      .filter((f) => /^\d{3}-.+\.sql$/.test(f))
      .map((f) => Number(f.slice(0, 3)));
    expect(Math.max(...numeros)).toBe(VERSION_ESQUEMA);
  });

  it("una base nueva queda en la versión actual", () => {
    const bd = abrirBd(":memory:");
    aplicarEsquema(bd);
    expect(bd.pragma("user_version", { simple: true })).toBe(VERSION_ESQUEMA);
    expect(migrar(bd)).toEqual([]); // nada pendiente
  });

  it("una base de la versión 2 con datos se migra sin perderlos", () => {
    const bd = abrirBd(":memory:");
    bd.exec(fs.readFileSync(path.resolve(__dirname, "..", "bd", "esquema.sql"), "utf8")); // solo la base (v2)
    // Planes tal como estaban en la versión 2 (Cuentapp con 250, sin Pro)
    bd.exec(`INSERT INTO planes (id, nombre, precio_centimos, limite_docs_mes, limite_docs_total, dias_prueba, disponible) VALUES
      ('prueba', 'Prueba', 0, NULL, 30, 14, 1), ('cuentapp', 'Cuentapp', 2000, 250, NULL, NULL, 1), ('despacho', 'Despacho', 0, NULL, NULL, NULL, 0)`);
    bd.prepare("INSERT INTO empresas (id, nombre, plan_id, buzon) VALUES ('A', 'A', 'cuentapp', 'a@b')").run();
    bd.prepare(
      `INSERT INTO documentos (id, empresa_id, origen, nombre_original, mime, tamano_bytes, ruta_original, hash_sha256)
       VALUES ('d1', 'A', 'subida', 'x.png', 'image/png', 10, 'A/x.png', '${"a".repeat(64)}')`,
    ).run();
    expect(bd.pragma("user_version", { simple: true })).toBe(2);

    expect(migrar(bd)).toEqual(["003-lectura.sql", "004-correccion-duplicados.sql", "005-baja-cuentas.sql", "006-buzon.sql", "007-aceptaciones-legales.sql", "008-planes.sql"]);
    expect(bd.pragma("user_version", { simple: true })).toBe(VERSION_ESQUEMA);
    const doc = bd.prepare("SELECT nombre_original, avisos_json FROM documentos WHERE id = 'd1'").get();
    expect(doc).toEqual({ nombre_original: "x.png", avisos_json: null });
    // Planes de una base antigua actualizados (migración 8)
    expect(bd.prepare("SELECT id, precio_centimos, limite_docs_mes FROM planes WHERE id IN ('cuentapp', 'pro') ORDER BY id").all()).toEqual([
      { id: "cuentapp", precio_centimos: 2000, limite_docs_mes: 100 },
      { id: "pro", precio_centimos: 4000, limite_docs_mes: 300 },
    ]);
    // La empresa sigue apuntando a su plan y las claves foráneas siguen activas
    expect(bd.prepare("SELECT plan_id FROM empresas WHERE id = 'A'").get()).toEqual({ plan_id: "cuentapp" });
    expect(() => bd.prepare("UPDATE empresas SET plan_id = 'no-existe' WHERE id = 'A'").run()).toThrow(/FOREIGN KEY/);
    expect(bd.pragma("foreign_key_check")).toEqual([]);
    // Los triggers de integridad siguen funcionando tras migrar
    expect(() => bd.prepare("DELETE FROM documentos WHERE id = 'd1'").run()).toThrow(/borrar/);
  });
});
