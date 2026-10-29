// Portada: qué es Cuentapp, el semáforo y los planes (fase 9).
// Estética «fintech» clara: titular grande, halo lima, botones en píldora y
// una maqueta del móvil rodeada de tarjetas. La maqueta es ilustrativa
// (datos inventados) y se oculta a los lectores de pantalla.

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

const euros = (c: number) => (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const pildoraOscura = "rounded-full bg-marron-oscuro px-6 py-3 font-semibold text-white shadow-lg shadow-black/10 hover:bg-black focus:outline-none focus-visible:ring-4 focus-visible:ring-lima";
const pildoraClara = "rounded-full border border-black/10 bg-white px-6 py-3 font-semibold hover:bg-crema-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-lima";

/** Maqueta del móvil y tarjetas flotantes (decorativa). */
function Maqueta() {
  const filas = [
    { nombre: "Supermercado", importe: "26,63 €", estado: "✔ Validado", clase: "bg-green-100 text-green-900" },
    { nombre: "Gasolinera", importe: "58,10 €", estado: "? Revisar", clase: "bg-amber-100 text-amber-900" },
    { nombre: "Software Inc.", importe: "43,04 €", estado: "✔ Validado", clase: "bg-green-100 text-green-900" },
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto mt-16 h-[30rem] w-full max-w-5xl">
      {/* Tarjeta izquierda: semáforo */}
      <div className="absolute left-0 top-16 hidden w-64 -rotate-6 rounded-3xl border border-black/5 bg-white/90 p-5 shadow-2xl shadow-black/10 backdrop-blur md:block">
        <p className="text-lg font-bold">Semáforo 3T</p>
        <p className="text-xs text-marron">Julio – septiembre</p>
        <div className="mx-auto mt-4 flex w-16 flex-col items-center gap-2 rounded-full bg-marron-oscuro py-3">
          <span className="h-8 w-8 rounded-full bg-red-900/60" />
          <span className="h-8 w-8 rounded-full bg-amber-900/60" />
          <span className="h-8 w-8 rounded-full bg-green-500 shadow-[0_0_20px] shadow-green-400" />
        </div>
        <p className="mt-4 rounded-2xl bg-crema-2 px-3 py-2 text-sm font-semibold">🟢 Listo para el gestor</p>
      </div>

      {/* Móvil */}
      <div className="absolute left-1/2 top-0 w-72 -translate-x-1/2 rounded-[2.75rem] border-[6px] border-orange-300 bg-marron-oscuro p-2 shadow-2xl shadow-black/20">
        <div className="h-[28rem] overflow-hidden rounded-[2.25rem] bg-crema">
          <div className="flex items-center justify-between px-5 pt-4 text-xs font-semibold">
            <span>9:41</span>
            <span>●●● ▮</span>
          </div>
          <p className="px-5 pt-4 text-2xl font-extrabold">Documentos</p>
          <div className="flex gap-2 px-5 pt-3 text-xs font-semibold">
            <span className="rounded-full bg-marron-oscuro px-3 py-1 text-white">Activos</span>
            <span className="rounded-full bg-white px-3 py-1">Buzón</span>
            <span className="rounded-full bg-white px-3 py-1">Papelera</span>
          </div>
          <div className="mx-4 mt-4 rounded-3xl bg-marron-oscuro p-4 text-white">
            <p className="text-xs opacity-70">Total del trimestre</p>
            <p className="text-3xl font-extrabold">4.320,50 €</p>
            <div className="mt-3 h-2 rounded-full bg-white/15">
              <div className="h-2 w-4/5 rounded-full bg-lima" />
            </div>
            <p className="mt-2 text-xs opacity-70">38 de 42 validados</p>
          </div>
          <ul className="mx-4 mt-4 space-y-2">
            {filas.map((f) => (
              <li key={f.nombre} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm">
                <span>
                  <span className="block font-semibold">{f.nombre}</span>
                  <span className="text-xs text-marron">{f.importe}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.clase}`}>{f.estado}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tarjetas derecha */}
      <div className="absolute right-0 top-10 hidden w-64 rotate-3 rounded-3xl border border-black/5 bg-white/90 p-5 shadow-2xl shadow-black/10 backdrop-blur md:block">
        <span className="rounded-full bg-lima px-2 py-0.5 text-xs font-bold">A revisar</span>
        <p className="mt-2 text-lg font-bold">Faltan datos</p>
        <p className="text-xs text-marron">2 tickets sin fecha · 1 factura sin NIF</p>
        <div className="mt-3 flex gap-2">
          {["Jul", "Ago", "Sep"].map((m, i) => (
            <span key={m} className="flex-1 rounded-xl bg-crema-2 py-2 text-center text-xs font-semibold">
              {m}
              <span className={`mx-auto mt-1 block h-4 w-4 rounded-full ${i < 2 ? "bg-green-500" : "bg-amber-400"}`} />
            </span>
          ))}
        </div>
      </div>
      <div className="absolute right-6 top-64 hidden w-64 -rotate-2 rounded-3xl border border-black/5 bg-white/90 p-5 shadow-2xl shadow-black/10 backdrop-blur md:block">
        <p className="flex justify-between text-sm">
          <span>🧾 Base imponible</span>
          <strong>3.570,66 €</strong>
        </p>
        <p className="mt-3 flex justify-between text-sm">
          <span>💶 Cuota de IVA</span>
          <strong>749,84 €</strong>
        </p>
        <p className="mt-3 flex justify-between text-sm">
          <span>📊 Excel para el gestor</span>
          <strong>Listo</strong>
        </p>
      </div>
    </div>
  );
}

export default async function Inicio() {
  const estado = leerEstado();
  if (estado && (await sesionActual())) redirect("/panel");

  return (
    <div className="halo">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-marron-oscuro text-base">
            🚦
          </span>
          Cuentapp
        </Link>
        <nav aria-label="Portada" className="flex items-center gap-6 text-sm font-semibold">
          <a href="#como" className="hidden hover:underline sm:inline">Cómo funciona</a>
          <a href="#planes" className="hidden hover:underline sm:inline">Planes</a>
          <Link href="/entrar" className="hover:underline">Entrar</Link>
          <Link href="/registro" className="whitespace-nowrap rounded-full bg-marron-oscuro px-5 py-2.5 text-white hover:bg-black">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main className="px-6 pb-20">
        <section className="mx-auto max-w-4xl pt-12 text-center sm:pt-20" aria-labelledby="titular">
          <h1 id="titular" className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            Tu trimestre,
            <br />
            <span className="degradado">siempre en verde.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-marron sm:text-xl">
            Sube tus facturas y tickets, Cuentapp lee los datos, te avisa de lo que falta y te dice de un vistazo si
            todo está listo para tu gestor.
          </p>
          {estado ? (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/registro" className={pildoraOscura}>
                Empieza gratis 14 días
              </Link>
              <Link href="/entrar" className={`${pildoraClara} inline-flex items-center gap-2`}>
                <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-marron-oscuro text-xs text-white">
                  →
                </span>
                Ya tengo cuenta
              </Link>
            </div>
          ) : (
            <p className="mx-auto mt-10 max-w-xl rounded-2xl bg-white p-6">
              <span aria-hidden="true">✖ </span>La base de datos no existe o es de una versión anterior. Ejecuta{" "}
              <code>npm run db:reset</code> (o <code>npm run db:migrar</code>) y recarga.
            </p>
          )}
        </section>

        <Maqueta />

        <section id="como" className="mx-auto mt-24 max-w-6xl" aria-labelledby="como-titulo">
          <h2 id="como-titulo" className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            Cómo funciona
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["1", "Reúne", "Sube fotos o PDF, o reenvía los correos a tu buzón de Cuentapp. Guardamos el original intacto."],
              ["2", "Revisa", "Leemos los datos en tu propio equipo y te avisamos de duplicados, datos que faltan o importes que no cuadran."],
              ["3", "Entrega", "Valida y descarga el Excel del trimestre, o guarda una copia ordenada para tu gestor."],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-3xl border border-black/5 bg-white p-6 shadow-xl shadow-black/5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-lima font-extrabold">{n}</span>
                <p className="mt-4 text-xl font-bold">{t}</p>
                <p className="mt-2 text-marron">{d}</p>
              </li>
            ))}
          </ol>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            <li className="rounded-3xl bg-white p-5">
              <span aria-hidden="true">🔴 </span>
              <strong>Rojo</strong>: hay un duplicado, un documento ilegible o a nombre de otra empresa.
            </li>
            <li className="rounded-3xl bg-white p-5">
              <span aria-hidden="true">🟡 </span>
              <strong>Ámbar</strong>: faltan datos o quedan documentos por validar.
            </li>
            <li className="rounded-3xl bg-white p-5">
              <span aria-hidden="true">🟢 </span>
              <strong>Verde</strong>: todo validado, listo para el gestor.
            </li>
          </ul>
        </section>

        {estado && (
          <section id="planes" className="mx-auto mt-24 max-w-4xl" aria-labelledby="planes-titulo">
            <h2 id="planes-titulo" className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
              Planes
            </h2>
            <ul className="mt-10 grid gap-6 md:grid-cols-3">
              {estado.planes.map((p) => (
                <li
                  key={p.id}
                  className={`flex flex-col rounded-3xl p-6 ${p.id === "cuentapp" ? "bg-marron-oscuro text-white shadow-2xl shadow-black/20" : "border border-black/5 bg-white"}`}
                >
                  <p className="text-lg font-bold">{p.nombre}</p>
                  <p className="mt-2 text-3xl font-extrabold">
                    {!p.disponible ? "Pronto" : p.dias_prueba ? "Gratis" : euros(p.precio_centimos)}
                    {p.disponible && !p.dias_prueba ? <span className="text-base font-semibold opacity-80"> /mes sin IVA</span> : null}
                  </p>
                  <p className={`mt-3 text-sm ${p.id === "cuentapp" ? "opacity-90" : "text-marron"}`}>
                    {!p.disponible
                      ? "Para despachos y gestorías con varias empresas."
                      : p.dias_prueba
                        ? `${p.dias_prueba} días · hasta ${p.limite_docs_total} documentos`
                        : `Hasta ${p.limite_docs_mes} documentos al mes`}
                  </p>
                  {p.disponible ? (
                    <Link
                      href="/registro"
                      className={`mt-6 rounded-full px-5 py-2.5 text-center font-semibold ${p.id === "cuentapp" ? "bg-lima text-marron-oscuro hover:bg-white" : "bg-marron-oscuro text-white hover:bg-black"}`}
                    >
                      {p.dias_prueba ? "Probar gratis" : "Empezar"}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
