"use client";

import { useActionState, useEffect, useRef } from "react";
import { AvisoError, Boton, Campo } from "@/componentes/Campo";
import { EXTENSIONES_ADMITIDAS, MAX_ARCHIVOS_POR_SUBIDA, TEXTO_FORMATOS, type EstadoSubida } from "@/dominio/subida";
import { simularCorreo } from "./acciones";

export function FormCorreo({ para }: { para: string }) {
  const [estado, accion, pendiente] = useActionState(simularCorreo, {} as EstadoSubida);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.resultados) formulario.current?.reset();
  }, [estado]);

  const correctos = estado.resultados?.filter((r) => r.ok).length ?? 0;
  return (
    <form ref={formulario} action={accion} className="flex flex-col gap-4">
      <p>
        <span className="font-semibold">Para:</span> <span className="font-mono">{para}</span>
      </p>
      <Campo nombre="de" etiqueta="De" type="email" placeholder="proveedor@ejemplo.com" autoComplete="off" />
      <Campo nombre="asunto" etiqueta="Asunto" placeholder="Factura de octubre" autoComplete="off" />
      <div className="flex flex-col gap-1">
        <label htmlFor="adjuntos" className="font-semibold">
          Adjuntos
        </label>
        <p id="adjuntos-ayuda" className="text-sm text-marron">
          {TEXTO_FORMATOS}. Hasta {MAX_ARCHIVOS_POR_SUBIDA} adjuntos de 10 MB.
        </p>
        <input
          id="adjuntos"
          name="adjuntos"
          type="file"
          multiple
          accept={EXTENSIONES_ADMITIDAS}
          aria-describedby="adjuntos-ayuda"
          className="block w-full text-sm file:mr-4 file:rounded-full file:border-2 file:border-marron-oscuro file:bg-crema file:px-4 file:py-2 file:font-semibold"
        />
      </div>
      <div>
        <Boton type="submit" pendiente={pendiente}>
          {pendiente ? "Enviando…" : "Simular la llegada del correo"}
        </Boton>
      </div>
      <AvisoError texto={estado.mensaje} />
      {estado.resultados && (
        <div role="status" aria-live="polite">
          <p className="font-semibold">
            {correctos} de {estado.resultados.length} adjuntos recibidos.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {estado.resultados.map((r, i) => (
              <li key={i} className={r.ok ? "" : "font-semibold text-rojo"}>
                <span aria-hidden="true">{r.ok ? "✔ " : "✖ "}</span>
                {r.nombre}: {r.ok ? (r.duplicadoDe ? `recibido (es idéntico a «${r.duplicadoDe}»)` : "recibido") : r.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
