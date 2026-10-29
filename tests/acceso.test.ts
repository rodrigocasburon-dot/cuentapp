// RF-01 · Acceso: contraseñas, registro, sesiones y freno a la fuerza bruta.

import { describe, expect, it } from "vitest";
import { EntradaSchema, RegistroSchema } from "@/dominio/formularios-acceso";
import { cifrarContrasena, verificarContrasena } from "@/servidor/auth/contrasenas";
import {
  DURACION_SESION_MS,
  EmailEnUso,
  MAX_INTENTOS,
  VENTANA_INTENTOS_MS,
  borrarSesion,
  crearEmpresaConTitular,
  crearSesion,
  empresasDeUsuario,
  hashToken,
  intentosRecientes,
  leerSesion,
  olvidarIntentos,
  registrarIntentoFallido,
} from "@/servidor/bd/cuentas";
import { bdDePrueba } from "./ayudas";

const registro = (email: string, empresa = "Empresa Nueva S.L.") => ({ empresa, nif: null, nombre: "Persona", email, hashContrasena: "x" });

describe("contraseñas", () => {
  it("verifica la correcta, rechaza las demás y nunca guarda la contraseña", async () => {
    const guardada = await cifrarContrasena("una-contraseña-larga");
    expect(guardada).not.toContain("una-contraseña-larga");
    expect(guardada.startsWith("scrypt$17$8$1$")).toBe(true);
    expect(await verificarContrasena("una-contraseña-larga", guardada)).toBe(true);
    expect(await verificarContrasena("una-contraseña-largA", guardada)).toBe(false);
    expect(await verificarContrasena("x", "basura")).toBe(false);
  });

  it("dos cifrados de la misma contraseña son distintos (sal aleatoria)", async () => {
    expect(await cifrarContrasena("misma-contraseña-1")).not.toBe(await cifrarContrasena("misma-contraseña-1"));
  });
});

describe("formularios", () => {
  it("normaliza el email y exige 10 caracteres de contraseña", () => {
    const ok = RegistroSchema.parse({ empresa: "Mi Empresa", nif: " b-00.000.000 ", nombre: "Ana", email: "  Ana@Ejemplo.ES ", contrasena: "1234567890" });
    expect(ok.email).toBe("ana@ejemplo.es");
    expect(ok.nif).toBe("B00000000");
    expect(RegistroSchema.safeParse({ empresa: "Mi Empresa", nif: "", nombre: "Ana", email: "ana@ejemplo.es", contrasena: "corta" }).success).toBe(false);
    expect(EntradaSchema.safeParse({ email: "no-es-email", contrasena: "x" }).success).toBe(false);
  });

  it("rechaza un NIF con dígito de control erróneo y acepta vacío", () => {
    const base = { empresa: "Mi Empresa", nombre: "Ana", email: "ana@ejemplo.es", contrasena: "1234567890" };
    expect(RegistroSchema.safeParse({ ...base, nif: "B00000001" }).success).toBe(false);
    expect(RegistroSchema.parse({ ...base, nif: "" }).nif).toBeNull();
  });
});

describe("registro", () => {
  it("crea empresa en plan Prueba con 14 días, usuario titular y buzón propio", () => {
    const bd = bdDePrueba();
    const ahora = new Date("2026-10-29T10:00:00Z");
    const { empresaId, usuarioId } = crearEmpresaConTitular(bd, registro("nueva@ejemplo.es", "Bar Ñandú, S.L."), ahora);
    const e = bd.prepare("SELECT * FROM empresas WHERE id = ?").get(empresaId) as { plan_id: string; prueba_hasta: string; buzon: string };
    expect(e.plan_id).toBe("prueba");
    expect(e.prueba_hasta).toBe("2026-11-12T10:00:00Z");
    expect(e.buzon).toMatch(/^bar-nandu-s-l-[0-9a-f]{4}@buzon\.cuentapp\.local$/);
    expect(empresasDeUsuario(bd, usuarioId)).toEqual([{ id: empresaId, nombre: "Bar Ñandú, S.L." }]);
  });

  it("no admite dos cuentas con el mismo email (sin distinguir mayúsculas) y no deja restos", () => {
    const bd = bdDePrueba();
    crearEmpresaConTitular(bd, registro("dup@ejemplo.es"));
    const empresasAntes = (bd.prepare("SELECT count(*) n FROM empresas").get() as { n: number }).n;
    expect(() => crearEmpresaConTitular(bd, registro("DUP@ejemplo.es"))).toThrow(EmailEnUso);
    // La transacción se deshace entera: no queda una empresa huérfana
    expect((bd.prepare("SELECT count(*) n FROM empresas").get() as { n: number }).n).toBe(empresasAntes);
  });
});

describe("sesiones", () => {
  it("el token no se guarda en claro y da acceso a la empresa del usuario", () => {
    const bd = bdDePrueba();
    const { empresaId, usuarioId } = crearEmpresaConTitular(bd, registro("s@ejemplo.es"));
    const { token } = crearSesion(bd, usuarioId, empresaId);
    const filas = bd.prepare("SELECT id FROM sesiones").all() as { id: string }[];
    expect(filas.map((f) => f.id)).toEqual([hashToken(token)]);
    expect(filas[0].id).not.toBe(token);
    expect(leerSesion(bd, token)?.empresa.id).toBe(empresaId);
    expect(leerSesion(bd, token + "x")).toBeNull();
  });

  it("caduca a los 7 días", () => {
    const bd = bdDePrueba();
    const { empresaId, usuarioId } = crearEmpresaConTitular(bd, registro("c@ejemplo.es"));
    const ahora = new Date("2026-10-29T10:00:00Z");
    const { token } = crearSesion(bd, usuarioId, empresaId, ahora);
    expect(leerSesion(bd, token, new Date(ahora.getTime() + DURACION_SESION_MS - 1000))).not.toBeNull();
    expect(leerSesion(bd, token, new Date(ahora.getTime() + DURACION_SESION_MS + 1000))).toBeNull();
  });

  it("al salir, el token deja de valer", () => {
    const bd = bdDePrueba();
    const { empresaId, usuarioId } = crearEmpresaConTitular(bd, registro("x@ejemplo.es"));
    const { token } = crearSesion(bd, usuarioId, empresaId);
    borrarSesion(bd, token);
    expect(leerSesion(bd, token)).toBeNull();
  });

  it("no se puede abrir sesión en una empresa ajena, y quitar la membresía invalida la sesión", () => {
    const bd = bdDePrueba();
    const a = crearEmpresaConTitular(bd, registro("a1@ejemplo.es"));
    const b = crearEmpresaConTitular(bd, registro("b1@ejemplo.es"));
    expect(() => crearSesion(bd, a.usuarioId, b.empresaId)).toThrow();
    const { token } = crearSesion(bd, a.usuarioId, a.empresaId);
    bd.prepare("DELETE FROM membresias WHERE usuario_id = ?").run(a.usuarioId);
    expect(leerSesion(bd, token)).toBeNull();
  });
});

describe("freno a la fuerza bruta", () => {
  it("cuenta los fallos de los últimos 15 minutos y se olvida al acertar", () => {
    const bd = bdDePrueba();
    const ahora = new Date("2026-10-29T10:00:00Z");
    for (let i = 0; i < MAX_INTENTOS; i++) registrarIntentoFallido(bd, "a@x.es", ahora);
    registrarIntentoFallido(bd, "otro@x.es", ahora);
    expect(intentosRecientes(bd, "a@x.es", ahora)).toBe(MAX_INTENTOS);
    expect(intentosRecientes(bd, "a@x.es", new Date(ahora.getTime() + VENTANA_INTENTOS_MS + 1000))).toBe(0);
    olvidarIntentos(bd, "a@x.es");
    expect(intentosRecientes(bd, "a@x.es", ahora)).toBe(0);
    expect(intentosRecientes(bd, "otro@x.es", ahora)).toBe(1);
  });
});
