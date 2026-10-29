"use client";

import { useActionState } from "react";
import { AvisoError, Boton, Campo } from "@/componentes/Campo";
import type { EstadoFormulario } from "@/dominio/formularios-acceso";
import { pedirRecuperacion } from "../acciones-recuperar";

export function FormRecuperar() {
  const [estado, accion, pendiente] = useActionState(pedirRecuperacion, {} as EstadoFormulario);
  if (estado.hecho) {
    return (
      <p role="status" className="rounded-lg border-2 border-marron-oscuro bg-crema-2 px-4 py-3 font-semibold">
        <span aria-hidden="true">✔ </span>
        {estado.hecho}
      </p>
    );
  }
  return (
    <form action={accion} noValidate className="flex flex-col gap-5">
      <AvisoError texto={estado.mensaje} />
      <Campo nombre="email" etiqueta="Email de tu cuenta" type="email" autoComplete="email" required defaultValue={estado.valores?.email} error={estado.errores?.email} />
      <Boton type="submit" pendiente={pendiente}>
        {pendiente ? "Enviando…" : "Enviarme un enlace"}
      </Boton>
    </form>
  );
}
