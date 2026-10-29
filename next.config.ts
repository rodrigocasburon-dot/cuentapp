import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La plantilla de Next 16.4 activaba cacheComponents y partialPrefetching.
  // Los desactivamos: cada página lee la base de datos en cada petición y
  // así el equipo no tiene que razonar sobre cachés (ver SUPUESTOS.md).

  // better-sqlite3 es un módulo nativo: no se empaqueta, se carga tal cual.
  serverExternalPackages: ["better-sqlite3"],

  // Las Server Actions aceptan 1 MB por defecto. La subida admite hasta
  // 10 archivos de 10 MB (src/dominio/subida.ts) más el envoltorio del formulario.
  experimental: {
    serverActions: {
      bodySizeLimit: "101mb",
      // En GitHub Codespaces la app se ve en https://<codespace>-3000.app.github.dev
      // a través de un proxy; sin esto Next rechazaría los formularios (protección CSRF).
      // Fuera de Codespaces no se amplía nada.
      // Solo el origen de ESTE codespace, no el de cualquiera (revisión de seguridad B1).
      allowedOrigins:
        process.env.CODESPACES && process.env.CODESPACE_NAME
          ? [`${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev"}`]
          : [],
    },
  },

  // Cabeceras de seguridad para todas las páginas (B4): sin marcos ajenos
  // (clickjacking), sin enviar la dirección a otros sitios y sin cámara/micrófono.
  async headers() {
    return [
      {
        source: "/:ruta*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
