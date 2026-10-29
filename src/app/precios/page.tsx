// Página de precios (RFQ, «Modelo de negocio y tarifas»: «las tarifas tienen
// que aparecer en la web, en una página de precios»). Los importes salen de la
// tabla «planes»; aquí solo se presentan. Justificación de precios: D-55.

import type { Metadata } from "next";
import Link from "next/link";
import { euros, TarjetasPlanes } from "@/componentes/TarjetasPlanes";
import { AVISO } from "@/dominio/legal";
import { bd } from "@/servidor/bd/conexion";
import { estadoSistema, type EstadoSistema } from "@/servidor/bd/sistema";

export const metadata: Metadata = { title: "Precios · Cuentapp" };
export const dynamic = "force-dynamic";

function leerPlanes(): EstadoSistema["planes"] | null {
  try {
    return estadoSistema(bd()).planes;
  } catch {
    return null; // base de datos sin crear: se explica en pantalla
  }
}

/** Lo que incluye cualquier plan contratable: hoy las funciones son las mismas en todos. */
const FUNCIONES = [
  "Lectura automática de fecha, emisor, NIF, número, IVA, total y categoría",
  "Corrección con el original al lado y validación manual",
  "Aviso de duplicados y de datos que faltan",
  "Semáforo del trimestre",
  "Excel del trimestre para el gestor",
  "Buzón propio para reenviar facturas por correo",
  "Instalar como app y compartir desde el móvil (Android)",
  "Copia ordenada de los originales",
];

const PREGUNTAS: [string, string][] = [
  ["¿Hay prueba gratis?", "Sí: 14 días y hasta 30 documentos, sin tarjeta. Al terminar no se cobra nada: eliges un plan si quieres seguir."],
  ["¿Qué cuenta como un documento?", "Cada factura o ticket que entra en Cuentapp, por cualquier vía (subida, foto, correo o compartir). Si luego lo mueves a la papelera, sigue contando en el mes en que entró."],
  ["¿Qué pasa si llego al límite del mes?", "No puedes subir más hasta el mes siguiente o hasta cambiar a un plan mayor. Todo lo que ya tienes sigue disponible: consultar, corregir, validar y exportar no tiene límite."],
  ["¿Puedo cambiar de plan o darme de baja?", "Sí, cuando quieras, desde «Mi cuenta». La renovación es mensual hasta que canceles."],
  ["¿Los precios llevan IVA?", `No: se muestran sin IVA, que se añade en la factura. ${AVISO.precioProvisional}`],
];

export default function Precios() {
  const planes = leerPlanes();
  const contratables = planes?.filter((p) => p.disponible) ?? [];

  return (
    <div>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-marron-oscuro text-base">
            🚦
          </span>
          Cuentapp
        </Link>
        <nav aria-label="Precios" className="flex items-center gap-2 text-sm font-semibold sm:gap-4">
          <Link href="/entrar" className="rounded-full px-3 py-1.5 hover:bg-crema-2">Entrar</Link>
          <Link href="/registro" className="whitespace-nowrap rounded-full bg-marron-oscuro px-5 py-2.5 text-white hover:bg-black">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
        <h1 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl">Precios</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-marron">
          Pagas por empresa y por número de documentos al mes, no por usuario. Todas las funciones están en todos los planes.
        </p>

        {!planes ? (
          <p role="alert" className="mt-10 rounded-lg border-2 border-rojo bg-white px-4 py-3 font-semibold text-rojo">
            <span aria-hidden="true">⚠ </span>No se pueden leer los planes: falta crear la base de datos (npm run db:reset).
          </p>
        ) : (
          <>
            <TarjetasPlanes planes={planes} />

            <section aria-labelledby="comparar" className="mt-16">
              <h2 id="comparar" className="text-2xl font-extrabold tracking-tight">
                Comparar planes
              </h2>
              <div className="mt-6 overflow-x-auto rounded-3xl border border-black/5 bg-white">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Qué incluye cada plan</caption>
                  <thead>
                    <tr className="border-b-2 border-marron-oscuro">
                      <th scope="col" className="p-4">Función</th>
                      {contratables.map((p) => (
                        <th key={p.id} scope="col" className="p-4 text-center">
                          {p.nombre}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-crema-2">
                      <th scope="row" className="p-4 font-semibold">Precio al mes (sin IVA)</th>
                      {contratables.map((p) => (
                        <td key={p.id} className="p-4 text-center font-bold">
                          {p.dias_prueba ? `Gratis ${p.dias_prueba} días` : euros(p.precio_centimos)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-crema-2">
                      <th scope="row" className="p-4 font-semibold">Documentos</th>
                      {contratables.map((p) => (
                        <td key={p.id} className="p-4 text-center">
                          {p.limite_docs_total ? `${p.limite_docs_total} en total` : `${p.limite_docs_mes} al mes`}
                        </td>
                      ))}
                    </tr>
                    {FUNCIONES.map((f) => (
                      <tr key={f} className="border-b border-crema-2 last:border-0">
                        <th scope="row" className="p-4 font-normal">{f}</th>
                        {contratables.map((p) => (
                          <td key={p.id} className="p-4 text-center">
                            <span aria-hidden="true">✔ </span>Sí
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-marron">
                El plan Despacho, para gestorías que llevan varias empresas, llegará más adelante.
              </p>
            </section>
          </>
        )}

        <section aria-labelledby="preguntas" className="mt-16">
          <h2 id="preguntas" className="text-2xl font-extrabold tracking-tight">
            Preguntas frecuentes
          </h2>
          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            {PREGUNTAS.map(([p, r]) => (
              <div key={p} className="rounded-3xl border border-black/5 bg-white p-6">
                <dt className="font-bold">{p}</dt>
                <dd className="mt-2 text-sm text-marron">{r}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
