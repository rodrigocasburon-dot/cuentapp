"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  formatearCentimosAInput,
  parsearImporteACentimos,
  type EstadoFormularioCorreccion,
} from "@/dominio/correccion";
import { CATEGORIAS, ETIQUETA_CATEGORIA } from "@/dominio/categorias";
import { ETIQUETA_TIPO, type Estado, type TipoDocumento, type TipoIncidencia } from "@/dominio/estados";
import { fechaHora } from "@/dominio/formato";
import { CONFIANZA_DUDOSA, type Aviso, type Nivel } from "@/dominio/validaciones";
import {
  corregirDocumentoAction,
  resolverIncidenciaAction,
  validarDocumentoAction,
} from "../acciones";

interface LineaIvaState {
  tipo_iva: number;
  base: string;
  cuota: string;
}

interface PropsIncidencia {
  id: string;
  tipo: TipoIncidencia;
  bloqueante: number;
  estado: "abierta" | "resuelta";
  descripcion: string;
  creada_en: string;
  resuelta_en: string | null;
  motivo_resolucion: string | null;
  documento_referencia_id: string | null;
}

interface PropsCorreccion {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  nombre_usuario?: string;
  creada_en: string;
}

interface FormFichaProps {
  documento: {
    id: string;
    estado: Estado;
    tipo: TipoDocumento | null;
    nif_emisor: string | null;
    nombre_emisor: string | null;
    nif_receptor: string | null;
    numero: string | null;
    fecha_emision: string | null;
    moneda: string | null;
    total_centimos: number | null;
    categoria: string | null;
    total_eur_centimos: number | null;
    tipo_cambio: number | null;
    fecha_cambio: string | null;
    motor_lectura: string | null;
    procesado_en: string | null;
    validado_en: string | null;
    validado_por_nombre?: string | null;
    descartado_en: string | null;
  };
  confianza: Record<string, number>;
  avisos: Aviso[];
  incidencias: PropsIncidencia[];
  lineasIniciales: { tipo_iva: number; base_centimos: number; cuota_centimos: number }[];
  correcciones: PropsCorreccion[];
}

/** Nombre legible de cada campo en el historial de correcciones. */
const NOMBRE_CAMPO: Record<string, string> = {
  tipo: "Tipo",
  nombre_emisor: "Emisor",
  nif_emisor: "NIF del emisor",
  nif_receptor: "NIF del receptor",
  numero: "Número",
  fecha_emision: "Fecha",
  moneda: "Moneda",
  total_centimos: "Total (céntimos)",
  categoria: "Categoría",
  lineas_iva: "Desglose de IVA",
};

const ICONO_NIVEL: Record<Nivel, string> = { rojo: "✖", ambar: "⚠", info: "ℹ" };
const TEXTO_NIVEL: Record<Nivel, string> = { rojo: "Bloquea", ambar: "Revisar", info: "Aviso" };

export function FormFichaDocumento({
  documento,
  confianza,
  avisos,
  incidencias,
  lineasIniciales,
  correcciones,
}: FormFichaProps) {
  const [lineas, setLineas] = useState<LineaIvaState[]>(
    lineasIniciales.length > 0
      ? lineasIniciales.map((l) => ({
          tipo_iva: l.tipo_iva,
          base: formatearCentimosAInput(l.base_centimos),
          cuota: formatearCentimosAInput(l.cuota_centimos),
        }))
      : [{ tipo_iva: 21, base: "", cuota: "" }],
  );

  const [isPendingValidar, startTransitionValidar] = useTransition();
  const [isPendingResolver, startTransitionResolver] = useTransition();
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  const accionCorregirConId = corregirDocumentoAction.bind(null, documento.id);
  const [estadoForm, formAction, isPendingCorregir] = useActionState<EstadoFormularioCorreccion, FormData>(
    accionCorregirConId,
    {},
  );

  const incidenciasBloqueantesAbiertas = incidencias.filter(
    (i) => i.bloqueante === 1 && i.estado === "abierta",
  );
  const puedeValidar =
    !documento.descartado_en &&
    incidenciasBloqueantesAbiertas.length === 0 &&
    documento.estado !== "validado";

  function handleAddLinea() {
    setLineas([...lineas, { tipo_iva: 21, base: "", cuota: "" }]);
  }

  function handleRemoveLinea(index: number) {
    setLineas(lineas.filter((_, i) => i !== index));
  }

  function handleLineaChange(index: number, campo: keyof LineaIvaState, valor: string | number) {
    const copia = [...lineas];
    copia[index] = { ...copia[index], [campo]: valor };
    // Autocalcular cuota sugerida si se cambia la base y el tipo
    if (campo === "base" || campo === "tipo_iva") {
      const tipo = campo === "tipo_iva" ? Number(valor) : copia[index].tipo_iva;
      const baseCent = parsearImporteACentimos(String(campo === "base" ? valor : copia[index].base));
      if (baseCent !== null && !copia[index].cuota) {
        const cuotaCent = Math.round((baseCent * tipo) / 100);
        copia[index].cuota = formatearCentimosAInput(cuotaCent);
      }
    }
    setLineas(copia);
  }

  // Prepara el JSON de líneas de IVA para el campo oculto
  const lineasIvaSerializadas = JSON.stringify(
    lineas
      .map((l) => ({
        tipo_iva: Number(l.tipo_iva),
        base_centimos: parsearImporteACentimos(l.base) ?? 0,
        cuota_centimos: parsearImporteACentimos(l.cuota) ?? 0,
      }))
      .filter((l) => l.base_centimos > 0 || l.cuota_centimos > 0),
  );

  function handleValidar() {
    setErrorValidacion(null);
    startTransitionValidar(async () => {
      const r = await validarDocumentoAction(documento.id);
      if (!r.ok && r.mensaje) setErrorValidacion(r.mensaje);
    });
  }

  function handleResolver(incidenciaId: string, resolucion: "no_duplicado" | "descartado") {
    startTransitionResolver(async () => {
      await resolverIncidenciaAction(incidenciaId, documento.id, resolucion);
    });
  }

  const dudoso = (campo: string) => confianza[campo] !== undefined && confianza[campo] < CONFIANZA_DUDOSA;

  return (
    <div className="space-y-8">
      {/* Estado descartado */}
      {documento.descartado_en && (
        <section
          aria-labelledby="titulo-descartado"
          className="rounded-xl border-2 border-rojo bg-crema-2 p-4 text-rojo"
        >
          <h2 id="titulo-descartado" className="font-bold">
            <span aria-hidden="true">⛔ </span>Documento descartado
          </h2>
          <p className="mt-1 text-sm text-marron-oscuro">
            Este documento fue marcado como descartado el {fechaHora(documento.descartado_en)}. No se contabilizará en el semáforo ni se puede validar.
          </p>
        </section>
      )}

      {/* Incidencias abiertas */}
      {incidencias.length > 0 && (
        <section aria-labelledby="titulo-incidencias" className="rounded-2xl border-2 border-rojo bg-white p-5">
          <h2 id="titulo-incidencias" className="text-xl font-bold text-rojo">
            <span aria-hidden="true">✖ </span>Incidencias ({incidencias.length})
          </h2>
          <ul className="mt-4 space-y-4">
            {incidencias.map((inc) => (
              <li
                key={inc.id}
                className={`rounded-lg border p-3 ${
                  inc.estado === "abierta" ? "border-rojo bg-crema" : "border-crema-2 bg-crema-2 text-marron"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {inc.estado === "abierta" ? "✖ Abierta" : "✔ Resuelta"} · {inc.tipo}
                    {inc.bloqueante === 1 && (
                      <span className="ml-2 rounded-full border border-rojo px-2 py-0.5 text-xs font-bold text-rojo">
                        Bloqueante
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-marron">Creada: {fechaHora(inc.creada_en)}</span>
                </div>
                <p className="mt-2 text-sm text-marron-oscuro">{inc.descripcion}</p>

                {inc.documento_referencia_id && (
                  <p className="mt-2 text-sm">
                    Documento de referencia:{" "}
                    <Link
                      href={`/documentos/${inc.documento_referencia_id}`}
                      className="font-bold underline underline-offset-2"
                    >
                      Ver documento original
                    </Link>
                  </p>
                )}

                {inc.estado === "resuelta" && (
                  <p className="mt-2 text-xs text-marron">
                    Resuelta el {inc.resuelta_en && fechaHora(inc.resuelta_en)}
                    {inc.motivo_resolucion ? ` (${inc.motivo_resolucion})` : ""}.
                  </p>
                )}

                {/* Acciones para incidencias abiertas de duplicado */}
                {inc.estado === "abierta" && inc.tipo === "duplicado" && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={isPendingResolver}
                      onClick={() => handleResolver(inc.id, "no_duplicado")}
                      className="rounded-full border-2 border-marron-oscuro px-4 py-1.5 text-sm font-bold hover:bg-white disabled:opacity-50"
                    >
                      <span aria-hidden="true">✔ </span>No es duplicado
                    </button>
                    <button
                      type="button"
                      disabled={isPendingResolver}
                      onClick={() => handleResolver(inc.id, "descartado")}
                      className="rounded-full bg-rojo px-4 py-1.5 text-sm font-bold text-crema hover:opacity-90 disabled:opacity-50"
                    >
                      <span aria-hidden="true">⛔ </span>Descartar este documento
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Avisos deterministas */}
      {avisos.length > 0 && (
        <section aria-labelledby="titulo-avisos" className="rounded-2xl border-2 border-crema-2 bg-white p-5">
          <h2 id="titulo-avisos" className="text-xl font-bold">
            Avisos de validación ({avisos.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {avisos.map((a, i) => (
              <li
                key={i}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  a.nivel === "rojo"
                    ? "border-rojo text-rojo font-semibold"
                    : a.nivel === "ambar"
                    ? "border-arena text-marron-oscuro"
                    : "border-crema-2 text-marron"
                }`}
              >
                <span className="font-bold">
                  <span aria-hidden="true">{ICONO_NIVEL[a.nivel]} </span>
                  {TEXTO_NIVEL[a.nivel]}:
                </span>{" "}
                {a.texto}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Formulario de corrección manual */}
      <section aria-labelledby="titulo-datos-corregibles" className="rounded-2xl border-2 border-crema-2 bg-white p-5">
        <h2 id="titulo-datos-corregibles" className="text-xl font-bold">
          Datos del documento
        </h2>
        <p className="mt-1 text-sm text-marron">
          Corrige cualquier dato leído o añade información faltante. Cada cambio queda registrado en el historial.
        </p>

        {estadoForm.mensaje && (
          <div
            role="alert"
            className={`mt-4 rounded-lg p-3 text-sm font-semibold ${
              estadoForm.ok ? "border border-verde bg-crema text-marron-oscuro" : "border border-rojo bg-crema text-rojo"
            }`}
          >
            {estadoForm.mensaje}
          </div>
        )}

        <form action={formAction} className="mt-6 space-y-5" noValidate>
          <input type="hidden" name="lineas_iva_json" value={lineasIvaSerializadas} />

          <div className="grid gap-4 sm:grid-cols-2">
          {/* Tipo de documento */}
          <div>
            <label htmlFor="tipo" className="block text-sm font-bold">
              Tipo de documento
              {dudoso("tipo") && (
                <span className="ml-2 rounded-full border border-arena px-2 text-xs font-semibold">? dudoso</span>
              )}
            </label>
            <select
              id="tipo"
              name="tipo"
              defaultValue={documento.tipo ?? "ticket_simplificado"}
              aria-describedby={estadoForm.errores?.tipo ? "tipo-error" : undefined}
              aria-invalid={!!estadoForm.errores?.tipo}
              className="mt-1 w-full max-w-sm rounded-lg border-2 border-crema-2 bg-white px-3 py-2 font-medium"
            >
              <option value="ticket_simplificado">{ETIQUETA_TIPO.ticket_simplificado}</option>
              <option value="factura_completa">{ETIQUETA_TIPO.factura_completa}</option>
            </select>
            {estadoForm.errores?.tipo && (
              <p id="tipo-error" className="mt-1 text-xs text-rojo">
                {estadoForm.errores.tipo}
              </p>
            )}
          </div>

          {/* Categoría del gasto (sugerida por palabras clave, D-56) */}
          <div>
            <label htmlFor="categoria" className="block text-sm font-bold">
              Categoría del gasto
            </label>
            <select
              id="categoria"
              name="categoria"
              defaultValue={documento.categoria ?? ""}
              aria-describedby={estadoForm.errores?.categoria ? "categoria-error categoria-ayuda" : "categoria-ayuda"}
              aria-invalid={!!estadoForm.errores?.categoria}
              className="mt-1 w-full max-w-sm rounded-lg border-2 border-crema-2 bg-white px-3 py-2 font-medium"
            >
              <option value="">Sin categoría</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CATEGORIA[c]}
                </option>
              ))}
            </select>
            <p id="categoria-ayuda" className="mt-1 text-xs text-marron">
              Se propone según el emisor y el texto leído. Cámbiala si no es la correcta.
            </p>
            {estadoForm.errores?.categoria && (
              <p id="categoria-error" className="mt-1 text-xs text-rojo">
                {estadoForm.errores.categoria}
              </p>
            )}
          </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Nombre del emisor */}
            <div>
              <label htmlFor="nombre_emisor" className="block text-sm font-bold">
                Nombre del emisor
                {dudoso("nombre_emisor") && (
                  <span className="ml-2 rounded-full border border-arena px-2 text-xs font-semibold">? dudoso</span>
                )}
              </label>
              <input
                id="nombre_emisor"
                name="nombre_emisor"
                type="text"
                defaultValue={documento.nombre_emisor ?? ""}
                aria-describedby={estadoForm.errores?.nombre_emisor ? "nombre_emisor-error" : undefined}
                aria-invalid={!!estadoForm.errores?.nombre_emisor}
                className="mt-1 w-full rounded-lg border-2 border-crema-2 px-3 py-2"
              />
              {estadoForm.errores?.nombre_emisor && (
                <p id="nombre_emisor-error" className="mt-1 text-xs text-rojo">
                  {estadoForm.errores.nombre_emisor}
                </p>
              )}
            </div>

            {/* NIF del emisor */}
            <div>
              <label htmlFor="nif_emisor" className="block text-sm font-bold">
                NIF del emisor
                {dudoso("nif_emisor") && (
                  <span className="ml-2 rounded-full border border-arena px-2 text-xs font-semibold">? dudoso</span>
                )}
              </label>
              <input
                id="nif_emisor"
                name="nif_emisor"
                type="text"
                defaultValue={documento.nif_emisor ?? ""}
                aria-describedby={estadoForm.errores?.nif_emisor ? "nif_emisor-error" : undefined}
                aria-invalid={!!estadoForm.errores?.nif_emisor}
                className="mt-1 w-full rounded-lg border-2 border-crema-2 px-3 py-2 font-mono"
              />
              {estadoForm.errores?.nif_emisor && (
                <p id="nif_emisor-error" className="mt-1 text-xs text-rojo">
                  {estadoForm.errores.nif_emisor}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* NIF del receptor */}
            <div>
              <label htmlFor="nif_receptor" className="block text-sm font-bold">
                NIF del receptor (tu empresa)
                {dudoso("nif_receptor") && (
                  <span className="ml-2 rounded-full border border-arena px-2 text-xs font-semibold">? dudoso</span>
                )}
              </label>
              <input
                id="nif_receptor"
                name="nif_receptor"
                type="text"
                defaultValue={documento.nif_receptor ?? ""}
                aria-describedby={estadoForm.errores?.nif_receptor ? "nif_receptor-error" : undefined}
                aria-invalid={!!estadoForm.errores?.nif_receptor}
                className="mt-1 w-full rounded-lg border-2 border-crema-2 px-3 py-2 font-mono"
              />
              {estadoForm.errores?.nif_receptor && (
                <p id="nif_receptor-error" className="mt-1 text-xs text-rojo">
                  {estadoForm.errores.nif_receptor}
                </p>
              )}
            </div>

            {/* Número */}
            <div>
              <label htmlFor="numero" className="block text-sm font-bold">
                Número de documento
                {dudoso("numero") && (
                  <span className="ml-2 rounded-full border border-arena px-2 text-xs font-semibold">? dudoso</span>
                )}
              </label>
              <input
                id="numero"
                name="numero"
                type="text"
                defaultValue={documento.numero ?? ""}
                aria-describedby={estadoForm.errores?.numero ? "numero-error" : undefined}
                aria-invalid={!!estadoForm.errores?.numero}
                className="mt-1 w-full rounded-lg border-2 border-crema-2 px-3 py-2 font-mono"
              />
              {estadoForm.errores?.numero && (
                <p id="numero-error" className="mt-1 text-xs text-rojo">
                  {estadoForm.errores.numero}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Fecha de emisión */}
            <div>
              <label htmlFor="fecha_emision" className="block text-sm font-bold">
                Fecha de emisión
                {dudoso("fecha_emision") && (
                  <span className="ml-2 rounded-full border border-arena px-2 text-xs font-semibold">? dudoso</span>
                )}
              </label>
              <input
                id="fecha_emision"
                name="fecha_emision"
                type="date"
                defaultValue={documento.fecha_emision ?? ""}
                aria-describedby={estadoForm.errores?.fecha_emision ? "fecha_emision-error" : undefined}
                aria-invalid={!!estadoForm.errores?.fecha_emision}
                className="mt-1 w-full rounded-lg border-2 border-crema-2 px-3 py-2"
              />
              {estadoForm.errores?.fecha_emision && (
                <p id="fecha_emision-error" className="mt-1 text-xs text-rojo">
                  {estadoForm.errores.fecha_emision}
                </p>
              )}
            </div>

            {/* Moneda */}
            <div>
              <label htmlFor="moneda" className="block text-sm font-bold">
                Moneda
              </label>
              <input
                id="moneda"
                name="moneda"
                type="text"
                maxLength={3}
                defaultValue={documento.moneda ?? "EUR"}
                aria-describedby={estadoForm.errores?.moneda ? "moneda-error" : undefined}
                aria-invalid={!!estadoForm.errores?.moneda}
                className="mt-1 w-full rounded-lg border-2 border-crema-2 px-3 py-2 uppercase font-mono"
              />
              {estadoForm.errores?.moneda && (
                <p id="moneda-error" className="mt-1 text-xs text-rojo">
                  {estadoForm.errores.moneda}
                </p>
              )}
            </div>

            {/* Total */}
            <div>
              <label htmlFor="total" className="block text-sm font-bold">
                Total
                {dudoso("total_centimos") && (
                  <span className="ml-2 rounded-full border border-arena px-2 text-xs font-semibold">? dudoso</span>
                )}
              </label>
              <input
                id="total"
                name="total"
                type="text"
                placeholder="0,00"
                defaultValue={formatearCentimosAInput(documento.total_centimos)}
                aria-describedby={estadoForm.errores?.total ? "total-error" : undefined}
                aria-invalid={!!estadoForm.errores?.total}
                className="mt-1 w-full rounded-lg border-2 border-crema-2 px-3 py-2 font-mono text-right"
              />
              {estadoForm.errores?.total && (
                <p id="total-error" className="mt-1 text-xs text-rojo">
                  {estadoForm.errores.total}
                </p>
              )}
            </div>
          </div>

          {/* Desglose de IVA */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Desglose de líneas de IVA</h3>
              <button
                type="button"
                onClick={handleAddLinea}
                className="rounded-full border border-marron-oscuro px-3 py-1 text-xs font-bold hover:bg-crema-2"
              >
                + Añadir línea
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-marron-oscuro">
                    <th scope="col" className="py-1">Tipo (%)</th>
                    <th scope="col" className="py-1">Base</th>
                    <th scope="col" className="py-1">Cuota</th>
                    <th scope="col" className="py-1 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, idx) => (
                    <tr key={idx} className="border-b border-crema-2">
                      <td className="py-1 pr-2">
                        <select
                          aria-label={`Tipo de IVA de la línea ${idx + 1}`}
                          value={l.tipo_iva}
                          onChange={(e) => handleLineaChange(idx, "tipo_iva", Number(e.target.value))}
                          className="rounded border border-crema-2 bg-white px-2 py-1"
                        >
                          <option value={21}>21 %</option>
                          <option value={10}>10 %</option>
                          <option value={5}>5 %</option>
                          <option value={4}>4 %</option>
                          <option value={0}>0 %</option>
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          aria-label={`Base imponible de la línea ${idx + 1}`}
                          type="text"
                          value={l.base}
                          onChange={(e) => handleLineaChange(idx, "base", e.target.value)}
                          placeholder="0,00"
                          className="w-24 rounded border border-crema-2 px-2 py-1 text-right font-mono"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          aria-label={`Cuota de IVA de la línea ${idx + 1}`}
                          type="text"
                          value={l.cuota}
                          onChange={(e) => handleLineaChange(idx, "cuota", e.target.value)}
                          placeholder="0,00"
                          className="w-24 rounded border border-crema-2 px-2 py-1 text-right font-mono"
                        />
                      </td>
                      <td className="py-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveLinea(idx)}
                          disabled={lineas.length <= 1}
                          aria-label={`Eliminar línea de IVA ${idx + 1}`}
                          className="text-xs text-rojo hover:underline disabled:opacity-30"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isPendingCorregir}
              className="rounded-full bg-marron-oscuro px-6 py-2.5 font-bold text-crema hover:bg-marron disabled:opacity-50"
            >
              {isPendingCorregir ? "Guardando cambios…" : "Guardar correcciones"}
            </button>
          </div>
        </form>
      </section>

      {/* Botón Validar */}
      <section aria-labelledby="titulo-validacion" className="rounded-2xl border-2 border-crema-2 bg-white p-5">
        <h2 id="titulo-validacion" className="text-xl font-bold">
          Validación del documento
        </h2>

        {errorValidacion && (
          <div role="alert" className="mt-3 rounded-lg border border-rojo bg-crema p-3 text-sm text-rojo font-semibold">
            {errorValidacion}
          </div>
        )}

        {documento.estado === "validado" ? (
          <div className="mt-3 flex items-center gap-2 font-bold text-verde">
            <span aria-hidden="true">✔ </span>
            <span>
              Documento validado el {documento.validado_en && fechaHora(documento.validado_en)}
              {documento.validado_por_nombre ? ` por ${documento.validado_por_nombre}` : ""}.
            </span>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-marron">
              La validación es manual. Una vez validado, el documento se considera definitivo para el semáforo y la contabilidad.
            </p>

            {!puedeValidar && (
              <p className="mt-2 text-sm text-rojo font-medium">
                {documento.descartado_en
                  ? "Este documento está descartado y no se puede validar."
                  : "No se puede validar mientras existan incidencias bloqueantes abiertas."}
              </p>
            )}

            <button
              type="button"
              onClick={handleValidar}
              disabled={!puedeValidar || isPendingValidar}
              className="mt-4 rounded-full bg-verde px-6 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPendingValidar ? "Validando…" : "Validar documento"}
            </button>
          </div>
        )}
      </section>

      {/* Historial de correcciones */}
      {correcciones.length > 0 && (
        <section aria-labelledby="titulo-historial" className="rounded-2xl border-2 border-crema-2 bg-white p-5">
          <h2 id="titulo-historial" className="text-xl font-bold">
            Historial de correcciones ({correcciones.length})
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-marron-oscuro">
                  <th scope="col" className="py-1">Campo</th>
                  <th scope="col" className="py-1">Valor anterior</th>
                  <th scope="col" className="py-1">Valor nuevo</th>
                  <th scope="col" className="py-1">Usuario</th>
                  <th scope="col" className="py-1">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {correcciones.map((c) => (
                  <tr key={c.id} className="border-b border-crema-2">
                    <td className="py-1 font-semibold">{NOMBRE_CAMPO[c.campo] ?? c.campo}</td>
                    <td className="py-1 text-marron font-mono text-xs max-w-[12rem] truncate">
                      {c.valor_anterior ?? "—"}
                    </td>
                    <td className="py-1 font-mono text-xs max-w-[12rem] truncate">{c.valor_nuevo ?? "—"}</td>
                    <td className="py-1">{c.nombre_usuario ?? "Usuario"}</td>
                    <td className="py-1 text-marron">{fechaHora(c.creada_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
