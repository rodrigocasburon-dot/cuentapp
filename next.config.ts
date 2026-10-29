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
      allowedOrigins: process.env.CODESPACES ? ["*.app.github.dev"] : [],
    },
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
