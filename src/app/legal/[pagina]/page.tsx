// Páginas legales enlazadas en el pie (fase 9). El contenido está PENDIENTE:
// lo redactará el equipo y se pegará aquí tal cual (D-48). Hasta entonces
// solo se muestra un aviso, para que nadie lea textos que no son los definitivos.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const TITULOS: Record<string, string> = {
  "aviso-legal": "Aviso legal",
  privacidad: "Política de privacidad",
  terminos: "Términos de uso",
  cookies: "Cookies",
};

export function generateStaticParams() {
  return Object.keys(TITULOS).map((pagina) => ({ pagina }));
}

export async function generateMetadata({ params }: { params: Promise<{ pagina: string }> }): Promise<Metadata> {
  const titulo = TITULOS[(await params).pagina];
  return { title: titulo ? `${titulo} · Cuentapp` : "Cuentapp" };
}

export default async function PaginaLegal({ params }: { params: Promise<{ pagina: string }> }) {
  const titulo = TITULOS[(await params).pagina];
  if (!titulo) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="mb-4">
        <Link href="/" className="underline underline-offset-4">
          ← Cuentapp
        </Link>
      </p>
      <h1 className="mb-6 text-4xl font-black uppercase tracking-tight">{titulo}</h1>
      <p role="status" className="rounded-lg border-2 border-dashed border-marron px-4 py-3">
        <span aria-hidden="true">⏳ </span>Texto pendiente. Estamos preparando esta página.
      </p>
    </main>
  );
}
