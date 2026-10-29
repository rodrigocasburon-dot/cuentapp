# Cuentapp

**El semáforo del trimestre**: la empresa ve de un vistazo si sus documentos
(facturas completas y tickets simplificados) están listos para el gestor.

Proyecto final · MVP local y de coste cero · Next.js + TypeScript + Tailwind + SQLite.

## Probarla sin instalar nada

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/rodrigocasburon-dot/cuentapp?quickstart=1)

Pulsa el botón (hace falta cuenta de GitHub con acceso al repositorio). GitHub
crea un ordenador en la nube, instala todo y abre la app en el puerto 3000 en
unos minutos la primera vez. Entra con los botones de **acceso de
demostración**. Cada persona tiene su propia copia con datos de prueba; se
apaga sola tras 30 minutos sin uso. Sube solo documentos de prueba.

> **No pongas el puerto 3000 como «Public»** en la pestaña Puertos: con el
> acceso de demostración, cualquiera con el enlace entraría sin contraseña.

## Qué hace

- **Documentos**: subida (PDF, JPG, PNG, WebP; SVG solo se guarda y descarga),
  lectura automática local con categoría del gasto sugerida, avisos de datos
  que faltan o no cuadran, duplicados, corrección con historial, validación
  manual, papelera y acciones sobre varios a la vez.
- **Panel**: cifras del mes frente al anterior y por categoría, avisos de
  cierre de trimestre, el semáforo de cada trimestre, totales y desglose de
  IVA, Excel para el gestor y copia local ordenada de los originales validados.
- **Buzón** (simulado): los adjuntos de un correo a la dirección de la
  empresa entran como documentos. Con la app instalada en Android, también
  «Compartir → Cuentapp».
- **Mi cuenta**: plan y uso, cambio de plan (sin cobro), datos de la empresa y baja.
- **Precios** (`/precios`) y **recuperación de contraseña**. En local el
  correo no se envía: el enlace queda en un `.txt` de `datos/correos-salientes/`.

Qué se ha comprobado y qué falta: [`docs/aceptacion.md`](docs/aceptacion.md).

## Arranque en 3 comandos

Requisito: Node.js 24 LTS (`node -v` debe responder `v24.x`).

```bash
npm install
npm run db:reset
npm run dev
```

Abre http://localhost:3000 y entra con los botones de **acceso de
demostración** (solo con `npm run dev`), con una de las cuentas de prueba que
crea `db:reset` (en la cabecera de `scripts/bd-reset.ts`; solo valen en
local), o crea una cuenta nueva en «Crear cuenta».

> **En el portátil del equipo** Node está en `C:\Users\rodri\tools\node-v24.22.1-win-x64`
> y no en el PATH. En PowerShell, antes de los comandos:
> `$env:PATH = "C:\Users\rodri\tools\node-v24.22.1-win-x64;$env:PATH"`

### Pago de planes con Stripe (opcional, modo de pruebas)

Sin esto, cambiar de plan en «Mi cuenta» es inmediato y gratis. Para enseñar
un pago de verdad sin mover dinero:

1. Crea una cuenta en Stripe y copia la **clave secreta de pruebas**
   (`sk_test_…`) de https://dashboard.stripe.com/test/apikeys.
2. Copia `.env.example` como `.env.local` (no se sube a git) y ponla en
   `STRIPE_SECRET_KEY`. Reinicia `npm run dev`.
3. En «Mi cuenta», «Activar» lleva a la página de pago de Stripe. Paga con la
   tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.

Una clave real (`sk_live_…`) se ignora. Detalles y límites: D-60 en `SUPUESTOS.md`.

### Lectura automática (una sola vez)

La app arranca sin esto, pero entonces los documentos pasan a revisión
manual sin datos. Para que se lean solos hace falta Python 3.11 y el motor OCR
en un entorno virtual del proyecto (unos 100 MB, todo local):

```bash
python -m venv .venv-ocr
.venv-ocr\Scripts\python -m pip install rapidocr==3.10.0 onnxruntime==1.31.1 pypdfium2==5.14.0
npm run lectura:probar
```

El último comando lee el banco sintético y debe acabar con unos 136/144
campos correctos. La conversión de moneda necesita internet (Frankfurter).

### Si actualizas el código

Si alguien ha añadido una migración en `bd/migraciones/`, el servidor no
arranca y pide `npm run db:migrar`. Migra sin borrar datos y antes hace una
copia de la base de datos.

## Otros comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas (esquema, acceso, aislamiento entre empresas, NIF, lectura, banco) |
| `npm run banco:generar` | Regenera el banco de documentos sintéticos con Edge |
| `npm run comparar` | Comparativa de motores de lectura (ver `docs/pruebas-lectura.md`) |
| `npm run originales:verificar` | Comprueba que todos los originales existen y coinciden con su SHA-256 |
| `npm run db:migrar` | Aplica las migraciones pendientes sin borrar datos (con copia previa) |
| `npm run lectura:probar` | Pasa el banco sintético por la lectura real de la app |
| `npm run cuentas:listar` | Lista las cuentas registradas en esta base de datos (sin contraseñas) |
| `npm run buzon:simular -- <buzón> <archivo…>` | Simula un correo con adjuntos al buzón de una empresa |
| `npm run typecheck` | Comprobación de tipos de TypeScript |
| `npm run build` y `npm start` | Versión de producción (sin acceso de demostración) |
| `npm run lint` | ESLint |

> **Empezar de cero en local.** Cuando ya hay documentos subidos,
> `npm run db:reset` se niega a borrar (protege los originales). Si de verdad
> quieres borrarlo todo, elimina a mano la carpeta `datos/` y vuelve a
> ejecutar `npm run db:reset`. Se pierden todos los documentos.

## Estructura

```
bd/esquema.sql              Esquema BASE (v2, congelado): tablas, CHECK y triggers
bd/migraciones/             Cambios posteriores del esquema (003-..., 004-...)
lectura-py/                 Servicio OCR en Python (RapidOCR + lectura de PDF)
src/servidor/lectura/       extractInvoice, cola de lectura, tipo de cambio
src/dominio/validaciones.ts Validaciones deterministas (NIF, cuadre, fecha, moneda...)
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
src/servidor/almacen/       Originales: guardar por SHA-256, solo lectura, comprobar al leer
src/servidor/documentos/    Recepción, entrega del original, buzón, límites, Excel y copia local
src/app/(privado)/          Páginas que exigen sesión (panel, documentos)
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
- No toques `bd/esquema.sql`: cada cambio del esquema es una migración nueva
  en `bd/migraciones/` y sube `VERSION_ESQUEMA` (una prueba lo vigila).
- El original de un documento no se modifica ni se borra (lo impiden la BD
  y el sistema de archivos), y se comprueba su hash cada vez que se sirve.
- Importes siempre en céntimos enteros.
- Nunca se envían documentos reales a servicios de IA gratuitos.
- Textos de la interfaz en español; estados siempre con icono y texto.
