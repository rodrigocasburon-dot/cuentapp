# Cuentapp

**El semáforo del trimestre**: la empresa ve de un vistazo si sus documentos
(facturas completas y tickets simplificados) están listos para el gestor.

Proyecto final · MVP local y de coste cero · Next.js + TypeScript + Tailwind + SQLite.

## Arranque en 3 comandos

Requisito: Node.js 24 LTS (`node -v` debe responder `v24.x`).

```bash
npm install
npm run db:reset
npm run dev
```

Abre http://localhost:3000 y entra con una de las **cuentas de prueba** que
crea `db:reset` (están en la cabecera de `scripts/bd-reset.ts`; solo valen en
local), o crea una cuenta nueva en «Crear cuenta».

> **En el portátil del equipo** Node está en `C:\Users\rodri\tools\node-v24.22.1-win-x64`
> y no en el PATH. En PowerShell, antes de los comandos:
> `$env:PATH = "C:\Users\rodri\tools\node-v24.22.1-win-x64;$env:PATH"`

## Otros comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas (esquema, acceso, aislamiento entre empresas, NIF, lectura, banco) |
| `npm run banco:generar` | Regenera el banco de documentos sintéticos con Edge |
| `npm run comparar` | Comparativa de motores de lectura (ver `docs/pruebas-lectura.md`) |
| `npm run lint` | ESLint |

## Estructura

```
bd/esquema.sql              Tablas, CHECK de estados y triggers de integridad
src/config.ts               Modo local / producción y rutas de datos
src/dominio/                Reglas puras: estados, NIF... (sin BD)
src/lectura/                Contrato de lectura (zod) y analizador de texto OCR
comparativa/                Script independiente que compara motores (fase 2)
docs/                       Pruebas de lectura PL-01..PL-04 y su resultado
src/servidor/bd/            ÚNICO sitio que toca la base de datos
  repositorio.ts            Acceso a datos SIEMPRE filtrado por empresa
  cuentas.ts                Registro, sesiones e intentos de acceso
src/servidor/auth/          Contraseñas (scrypt) y sesión por cookie
  sesion.ts                 repositorioActual(): la única puerta a los datos desde las páginas
src/app/(privado)/          Páginas que exigen sesión (panel...)
src/app/                    Páginas (Next.js App Router)
scripts/                    db:reset, generador del banco
tests/                      Vitest
banco-tickets/sinteticos/   Documentos ficticios + su verdad (.json)
banco-tickets/reales/       Documentos reales: fuera de git, solo motores locales
datos/                      BD y originales (fuera de git)
SUPUESTOS.md                Supuestos, decisiones y dudas abiertas
```

## Reglas del proyecto

- Toda consulta pasa por `repositorioDeEmpresa(bd, empresaId)`. Una prueba
  falla si alguien ejecuta SQL fuera de `src/servidor/bd/`.
- Las páginas y acciones obtienen los datos con `repositorioActual()`: la
  empresa sale de la sesión, nunca del navegador.
- Si cambias `bd/esquema.sql`, sube `PRAGMA user_version` y `VERSION_ESQUEMA`.
- El original de un documento no se modifica ni se borra (lo impide la BD).
- Importes siempre en céntimos enteros.
- Nunca se envían documentos reales a servicios de IA gratuitos.
- Textos de la interfaz en español; estados siempre con icono y texto.
