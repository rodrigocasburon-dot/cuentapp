"use client";

import { useActionState, useEffect, useRef } from "react";
import { AvisoError, Boton } from "@/componentes/Campo";
import { EXTENSIONES_ADMITIDAS, MAX_ARCHIVOS_POR_SUBIDA, TEXTO_FORMATOS, type EstadoSubida } from "@/dominio/subida";
import { subirDocumentos } from "./acciones";

export function FormSubida() {
  const [estado, accion, pendiente] = useActionState(subirDocumentos, {} as EstadoSubida);
  const formulario = useRef<HTMLFormElement>(null);

  // Tras una subida, vaciar el selector para no reenviar lo mismo sin querer
  useEffect(() => {
    if (estado.resultados) formulario.current?.reset();
  }, [estado]);

  const correctos = estado.resultados?.filter((r) => r.ok).length ?? 0;
  return (
    <form ref={formulario} action={accion} className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-marron bg-white/60 p-6">
      <div className="flex flex-col gap-1">
        <label htmlFor="archivos" className="text-lg font-bold">
          Subir facturas y tickets
        </label>
        <p id="archivos-ayuda" className="text-sm text-marron">
          {TEXTO_FORMATOS}. Hasta {MAX_ARCHIVOS_POR_SUBIDA} archivos de 10 MB cada vez. Guardamos el original sin tocarlo.
        </p>
        <input
          id="archivos"
          name="archivos"
          type="file"
          multiple
          accept={EXTENSIONES_ADMITIDAS}
          aria-describedby="archivos-ayuda"
          className="mt-2 block w-full text-sm file:mr-4 file:rounded-full file:border-2 file:border-marron-oscuro file:bg-crema file:px-4 file:py-2 file:font-semibold"
        />
      </div>
      <div>
        <Boton type="submit" pendiente={pendiente}>
          {pendiente ? "Subiendo…" : "Subir"}
        </Boton>
      </div>

      <AvisoError texto={estado.mensaje} />
      {estado.resultados && (
        <div role="status" aria-live="polite">
          <p className="font-semibold">
            {correctos} de {estado.resultados.length} {estado.resultados.length === 1 ? "archivo recibido" : "archivos recibidos"}.
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
