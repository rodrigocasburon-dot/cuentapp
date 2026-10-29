// Manifiesto de la PWA (FA-03): permite «instalar» Cuentapp en el móvil o el
// escritorio y, una vez instalada, recibir PDF y fotos con «Compartir». Sin service worker: la app necesita el servidor para funcionar,
// así que no hay modo sin conexión (D-49).

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cuentapp · El semáforo del trimestre",
    short_name: "Cuentapp",
    description: "Tus facturas y tickets, listos para el gestor.",
    lang: "es",
    start_url: "/panel",
    display: "standalone",
    background_color: "#f7f8f3",
    theme_color: "#0f2a1f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    // «Compartir → Cuentapp» desde el móvil (D-58): los archivos llegan a /compartir
    share_target: {
      action: "/compartir",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: [{ name: "archivos", accept: ["application/pdf", "image/jpeg", "image/png", "image/webp", ".pdf", ".jpg", ".jpeg", ".png", ".webp"] }],
      },
    },
  };
}
