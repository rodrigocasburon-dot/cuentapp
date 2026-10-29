import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La plantilla de Next 16.4 activaba cacheComponents y partialPrefetching.
  // Los desactivamos: cada página lee la base de datos en cada petición y
  // así el equipo no tiene que razonar sobre cachés (ver SUPUESTOS.md).

  // better-sqlite3 es un módulo nativo: no se empaqueta, se carga tal cual.
  serverExternalPackages: ["better-sqlite3"],

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
