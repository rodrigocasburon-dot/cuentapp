"use client";

import { useActionState } from "react";
import { AvisoError, Boton, Campo } from "@/componentes/Campo";
import type { EstadoFormulario } from "@/dominio/formularios-acceso";
import { darmeDeBaja, guardarDatosCuenta } from "./acciones";

export function FormDatos({ inicial }: { inicial: Record<string, string> }) {
  const [estado, accion, pendiente] = useActionState(guardarDatosCuenta, { valores: inicial } as EstadoFormulario);
  const v = estado.valores ?? inicial;
  const e = estado.errores ?? {};
  return (
    <form action={accion} noValidate className="flex flex-col gap-5">
      <AvisoError texto={estado.mensaje} />
      {estado.hecho && (
        <p role="status" className="rounded-lg border-2 border-marron-oscuro bg-crema-2 px-4 py-3 font-semibold">
          <span aria-hidden="true">✔ </span>
          {estado.hecho}
        </p>
      )}
      <Campo nombre="empresa" etiqueta="Nombre de la empresa" autoComplete="organization" required defaultValue={v.empresa} error={e.empresa} />
      <Campo
        nombre="nif"
        etiqueta="NIF/CIF de la empresa (opcional)"
        ayuda="Se usa para comprobar que los documentos van a tu nombre. Los ya leídos no se vuelven a comprobar."
        defaultValue={v.nif}
        error={e.nif}
      />
      <Campo nombre="nombre" etiqueta="Tu nombre" autoComplete="name" required defaultValue={v.nombre} error={e.nombre} />
      <Boton type="submit" pendiente={pendiente}>
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </Boton>
    </form>
  );
}

export function FormBaja() {
  const [estado, accion, pendiente] = useActionState(darmeDeBaja, {} as EstadoFormulario);
  const error = estado.errores?.confirmo;
  return (
    <form action={accion} noValidate className="flex flex-col gap-4">
      <AvisoError texto={estado.mensaje} />
      <div className="flex items-start gap-3">
        <input
          id="confirmo"
          name="confirmo"
          type="checkbox"
          value="si"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "confirmo-error" : undefined}
          className="mt-1 h-5 w-5 accent-rojo"
        />
        <label htmlFor="confirmo">
          Entiendo que no podré volver a entrar con esta cuenta. Los documentos no se borran: se conservan por obligación legal.
        </label>
      </div>
      {error && (
        <p id="confirmo-error" className="text-sm font-semibold text-rojo">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded-full bg-rojo px-6 py-3 font-bold text-crema hover:opacity-90 disabled:opacity-60"
      >
        {pendiente ? "Dando de baja…" : "Dar de baja la cuenta"}
      </button>
    </form>
  );
}
