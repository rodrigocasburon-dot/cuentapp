import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
      <h1 className="text-4xl font-black uppercase tracking-tight">No encontrado</h1>
      <p className="mt-4 text-marron">Esta página no existe o no tienes acceso a ella.</p>
      <Link href="/panel" className="mt-8 inline-block rounded-full bg-marron-oscuro px-6 py-3 font-bold text-crema hover:bg-marron">
        Volver al panel
      </Link>
    </main>
  );
}
