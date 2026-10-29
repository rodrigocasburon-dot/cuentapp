// Campo de formulario accesible: etiqueta visible, ayuda opcional y error
// anunciado por los lectores de pantalla (aria-invalid + aria-describedby).

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  nombre: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
}

export function Campo({ nombre, etiqueta, ayuda, error, ...resto }: Props) {
  const idAyuda = ayuda ? `${nombre}-ayuda` : undefined;
  const idError = error ? `${nombre}-error` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={nombre} className="font-semibold">
        {etiqueta}
      </label>
      <input
        id={nombre}
        name={nombre}
        aria-invalid={error ? true : undefined}
        aria-describedby={[idAyuda, idError].filter(Boolean).join(" ") || undefined}
        className="rounded-lg border-2 border-marron bg-white px-3 py-2 text-marron-oscuro focus:outline-none focus-visible:ring-4 focus-visible:ring-marron/40 aria-invalid:border-rojo"
        {...resto}
      />
      {ayuda && (
        <p id={idAyuda} className="text-sm text-marron">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="text-sm font-semibold text-rojo">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </div>
  );
}

export function Boton({ children, pendiente, ...resto }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendiente?: boolean }) {
  return (
    <button
      disabled={pendiente}
      aria-busy={pendiente || undefined}
      className="rounded-full bg-marron-oscuro px-6 py-3 font-bold text-crema hover:bg-marron focus:outline-none focus-visible:ring-4 focus-visible:ring-marron/40 disabled:opacity-60"
      {...resto}
    >
      {children}
    </button>
  );
}

export function AvisoError({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p role="alert" className="rounded-lg border-2 border-rojo bg-white px-4 py-3 font-semibold text-rojo">
      <span aria-hidden="true">⚠ </span>
      {texto}
    </p>
  );
}
