"use client";

// Mientras haya documentos leyéndose, vuelve a pedir la página cada pocos
// segundos para que los estados se actualicen solos.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function Refresco({ activo, segundos = 3 }: { activo: boolean; segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [activo, segundos, router]);
  return null;
}
