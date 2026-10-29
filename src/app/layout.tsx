import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

// Tipografías Anton / Bebas Neue: pendientes (D-49). Se usan las del sistema.
export const viewport: Viewport = { themeColor: "#2e1c14" };
export const metadata: Metadata = {
  title: "Cuentapp",
  description: "El semáforo del trimestre: tus documentos listos para el gestor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t-2 border-crema-2 px-6 py-6 text-sm">
          <nav aria-label="Información legal" className="mx-auto flex w-full max-w-4xl flex-wrap gap-x-6 gap-y-2">
            <Link href="/legal/aviso-legal" className="underline-offset-4 hover:underline">Aviso legal</Link>
            <Link href="/legal/privacidad" className="underline-offset-4 hover:underline">Privacidad</Link>
            <Link href="/legal/terminos" className="underline-offset-4 hover:underline">Términos</Link>
            <Link href="/legal/cookies" className="underline-offset-4 hover:underline">Cookies</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
