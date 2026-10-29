import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { EstadoDocumento } from "@/componentes/EstadoDocumento";
import { Refresco } from "@/componentes/Refresco";
import { fecha, fechaHora, importe } from "@/dominio/formato";
import type { Aviso } from "@/dominio/validaciones";
import { repositorioActual } from "@/servidor/auth/sesion";
import { lanzarCola } from "@/servidor/lectura/cola";
import { accionEnBloque } from "./acciones";
import { FormSubida } from "./FormSubida";

export const metadata: Metadata = { title: "Documentos · Cuentapp" };

/** Datos que faltan, a partir de los avisos «falta_…» de validar(). */
const FALTA: Record<string, string> = {
  falta_numero: "número",
  falta_nombre_emisor: "emisor",
  falta_nif_emisor: "NIF del emisor",
  falta_nif_receptor: "tu NIF",
  falta_fecha: "fecha",
  falta_total: "total",
  falta_desglose_iva: "desglose de IVA",
};

function faltan(avisosJson: string | null): string[] {
  const avisos: Aviso[] = avisosJson ? JSON.parse(avisosJson) : [];
  return avisos.flatMap((a) => (FALTA[a.codigo] ? [FALTA[a.codigo]] : []));
}

const VERBO: Record<string, string> = { validar: "validado", papelera: "movido a la papelera", recuperar: "recuperado" };

/** Mensaje tras una acción sobre varios documentos (?accion=…&hechos=…&total=…). */
function resultado(p: Record<string, string | undefined>): string | null {
  const verbo = p.accion && VERBO[p.accion];
  if (!verbo) return null;
  const hechos = Number(p.hechos) || 0;
  const total = Number(p.total) || 0;
  const texto = `${hechos} de ${total} ${total === 1 ? "documento" : "documentos"} ${verbo}${hechos === 1 ? "" : "s"}.`;
  return hechos < total && p.accion === "validar" ? `${texto} Los demás tienen incidencias bloqueantes o ya estaban validados.` : texto;
}

export default async function Documentos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { repo } = await repositorioActual();
  const p = await searchParams;
  const papelera = p.ver === "papelera";
  const documentos = repo.listarDocumentos({ papelera });
  const enPapelera = papelera ? documentos.length : repo.listarDocumentos({ papelera: true }).length;
  const leyendo = documentos.some((d) => d.estado === "recibido" || d.estado === "procesando");
  // Si quedan pendientes (p. ej. tras reiniciar el servidor), retomar la cola
  if (documentos.some((d) => d.estado === "recibido")) after(lanzarCola);
  const mensaje = resultado(p);
  const incidencias = repo.incidenciasAbiertasPorDocumento();

  const pestana = (activa: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-bold ${activa ? "bg-marron-oscuro text-crema" : "border border-marron-oscuro hover:bg-crema-2"}`;
  const boton = "rounded-full border-2 border-marron-oscuro px-4 py-1.5 text-sm font-bold hover:bg-crema-2";

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Refresco activo={leyendo} />
      <h1 className="mb-6 text-4xl font-black uppercase tracking-tight">Documentos</h1>
      {!papelera && <FormSubida />}

      <section className="mt-10" aria-labelledby="lista">
        <nav aria-label="Vista de documentos" className="mb-4 flex flex-wrap gap-2">
          <Link href="/documentos" className={pestana(!papelera)} aria-current={!papelera ? "page" : undefined}>
            Activos
          </Link>
          <Link href="/documentos?ver=papelera" className={pestana(papelera)} aria-current={papelera ? "page" : undefined}>
            <span aria-hidden="true">🗑 </span>Papelera ({enPapelera})
          </Link>
        </nav>

        <h2 id="lista" className="mb-3 text-xl font-bold">
          {papelera ? "En la papelera" : "Recibidos"} ({documentos.length})
        </h2>
        {papelera && (
          <p className="mb-3 text-sm text-marron">
            No cuentan en el semáforo ni en el Excel. El original se conserva y puedes recuperarlos cuando quieras.
          </p>
        )}
        {mensaje && (
          <p role="status" className="mb-3 rounded-lg border-2 border-marron-oscuro bg-crema-2 px-4 py-2 font-semibold">
            <span aria-hidden="true">✔ </span>
            {mensaje}
          </p>
        )}
        {leyendo && (
          <p className="mb-3 text-marron" role="status">
            <span aria-hidden="true">⟳ </span>Leyendo documentos… la lista se actualiza sola.
          </p>
        )}
        {documentos.length === 0 ? (
          <p className="text-marron">
            {papelera ? "La papelera está vacía." : "Todavía no hay documentos. Sube el primero con el formulario de arriba."}
          </p>
        ) : (
          <form action={accionEnBloque}>
            <fieldset className="mb-3 flex flex-wrap items-center gap-3">
              <legend className="sr-only">Acciones sobre los documentos marcados</legend>
              <span className="text-sm font-semibold">Con los marcados:</span>
              {papelera ? (
                <button type="submit" name="accion" value="recuperar" className={boton}>
                  <span aria-hidden="true">↩ </span>Recuperar
                </button>
              ) : (
                <>
                  <button type="submit" name="accion" value="validar" className={boton}>
                    <span aria-hidden="true">✔ </span>Validar
                  </button>
                  <button type="submit" name="accion" value="papelera" className={boton}>
                    <span aria-hidden="true">🗑 </span>Mover a la papelera
                  </button>
                </>
              )}
            </fieldset>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-marron-oscuro">
                    <th scope="col" className="py-2 pr-2">
                      <span className="sr-only">Marcar</span>
                    </th>
                    <th scope="col" className="py-2 pr-4">Documento</th>
                    <th scope="col" className="py-2 pr-4">Emisor</th>
                    <th scope="col" className="py-2 pr-4">Fecha</th>
                    <th scope="col" className="py-2 pr-4 text-right">Total</th>
                    <th scope="col" className="py-2 pr-4">Estado</th>
                    <th scope="col" className="py-2">A revisar</th>
                  </tr>
                </thead>
                <tbody>
                  {documentos.map((d) => (
                    <tr key={d.id} className="border-b border-crema-2 align-top">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          name="ids"
                          value={d.id}
                          aria-label={`Marcar ${d.nombre_original}`}
                          className="mt-1 h-5 w-5 accent-marron-oscuro"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <Link href={`/documentos/${d.id}`} className="font-semibold underline underline-offset-4">
                          {d.nombre_original}
                        </Link>
                        <span className="block text-sm text-marron">Recibido {fechaHora(d.creado_en)}</span>
                      </td>
                      <td className="py-2 pr-4">{d.nombre_emisor ?? "—"}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{d.fecha_emision ? fecha(d.fecha_emision) : "—"}</td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap">
                        {d.total_centimos !== null ? importe(d.total_centimos, d.moneda ?? "EUR") : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <EstadoDocumento estado={d.estado} />
                      </td>
                      <td className="py-2 text-sm">
                        {incidencias.get(d.id)?.includes("duplicado") && (
                          <span className="block font-semibold text-rojo">
                            <span aria-hidden="true">⧉ </span>Posible duplicado
                          </span>
                        )}
                        {faltan(d.avisos_json).length > 0 && (
                          <span className="block">
                            <span aria-hidden="true">⚠ </span>Falta: {faltan(d.avisos_json).join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
