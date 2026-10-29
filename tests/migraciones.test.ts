// Las migraciones llevan una base de datos con datos a la versión actual sin perderlos.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { abrirBd, aplicarEsquema, insertarPlanes, migrar, VERSION_ESQUEMA } from "@/servidor/bd/conexion";

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
    insertarPlanes(bd);
    bd.prepare("INSERT INTO empresas (id, nombre, plan_id, buzon) VALUES ('A', 'A', 'prueba', 'a@b')").run();
    bd.prepare(
      `INSERT INTO documentos (id, empresa_id, origen, nombre_original, mime, tamano_bytes, ruta_original, hash_sha256)
       VALUES ('d1', 'A', 'subida', 'x.png', 'image/png', 10, 'A/x.png', '${"a".repeat(64)}')`,
    ).run();
    expect(bd.pragma("user_version", { simple: true })).toBe(2);

    expect(migrar(bd)).toEqual(["003-lectura.sql", "004-correccion-duplicados.sql"]);
    expect(bd.pragma("user_version", { simple: true })).toBe(VERSION_ESQUEMA);
    const doc = bd.prepare("SELECT nombre_original, avisos_json FROM documentos WHERE id = 'd1'").get();
    expect(doc).toEqual({ nombre_original: "x.png", avisos_json: null });
    // Los triggers de integridad siguen funcionando tras migrar
    expect(() => bd.prepare("DELETE FROM documentos WHERE id = 'd1'").run()).toThrow(/borrar/);
  });
});
