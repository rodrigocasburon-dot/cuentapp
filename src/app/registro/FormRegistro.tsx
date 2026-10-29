"use client";

import { useActionState } from "react";
import { AvisoError, Boton, Campo } from "@/componentes/Campo";
import type { EstadoFormulario } from "@/dominio/formularios-acceso";
import { registrar } from "../acciones-acceso";

export function FormRegistro() {
  const [estado, accion, pendiente] = useActionState(registrar, {} as EstadoFormulario);
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};
  return (
    <form action={accion} noValidate className="flex flex-col gap-5">
      <AvisoError texto={estado.mensaje} />
      <Campo nombre="empresa" etiqueta="Nombre de la empresa" autoComplete="organization" required defaultValue={v.empresa} error={e.empresa} />
      <Campo nombre="nif" etiqueta="NIF/CIF de la empresa (opcional)" ayuda="Lo usaremos para comprobar que las facturas van a tu nombre." defaultValue={v.nif} error={e.nif} />
      <Campo nombre="nombre" etiqueta="Tu nombre" autoComplete="name" required defaultValue={v.nombre} error={e.nombre} />
      <Campo nombre="email" etiqueta="Email" type="email" autoComplete="email" required defaultValue={v.email} error={e.email} />
      <Campo nombre="contrasena" etiqueta="Contraseña" type="password" autoComplete="new-password" required minLength={10} ayuda="Mínimo 10 caracteres." error={e.contrasena} />
      <Boton type="submit" pendiente={pendiente}>
        {pendiente ? "Creando la cuenta…" : "Crear cuenta y empezar la prueba"}
      </Boton>
    </form>
  );
}
