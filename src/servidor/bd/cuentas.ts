// Cuentas, sesiones e intentos de acceso (RF-01).
//
// Estas consultas NO van filtradas por empresa porque sirven precisamente
// para averiguar a qué empresa pertenece quien entra. A partir de la sesión,
// todo lo demás pasa por repositorioDeEmpresa().

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Bd } from "./conexion";

export const DIAS_PRUEBA = 14;
export const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
export const MAX_INTENTOS = 5;
export const VENTANA_INTENTOS_MS = 15 * 60 * 1000; // 15 minutos

/** Fecha ISO sin milisegundos, el mismo formato que usa SQLite en el esquema. */
export function iso(fecha: Date): string {
  return fecha.toISOString().slice(0, 19) + "Z";
}

/** Lo que guardamos de un token de sesión: su SHA-256, nunca el token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class EmailEnUso extends Error {
  constructor() {
    super("Ya existe una cuenta con ese email");
  }
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

export interface DatosRegistro {
  empresa: string;
  nif: string | null;
  nombre: string;
  email: string;            // ya normalizado (minúsculas, sin espacios)
  hashContrasena: string;
}

/** Dirección del buzón simulado: "panaderia-ejemplo-sl-3f9a@buzon.cuentapp.local". */
function direccionBuzon(empresa: string): string {
  const base = empresa
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `${base || "empresa"}-${randomBytes(2).toString("hex")}@buzon.cuentapp.local`;
}

/** Crea empresa (plan Prueba), usuario titular y su membresía, todo o nada. */
export function crearEmpresaConTitular(bd: Bd, d: DatosRegistro, ahora = new Date()): { empresaId: string; usuarioId: string } {
  const empresaId = randomUUID();
  const usuarioId = randomUUID();
  const pruebaHasta = iso(new Date(ahora.getTime() + DIAS_PRUEBA * 24 * 60 * 60 * 1000));

  const transaccion = bd.transaction(() => {
    bd.prepare("INSERT INTO empresas (id, nombre, nif, plan_id, prueba_hasta, buzon) VALUES (?, ?, ?, 'prueba', ?, ?)").run(
      empresaId, d.empresa, d.nif, pruebaHasta, direccionBuzon(d.empresa),
    );
    bd.prepare("INSERT INTO usuarios (id, email, hash_contrasena, nombre) VALUES (?, ?, ?, ?)").run(usuarioId, d.email, d.hashContrasena, d.nombre);
    bd.prepare("INSERT INTO membresias (usuario_id, empresa_id, rol) VALUES (?, ?, 'titular')").run(usuarioId, empresaId);
  });

  try {
    transaccion();
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint failed: usuarios\.email/.test(e.message)) throw new EmailEnUso();
    throw e;
  }
  return { empresaId, usuarioId };
}

// ---------------------------------------------------------------------------
// Inicio de sesión
// ---------------------------------------------------------------------------

export function buscarCredenciales(bd: Bd, email: string): { id: string; hash_contrasena: string } | undefined {
  return bd.prepare("SELECT id, hash_contrasena FROM usuarios WHERE email = ?").get(email) as
    | { id: string; hash_contrasena: string }
    | undefined;
}

/** Empresas a las que pertenece el usuario (en el MVP, una). */
export function empresasDeUsuario(bd: Bd, usuarioId: string): { id: string; nombre: string }[] {
  return bd
    .prepare("SELECT e.id, e.nombre FROM membresias m JOIN empresas e ON e.id = m.empresa_id WHERE m.usuario_id = ? ORDER BY e.creada_en")
    .all(usuarioId) as { id: string; nombre: string }[];
}

/** Crea una sesión y devuelve el token EN CLARO (solo existe en la cookie). */
export function crearSesion(bd: Bd, usuarioId: string, empresaId: string, ahora = new Date()): { token: string; expira: Date } {
  const miembro = bd.prepare("SELECT 1 FROM membresias WHERE usuario_id = ? AND empresa_id = ?").get(usuarioId, empresaId);
  if (!miembro) throw new Error("El usuario no pertenece a esa empresa");
  const token = randomBytes(32).toString("base64url"); // 256 bits aleatorios
  const expira = new Date(ahora.getTime() + DURACION_SESION_MS);
  bd.prepare("INSERT INTO sesiones (id, usuario_id, empresa_id, expira_en) VALUES (?, ?, ?, ?)").run(hashToken(token), usuarioId, empresaId, iso(expira));
  return { token, expira };
}

export interface Sesion {
  usuario: { id: string; nombre: string; email: string };
  empresa: { id: string; nombre: string; nif: string | null; plan_id: string; prueba_hasta: string | null; buzon: string };
  expira_en: string;
}

/** Devuelve la sesión si el token es válido, no ha caducado y la membresía sigue existiendo. */
export function leerSesion(bd: Bd, token: string, ahora = new Date()): Sesion | null {
  const fila = bd
    .prepare(
      `SELECT s.expira_en,
              u.id AS u_id, u.nombre AS u_nombre, u.email AS u_email,
              e.id AS e_id, e.nombre AS e_nombre, e.nif AS e_nif, e.plan_id AS e_plan, e.prueba_hasta AS e_prueba, e.buzon AS e_buzon
         FROM sesiones s
         JOIN membresias m ON m.usuario_id = s.usuario_id AND m.empresa_id = s.empresa_id
         JOIN usuarios u   ON u.id = s.usuario_id
         JOIN empresas e   ON e.id = s.empresa_id
        WHERE s.id = ? AND s.expira_en > ?`,
    )
    .get(hashToken(token), iso(ahora)) as Record<string, string | null> | undefined;
  if (!fila) return null;
  return {
    usuario: { id: fila.u_id!, nombre: fila.u_nombre!, email: fila.u_email! },
    empresa: { id: fila.e_id!, nombre: fila.e_nombre!, nif: fila.e_nif, plan_id: fila.e_plan!, prueba_hasta: fila.e_prueba, buzon: fila.e_buzon! },
    expira_en: fila.expira_en!,
  };
}

export function borrarSesion(bd: Bd, token: string): void {
  bd.prepare("DELETE FROM sesiones WHERE id = ?").run(hashToken(token));
}

export function borrarSesionesCaducadas(bd: Bd, ahora = new Date()): void {
  bd.prepare("DELETE FROM sesiones WHERE expira_en <= ?").run(iso(ahora));
}

// ---------------------------------------------------------------------------
// Freno a la fuerza bruta
// ---------------------------------------------------------------------------

export function intentosRecientes(bd: Bd, clave: string, ahora = new Date()): number {
  const desde = iso(new Date(ahora.getTime() - VENTANA_INTENTOS_MS));
  return (bd.prepare("SELECT count(*) AS n FROM intentos_acceso WHERE clave = ? AND creado_en > ?").get(clave, desde) as { n: number }).n;
}

export function registrarIntentoFallido(bd: Bd, clave: string, ahora = new Date()): void {
  bd.prepare("INSERT INTO intentos_acceso (clave, creado_en) VALUES (?, ?)").run(clave, iso(ahora));
}

export function olvidarIntentos(bd: Bd, clave: string): void {
  bd.prepare("DELETE FROM intentos_acceso WHERE clave = ?").run(clave);
}
