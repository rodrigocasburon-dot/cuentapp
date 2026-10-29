// Páginas legales enlazadas en el pie y en el registro (guía legal, cap. 07).
// El contenido está PENDIENTE: la guía prohíbe publicar textos con titular,
// NIF, domicilio o canal de privacidad sin resolver (PV-03, D-48).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { PAGINAS_LEGALES, type PaginaLegal } from "@/dominio/legal";

export function generateStaticParams() {
  return Object.keys(PAGINAS_LEGALES).map((pagina) => ({ pagina }));
}

export async function generateMetadata({ params }: { params: Promise<{ pagina: string }> }): Promise<Metadata> {
  const titulo = PAGINAS_LEGALES[(await params).pagina as PaginaLegal];
  return { title: titulo ? `${titulo} · Cuentapp` : "Cuentapp" };
}

export default async function PaginaLegal({ params }: { params: Promise<{ pagina: string }> }) {
  const { pagina } = await params;
  if (pagina === "terminos") permanentRedirect("/legal/condiciones"); // dirección anterior
  const titulo = PAGINAS_LEGALES[pagina as PaginaLegal];
  if (!titulo) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="mb-4">
        <Link href="/" className="underline underline-offset-4">
          ← Cuentapp
        </Link>
      </p>
      <h1 className="mb-6 text-4xl font-extrabold tracking-tight">{titulo}</h1>
      <p role="status" className="rounded-2xl border-2 border-dashed border-marron px-4 py-3">
        <span aria-hidden="true">⏳ </span>Texto pendiente. Estamos preparando esta página.
      </p>
    </main>
  );
}
