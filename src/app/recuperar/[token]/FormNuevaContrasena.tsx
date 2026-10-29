"use client";

import { useActionState } from "react";
import { AvisoError, Boton, Campo } from "@/componentes/Campo";
import type { EstadoFormulario } from "@/dominio/formularios-acceso";
import { restablecerContrasena } from "../../acciones-recuperar";

export function FormNuevaContrasena({ token }: { token: string }) {
  const [estado, accion, pendiente] = useActionState(restablecerContrasena.bind(null, token), {} as EstadoFormulario);
  const e = estado.errores ?? {};
  return (
    <form action={accion} noValidate className="flex flex-col gap-5">
      <AvisoError texto={estado.mensaje} />
      <Campo nombre="contrasena" etiqueta="Contraseña nueva" type="password" autoComplete="new-password" required ayuda="Al menos 10 caracteres." error={e.contrasena} />
      <Campo nombre="repetir" etiqueta="Repite la contraseña" type="password" autoComplete="new-password" required error={e.repetir} />
      <Boton type="submit" pendiente={pendiente}>
        {pendiente ? "Guardando…" : "Guardar la contraseña"}
      </Boton>
    </form>
  );
}
