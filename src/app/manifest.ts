// Manifiesto de la PWA (FA-03): permite «instalar» Cuentapp en el móvil o el
// escritorio. Sin service worker: la app necesita el servidor para funcionar,
// así que no hay modo sin conexión (D-43).

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cuentapp · El semáforo del trimestre",
    short_name: "Cuentapp",
    description: "Tus facturas y tickets, listos para el gestor.",
    lang: "es",
    start_url: "/panel",
    display: "standalone",
    background_color: "#f5efe3",
    theme_color: "#2e1c14",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
