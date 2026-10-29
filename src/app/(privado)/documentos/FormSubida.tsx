"use client";

// Subida de documentos: foto desde el móvil (RF-02), arrastrar o elegir
// archivos (RF-03). Ideas tomadas del prototipo HTML del equipo.

import { useActionState, useEffect, useRef, useState } from "react";
import { AvisoError, Boton } from "@/componentes/Campo";
import { AVISO } from "@/dominio/legal";
import { EXTENSIONES_ADMITIDAS, MAX_ARCHIVOS_POR_SUBIDA, TEXTO_FORMATOS, type EstadoSubida } from "@/dominio/subida";
import { subirDocumentos } from "./acciones";

export function FormSubida() {
  const [estado, accion, pendiente] = useActionState(subirDocumentos, {} as EstadoSubida);
  const formulario = useRef<HTMLFormElement>(null);
  const selector = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [elegidos, setElegidos] = useState(0);

  // Tras una subida, vaciar el selector para no reenviar lo mismo sin querer
  useEffect(() => {
    if (estado.resultados) formulario.current?.reset();
  }, [estado]);

  /** Archivos soltados encima: se pasan al <input> para que viajen con el formulario. */
  function soltar(e: React.DragEvent) {
    e.preventDefault();
    setEncima(false);
    if (!selector.current || e.dataTransfer.files.length === 0) return;
    selector.current.files = e.dataTransfer.files;
    setElegidos(e.dataTransfer.files.length);
  }

  const contar = (e: React.ChangeEvent<HTMLInputElement>) => setElegidos(e.target.files?.length ?? 0);
  const correctos = estado.resultados?.filter((r) => r.ok).length ?? 0;

  return (
    <form ref={formulario} action={accion} onSubmit={() => setElegidos(0)} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        {/* Arrastrar o elegir archivos (RF-03) */}
        <div
          onDragEnter={(e) => (e.preventDefault(), setEncima(true))}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setEncima(false)}
          onDrop={soltar}
          className={`flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-8 text-center transition-colors ${
            encima ? "border-marron-oscuro bg-lima-2" : "border-black/15 bg-white"
          }`}
        >
          <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-lima text-xl">
            ⬆
          </span>
          <label htmlFor="archivos" className="text-lg font-bold">
            Arrastra aquí tus facturas y tickets
          </label>
          <p id="archivos-ayuda" className="text-sm text-marron">
            o elígelos · {TEXTO_FORMATOS} · hasta {MAX_ARCHIVOS_POR_SUBIDA} archivos de 10 MB
          </p>
          <input
            ref={selector}
            id="archivos"
            name="archivos"
            type="file"
            multiple
            accept={EXTENSIONES_ADMITIDAS}
            aria-describedby="archivos-ayuda"
            onChange={contar}
            className="mt-2 block w-full max-w-sm text-sm file:mr-4 file:rounded-full file:border-0 file:bg-marron-oscuro file:px-4 file:py-2 file:font-semibold file:text-white"
          />
        </div>

        {/* Foto desde el móvil (RF-02): abre directamente la cámara trasera */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-marron-oscuro p-8 text-center text-white">
          <span aria-hidden="true" className="text-3xl">
            📷
          </span>
          <label
            htmlFor="foto"
            className="cursor-pointer rounded-full bg-lima px-5 py-2.5 font-semibold text-marron-oscuro focus-within:ring-4 focus-within:ring-white hover:bg-white"
          >
            Hacer una foto
          </label>
          <input id="foto" name="archivos" type="file" accept="image/*" capture="environment" onChange={contar} className="sr-only" />
          <p className="text-sm opacity-80">En el móvil abre la cámara. Mejor con buena luz y el ticket entero.</p>
        </div>
      </div>

      <p className="text-sm text-marron">{AVISO.subida}</p>

      <div className="flex flex-wrap items-center gap-4">
        <Boton type="submit" pendiente={pendiente}>
          {pendiente ? "Subiendo…" : "Subir"}
        </Boton>
        {elegidos > 0 && !pendiente && (
          <span className="text-sm font-semibold" aria-live="polite">
            {elegidos} {elegidos === 1 ? "archivo elegido" : "archivos elegidos"}
          </span>
        )}
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
