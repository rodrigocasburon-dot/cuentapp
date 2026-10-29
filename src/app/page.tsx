// Portada: qué es Cuentapp, el semáforo y los planes con sus precios (fase 9).

import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionActual } from "@/servidor/auth/sesion";
import { bd } from "@/servidor/bd/conexion";
import { estadoSistema, type EstadoSistema } from "@/servidor/bd/sistema";

export const dynamic = "force-dynamic"; // leer la base de datos en cada visita

function leerEstado(): EstadoSistema | null {
  try {
    return estadoSistema(bd());
  } catch {
    return null; // base de datos sin crear o de otra versión: se explica en pantalla
  }
}

export default async function Inicio() {
  const estado = leerEstado();
  if (estado && (await sesionActual())) redirect("/panel");
  const euros = (c: number) => (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-5xl font-black uppercase tracking-tight">Cuentapp</h1>
      <p className="mt-2 text-lg text-marron">El semáforo del trimestre: tus facturas y tickets, listos para el gestor.</p>

      {estado ? (
        <>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/registro" className="rounded-full bg-marron-oscuro px-6 py-3 font-bold text-crema hover:bg-marron">
              Crear cuenta
            </Link>
            <Link href="/entrar" className="rounded-full border-2 border-marron-oscuro px-6 py-3 font-bold hover:bg-crema-2">
              Entrar
            </Link>
          </div>
          <section className="mt-12" aria-labelledby="como">
            <h2 id="como" className="text-xl font-bold">Cómo funciona</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-6">
              <li>Sube tus facturas y tickets, o reenvíalos a tu buzón de Cuentapp.</li>
              <li>Cuentapp lee los datos en tu propio equipo y te avisa de lo que falta o no cuadra.</li>
              <li>Revisas, validas y descargas el Excel del trimestre para tu gestor.</li>
            </ol>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              <li className="rounded-2xl border-2 border-rojo bg-white p-4">
                <span aria-hidden="true">🔴 </span>
                <strong>Rojo</strong>: hay un duplicado, un documento ilegible o a nombre de otra empresa.
              </li>
              <li className="rounded-2xl border-2 border-arena bg-white p-4">
                <span aria-hidden="true">🟡 </span>
                <strong>Ámbar</strong>: faltan datos o quedan documentos por validar.
              </li>
              <li className="rounded-2xl border-2 border-verde bg-white p-4">
                <span aria-hidden="true">🟢 </span>
                <strong>Verde</strong>: todo validado, listo para el gestor.
              </li>
            </ul>
          </section>

          <section className="mt-12 rounded-2xl bg-crema-2 p-6" aria-labelledby="planes">
            <h2 id="planes" className="text-xl font-bold">Planes</h2>
            <ul className="mt-3 space-y-1">
              {estado.planes.map((p) => (
                <li key={p.id}>
                  <strong>{p.nombre}</strong>:{" "}
                  {!p.disponible
                    ? "próximamente"
                    : p.dias_prueba
                      ? `gratis ${p.dias_prueba} días · ${p.limite_docs_total} documentos`
                      : `${euros(p.precio_centimos)}/mes sin IVA · ${p.limite_docs_mes} documentos/mes`}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="mt-10 rounded-2xl bg-crema-2 p-6">
          <span aria-hidden="true">✖ </span>La base de datos no existe o es de una versión anterior. Ejecuta{" "}
          <code>npm run db:reset</code> y recarga.
        </p>
      )}
    </main>
  );
}
