"use client";

// Error inesperado en una página. No mostramos detalles técnicos al usuario;
// el detalle queda en el registro del servidor.

export default function ErrorInesperado({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
      <h1 className="text-4xl font-black uppercase tracking-tight">Algo ha fallado</h1>
      <p className="mt-4 text-marron">No se ha perdido ningún documento. Vuelve a intentarlo dentro de un momento.</p>
      <button onClick={reset} className="mt-8 rounded-full bg-marron-oscuro px-6 py-3 font-bold text-crema hover:bg-marron">
        Reintentar
      </button>
    </main>
  );
}
