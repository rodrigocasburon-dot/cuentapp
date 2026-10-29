"use client";

// Enlace del menú principal: la página actual va en píldora lima y se anuncia
// a los lectores de pantalla con aria-current.

import Link from "next/link";
import { usePathname } from "next/navigation";

export function EnlaceNav({ href, children }: { href: string; children: React.ReactNode }) {
  const ruta = usePathname();
  const activo = ruta === href || ruta.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${activo ? "bg-lima" : "hover:bg-crema-2"}`}
    >
      {children}
    </Link>
  );
}
