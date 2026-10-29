// Portada: qué es Cuentapp, el semáforo y los planes (fase 9).
// Estética combinada de dos referencias «fintech»: titular grande con
// degradado, banda lima horizontal con cifras, burbujas de iconos, móvil y
// tarjeta de cristal, y funciones en mosaico. Las maquetas son ilustrativas
// (datos inventados) y se ocultan a los lectores de pantalla.

import Link from "next/link";
import { redirect } from "next/navigation";
import { TarjetasPlanes } from "@/componentes/TarjetasPlanes";
import { AVISO } from "@/dominio/legal";
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

/** Botón píldora oscuro con flecha en círculo (segunda referencia). */
function BotonFlecha({ href, children, claro = false }: { href: string; children: React.ReactNode; claro?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-3 rounded-full py-2 pl-6 pr-2 font-semibold shadow-lg shadow-black/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-lima ${
        claro ? "border border-black/10 bg-white hover:bg-crema-2" : "bg-marron-oscuro text-white hover:bg-black"
      }`}
    >
      {children}
      <span aria-hidden="true" className={`grid h-9 w-9 place-items-center rounded-full ${claro ? "bg-marron-oscuro text-white" : "bg-white text-marron-oscuro"}`}>
        ↗
      </span>
    </Link>
  );
}

/** Burbuja blanca con icono que «flota» sobre la banda. */
function Burbuja({ icono, clase }: { icono: string; clase: string }) {
  return (
    <span aria-hidden="true" className={`absolute hidden h-16 w-16 place-items-center rounded-full bg-white text-2xl shadow-xl shadow-black/10 lg:grid ${clase}`}>
      {icono}
    </span>
  );
}

/** Móvil con la lista de documentos (decorativo). */
function Movil() {
  const filas = [
    { nombre: "Supermercado", importe: "26,63 €", estado: "✔ Validado", clase: "bg-green-100 text-green-900" },
    { nombre: "Gasolinera", importe: "58,10 €", estado: "? Revisar", clase: "bg-amber-100 text-amber-900" },
    { nombre: "Software Inc.", importe: "43,04 €", estado: "✔ Validado", clase: "bg-green-100 text-green-900" },
  ];
  return (
    <div aria-hidden="true" className="mx-auto w-64 rounded-[2.5rem] border-[6px] border-marron-oscuro bg-marron-oscuro p-1.5 shadow-2xl shadow-black/25">
      <div className="h-[26rem] overflow-hidden rounded-[2rem] bg-crema">
        <div className="flex items-center justify-between px-5 pt-4 text-xs font-semibold">
          <span>9:41</span>
          <span>●●● ▮</span>
        </div>
        <p className="px-5 pt-3 text-2xl font-extrabold">Documentos</p>
        <div className="flex gap-2 px-5 pt-3 text-xs font-semibold">
          <span className="rounded-full bg-lima px-3 py-1">Activos</span>
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
  );
}

/** Tarjeta de cristal con el resumen del trimestre (decorativa). */
function TarjetaResumen() {
  return (
    <div aria-hidden="true" className="w-full max-w-xs">
      <div className="mb-3 flex gap-2">
        <span className="flex-1 rounded-full bg-white px-4 py-2.5 text-sm text-marron shadow">🔍 Busca un documento</span>
        <span className="grid place-items-center rounded-full bg-marron-oscuro px-4 text-sm font-semibold text-white">Ir</span>
      </div>
      <div className="cristal rounded-3xl p-5 shadow-xl shadow-black/5">
        <div className="flex items-center justify-between">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-marron-oscuro text-sm">🚦</span>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">3T 2026</span>
        </div>
        <p className="mt-5 text-xs font-semibold opacity-70">Base imponible · cuota IVA</p>
        <p className="text-2xl font-extrabold tracking-wide">3.570,66 · 749,84 €</p>
        <div className="mt-5 flex items-end justify-between text-xs">
          <span>
            <span className="block opacity-70">Semáforo</span>
            <span className="font-bold">🟢 Revisados</span>
          </span>
          <span>
            <span className="block opacity-70">Excel</span>
            <span className="font-bold">Listo</span>
          </span>
          <span className="font-mono text-lg">▦</span>
        </div>
      </div>
    </div>
  );
}

export default async function Inicio() {
  const estado = leerEstado();
  if (estado && (await sesionActual())) redirect("/panel");

  return (
    <div className="bg-[url('/topo.svg')] bg-[length:1100px] bg-[position:center_-6rem] bg-no-repeat">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-marron-oscuro text-base">
            🚦
          </span>
          Cuentapp
        </Link>
        <nav aria-label="Portada" className="flex items-center gap-2 text-sm font-semibold sm:gap-4">
          <a href="#inicio" className="hidden rounded-full bg-lima px-4 py-1.5 sm:inline">Inicio</a>
          <a href="#funciones" className="hidden rounded-full px-3 py-1.5 hover:bg-crema-2 sm:inline">Funciones</a>
          <Link href="/precios" className="rounded-full px-3 py-1.5 hover:bg-crema-2">Precios</Link>
          <Link href="/entrar" className="rounded-full px-3 py-1.5 hover:bg-crema-2">Entrar</Link>
          <Link href="/registro" className="whitespace-nowrap rounded-full bg-marron-oscuro px-5 py-2.5 text-white hover:bg-black">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main>
        <section id="inicio" className="relative px-6 pt-10 text-center sm:pt-16" aria-labelledby="titular">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold shadow-sm">
            <span aria-hidden="true">✦</span> Lectura automática en tu propio equipo · sin enviar tus facturas fuera
          </p>
          <h1 id="titular" className="mx-auto max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            Tu trimestre,
            <br />
            <span className="degradado">siempre en verde.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-marron sm:text-xl">
            Sube tus facturas y tickets, Cuentapp propone los datos, te avisa de lo que falta y te dice de un vistazo
            si tus documentos están revisados para tu gestoría.
          </p>
          {estado ? (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <BotonFlecha href="/registro">Empieza gratis 14 días</BotonFlecha>
              <BotonFlecha href="/entrar" claro>
                Ya tengo cuenta
              </BotonFlecha>
            </div>
          ) : (
            <p className="mx-auto mt-10 max-w-xl rounded-2xl bg-white p-6">
              <span aria-hidden="true">✖ </span>La base de datos no existe o es de una versión anterior. Ejecuta{" "}
              <code>npm run db:reset</code> (o <code>npm run db:migrar</code>) y recarga.
            </p>
          )}
          <Burbuja icono="🧾" clase="left-[12%] top-[48%]" />
          <Burbuja icono="📊" clase="left-[20%] top-[68%] h-12 w-12 text-lg" />
          <Burbuja icono="🔄" clase="right-[14%] top-[62%]" />
          <Burbuja icono="🔔" clase="right-[22%] top-[8%] h-12 w-12 text-lg" />
        </section>

        {/* Banda lima: cifras · móvil · tarjeta de cristal */}
        <section aria-label="Cuentapp en cifras" className="banda mt-12 px-6 py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_auto_1fr]">
            <dl className="grid grid-cols-3 gap-6 text-left lg:grid-cols-1">
              {[
                ["3", "vías de entrada: foto, archivo o correo"],
                ["100 %", "de la lectura, en tu propio equipo"],
                ["1 clic", "para el Excel de tu gestoría"],
              ].map(([cifra, texto]) => (
                <div key={cifra}>
                  <dt className="whitespace-nowrap text-3xl font-extrabold tracking-tight sm:text-5xl">{cifra}</dt>
                  <dd className="mt-1 max-w-[12rem] text-sm font-medium">{texto}</dd>
                </div>
              ))}
            </dl>
            <Movil />
            <div className="flex justify-center lg:justify-end">
              <TarjetaResumen />
            </div>
          </div>
        </section>

        <p className="mx-auto mt-10 max-w-3xl px-6 text-center text-sm font-semibold text-marron">
          Pensado para pymes, autónomos y sus gestorías · facturas completas y tickets simplificados
        </p>

        {/* Funciones en mosaico */}
        <section id="funciones" className="mx-auto mt-20 max-w-6xl px-6" aria-labelledby="funciones-titulo">
          <h2 id="funciones-titulo" className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            Todo lo que necesitas para cerrar el trimestre
          </h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            <li className="rounded-3xl bg-marron-oscuro p-7 text-white md:col-span-2 md:row-span-2">
              <span className="rounded-full bg-lima px-3 py-1 text-xs font-bold text-marron-oscuro">El semáforo del trimestre</span>
              <p className="mt-5 text-3xl font-extrabold">Sabes en un vistazo qué falta.</p>
              <ul className="mt-6 space-y-3 text-sm">
                <li>
                  <span aria-hidden="true">🔴 </span>
                  <strong>Rojo</strong>: hay un duplicado, un documento ilegible o a nombre de otra empresa.
                </li>
                <li>
                  <span aria-hidden="true">🟡 </span>
                  <strong>Ámbar</strong>: faltan datos o quedan documentos por validar.
                </li>
                <li>
                  <span aria-hidden="true">🟢 </span>
                  <strong>Verde</strong>: todos los documentos registrados, revisados y validados.
                </li>
              </ul>
              <p className="mt-6 text-xs opacity-75">{AVISO.semaforo}</p>
            </li>
            <li className="rounded-3xl bg-lima p-6">
              <p aria-hidden="true" className="text-2xl">📷</p>
              <p className="mt-3 text-lg font-bold">Foto, archivo o correo</p>
              <p className="mt-1 text-sm">Haz una foto con el móvil, arrastra PDF o reenvía los correos a tu buzón.</p>
            </li>
            <li className="rounded-3xl border border-black/5 bg-white p-6">
              <p aria-hidden="true" className="text-2xl">⧉</p>
              <p className="mt-3 text-lg font-bold">Duplicados y datos que faltan</p>
              <p className="mt-1 text-sm text-marron">Te avisamos antes de que llegue al gestor. Tú decides.</p>
            </li>
            <li className="rounded-3xl border border-black/5 bg-white p-6">
              <p aria-hidden="true" className="text-2xl">🔒</p>
              <p className="mt-3 text-lg font-bold">El original, intacto</p>
              <p className="mt-1 text-sm text-marron">Guardamos cada archivo tal como llegó y comprobamos su huella al abrirlo.</p>
            </li>
            <li className="rounded-3xl border border-black/5 bg-white p-6">
              <p aria-hidden="true" className="text-2xl">✍</p>
              <p className="mt-3 text-lg font-bold">Corriges y validas</p>
              <p className="mt-1 text-sm text-marron">Nada se valida solo: cada cambio queda en el historial.</p>
            </li>
            <li className="rounded-3xl bg-lima-2 p-6">
              <p aria-hidden="true" className="text-2xl">📊</p>
              <p className="mt-3 text-lg font-bold">Excel para tu gestoría</p>
              <p className="mt-1 text-sm">Documentos validados, IVA por tipo y moneda original, en un archivo.</p>
            </li>
          </ul>
        </section>

        {estado && (
          <section id="planes" className="mx-auto mt-24 max-w-6xl px-6 pb-20" aria-labelledby="planes-titulo">
            <h2 id="planes-titulo" className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
              Planes
            </h2>
            <TarjetasPlanes planes={estado.planes} />
            <p className="mt-8 text-center">
              <Link href="/precios" className="font-semibold underline underline-offset-4">
                Comparar los planes y preguntas frecuentes
              </Link>
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
