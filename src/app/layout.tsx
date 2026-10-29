import type { Metadata } from "next";
import "./globals.css";

// Tipografías (Anton / Bebas Neue) y paleta definitiva: fase 9.
export const metadata: Metadata = {
  title: "Cuentapp",
  description: "El semáforo del trimestre: tus documentos listos para el gestor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
