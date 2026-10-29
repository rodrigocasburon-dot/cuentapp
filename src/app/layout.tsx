import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Tipografía Plus Jakarta Sans (licencia SIL OFL 1.1). next/font la descarga
// al compilar y la sirve desde la propia app: el navegador no llama a Google (D-49).
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const viewport: Viewport = { themeColor: "#15171c" };
export const metadata: Metadata = {
  title: "Cuentapp",
  description: "El semáforo del trimestre: tus documentos listos para el gestor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-crema-2 bg-white px-6 py-8 text-sm">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
            <p className="font-semibold">
              <span aria-hidden="true">🚦 </span>Cuentapp
            </p>
            <nav aria-label="Información legal" className="flex flex-wrap gap-x-6 gap-y-2 text-marron">
              <Link href="/legal/aviso-legal" className="underline-offset-4 hover:text-marron-oscuro hover:underline">Aviso legal</Link>
              <Link href="/legal/privacidad" className="underline-offset-4 hover:text-marron-oscuro hover:underline">Privacidad</Link>
              <Link href="/legal/condiciones" className="underline-offset-4 hover:text-marron-oscuro hover:underline">Condiciones</Link>
              <Link href="/legal/encargo" className="underline-offset-4 hover:text-marron-oscuro hover:underline">Acuerdo de tratamiento</Link>
              <Link href="/legal/cookies" className="underline-offset-4 hover:text-marron-oscuro hover:underline">Cookies</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
