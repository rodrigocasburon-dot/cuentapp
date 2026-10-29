// Fase 1 · El esquema impone estados, tipos e inmutabilidad del original.

import { describe, expect, it } from "vitest";
import { ESTADOS, TIPOS_DOCUMENTO, TIPOS_INCIDENCIA } from "@/dominio/estados";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { bdDePrueba, ORIGINAL } from "./ayudas";

describe("estados y tipos", () => {
  it("acepta los cinco estados de estados.ts y rechaza otros", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const id = repo.crearDocumento(ORIGINAL);
    expect(repo.obtenerDocumento(id)?.estado).toBe("recibido");
    for (const e of ESTADOS.filter((e) => e !== "validado")) {
      expect(repo.cambiarEstado(id, e)).toBe(true);
    }
    expect(() => repo.cambiarEstado(id, "archivado" as never)).toThrow();
  });

  it("'validado' exige quién y cuándo validó", () => {
    const bd = bdDePrueba();
    const id = repositorioDeEmpresa(bd, "A").crearDocumento(ORIGINAL);
    expect(() => bd.prepare("UPDATE documentos SET estado = 'validado' WHERE id = ?").run(id)).toThrow();
    bd.prepare(
      "UPDATE documentos SET estado = 'validado', validado_en = '2026-10-29T10:00:00Z', validado_por = 'uA' WHERE id = ?",
    ).run(id);
  });

  it("los tipos de documento e incidencia coinciden con el esquema", () => {
    const bd = bdDePrueba();
    const id = repositorioDeEmpresa(bd, "A").crearDocumento(ORIGINAL);
    for (const t of TIPOS_DOCUMENTO) bd.prepare("UPDATE documentos SET tipo = ? WHERE id = ?").run(t, id);
    expect(() => bd.prepare("UPDATE documentos SET tipo = 'albaran' WHERE id = ?").run(id)).toThrow();
    for (const t of TIPOS_INCIDENCIA) {
      bd.prepare(
        "INSERT INTO incidencias (id, empresa_id, documento_id, tipo, bloqueante, descripcion) VALUES (?, 'A', ?, ?, 0, 'x')",
      ).run(`i-${t}`, id, t);
    }
  });
});

describe("original inmutable", () => {
  it("no deja cambiar hash, ruta ni empresa del original", () => {
    const bd = bdDePrueba();
    const id = repositorioDeEmpresa(bd, "A").crearDocumento(ORIGINAL);
    expect(() => bd.prepare(`UPDATE documentos SET hash_sha256 = '${"b".repeat(64)}' WHERE id = ?`).run(id)).toThrow(/original/);
    expect(() => bd.prepare("UPDATE documentos SET ruta_original = 'otra' WHERE id = ?").run(id)).toThrow(/original/);
    expect(() => bd.prepare("UPDATE documentos SET empresa_id = 'B' WHERE id = ?").run(id)).toThrow(/original/);
  });

  it("no deja borrar documentos", () => {
    const bd = bdDePrueba();
    const id = repositorioDeEmpresa(bd, "A").crearDocumento(ORIGINAL);
    expect(() => bd.prepare("DELETE FROM documentos WHERE id = ?").run(id)).toThrow(/borrar/);
  });

  it("la extracción original no se reescribe", () => {
    const bd = bdDePrueba();
    const id = repositorioDeEmpresa(bd, "A").crearDocumento(ORIGINAL);
    bd.prepare("UPDATE documentos SET extraccion_json = '{}' WHERE id = ?").run(id);
    expect(() => bd.prepare("UPDATE documentos SET extraccion_json = '{\"x\":1}' WHERE id = ?").run(id)).toThrow();
  });

  it("los importes son enteros en céntimos", () => {
    const bd = bdDePrueba();
    const tipos = bd.prepare("SELECT name, type FROM pragma_table_info('documentos') WHERE name LIKE '%centimos'").all() as {
      type: string;
    }[];
    expect(tipos.length).toBeGreaterThan(0);
    for (const t of tipos) expect(t.type).toBe("INTEGER");
  });
});
