"use client";

import { useActionState } from "react";
import { AvisoError, Boton, Campo } from "@/componentes/Campo";
import type { EstadoFormulario } from "@/dominio/formularios-acceso";
import { entrar } from "../acciones-acceso";

export function FormEntrar() {
  const [estado, accion, pendiente] = useActionState(entrar, {} as EstadoFormulario);
  const e = estado.errores ?? {};
  return (
    <form action={accion} noValidate className="flex flex-col gap-5">
      <AvisoError texto={estado.mensaje} />
      <Campo nombre="email" etiqueta="Email" type="email" autoComplete="email" required defaultValue={estado.valores?.email} error={e.email} />
      <Campo nombre="contrasena" etiqueta="Contraseña" type="password" autoComplete="current-password" required error={e.contrasena} />
      <Boton type="submit" pendiente={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}
