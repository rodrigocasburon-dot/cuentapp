# SUPUESTOS.md — Cuentapp

Registro vivo de supuestos, decisiones y dudas. Cada entrada indica si está
**verificada** (comprobada en esta máquina o en la documentación del paquete
instalado) o es **supuesta** (pendiente de confirmar). `[A VERIFICAR]` marca
lo que alguien del equipo debe comprobar antes de darlo por bueno.

Última actualización: 29/10/2026 (fase 3).

---

## 1. Datos de entrada (rellenados con lo medido en la máquina)

| Dato | Valor | Estado |
|---|---|---|
| SO | Windows 11 Home (10.0.26200) | Verificado |
| RAM | 15,7 GB | Verificado |
| GPU | Intel Iris Plus integrada, sin CUDA | Verificado |
| CPU | Intel Core i7-1065G7 (4 núcleos) | Verificado |
| Docker / WSL2 | No instalados | Verificado |
| Node.js | 24.22.1 LTS portátil en `C:\Users\rodri\tools` (SHA-256 comprobado) | Verificado |
| Límite documentos/mes | 250 (plan Cuentapp) | Supuesto: el marcador `[LÍMITE_DOCUMENTOS_MES]` repetía el dato del plan |
| Banco de tickets | `banco-tickets/` (sintéticos en git, reales fuera de git) | Decidido en fase 1 |

## 2. Decisiones tomadas

| # | Decisión | Motivo |
|---|---|---|
| D-01 | **SQLite + carpeta local** en lugar de Supabase local | No hay Docker ni WSL2; instalarlos exige administrador y reinicio. Lo confirmó el equipo el 28/10/2026. |
| D-02 | Repositorio en `C:\Users\rodri\Projects\cuentapp` | Separado de otros proyectos de la máquina. |
| D-03 | Importes en **céntimos enteros** | Evita errores de coma flotante en "bases + cuotas = total". |
| D-04 | `cacheComponents` de Next 16 desactivado | Modelo mental más simple: cada página lee la BD en cada petición. |
| D-05 | Banco sintético rasterizado con **Edge headless** | No hay Pillow ni librería gráfica; Edge viene con Windows. |
| D-06 | Documentos **no borrables** en el MVP (trigger en BD) | Perder un original bloquea la entrega. Un "archivado" lógico, si hace falta, en fases posteriores. |
| D-07 | Tests con **Vitest**; scripts con **tsx** | Sin configuración extra para TypeScript. |

### Fase 2 (29/10/2026)

| # | Decisión | Motivo |
|---|---|---|
| D-08 | Motor B = **RapidOCR 3.10** (modelos PP-OCRv6 de PaddleOCR sobre ONNX Runtime) en lugar de PaddleOCR oficial | 100 MB frente a 300-500 MB; mismos modelos; el equipo autorizó solo esta descarga. |
| D-09 | Motor C (Ollama) **no medido** | Descarga de ~7,5 GB no autorizada. El adaptador existe (`comparativa/motores/ollama.ts`) y se activa solo si Ollama está en marcha. SmolVLM2 no existe en la biblioteca oficial de Ollama (comprobado: 404). |
| D-10 | Motor D (API de pago) **no implementado** | Coste cero y sin claves en el repositorio. |
| D-11 | Elección **provisional**: motor B | Ver `docs/pruebas-lectura.md`. Pendiente de tickets reales y del documento consolidado. |
| D-12 | Los motores OCR comparten un analizador de texto (`src/lectura/analizar-texto.ts`) | Comparación justa; mejorar el analizador mejora a A y B por igual. |
| D-13 | PL-01..PL-04 definidas por nosotros | Falta el documento consolidado (ver §5.1). |

Consecuencia de D-08 para la fase 5: la app tendrá que llamar a Python
desde Node (proceso hijo, como hace la comparativa). Es una pieza más que
instalar (`.venv-ocr`); el README lo explicará. Si eso pesa demasiado,
Tesseract (A) funciona dentro de Node sin nada más, a costa de peor lectura
de fotos.

### Fase 3 (29/10/2026) · RF-01 acceso

| # | Decisión | Motivo / estado |
|---|---|---|
| D-14 | Autenticación propia: contraseñas con **scrypt** (N=2^17, r=8, p=1, parámetros de OWASP); sesión de **7 días fijos**; en la BD solo el **SHA-256 del token**; cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción. | Sin Supabase Auth (D-01). Cada inicio de sesión tarda ~0,45 s en este portátil (medido). |
| D-15 | Freno a la fuerza bruta: **5 fallos en 15 minutos por email** bloquean ese email 15 minutos. | Riesgo aceptado: un tercero puede bloquear una cuenta durante 15 min escribiendo mal su contraseña. En producción, añadir límite por IP. |
| D-16 | La entrada no revela si un email existe (mismo mensaje y tiempo similar). **El registro sí** ("ya hay una cuenta con ese email"). | Usabilidad frente a privacidad; habitual. Revisable. |
| D-17 | La empresa activa sale **siempre de la sesión**: las páginas solo obtienen datos con `repositorioActual()`. Dos pruebas estáticas lo vigilan (src/app no importa el repositorio; los componentes de cliente no importan código de servidor). | Equivalente funcional de la RLS en la capa de aplicación. |
| D-18 | Protección CSRF: la de las Server Actions de Next (compara `Origin` con `Host`). | Verificado en la documentación de Next 16.4.3 (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`). |
| D-19 | **Versión de esquema** (`PRAGMA user_version`, ahora 2). El servidor no arranca con otra versión y pide `npm run db:reset`. | Sin migraciones todavía. **A partir de la fase 4 habrá originales**: `db:reset` se negará a borrar y harán falta migraciones de verdad. |
| S-09 | Sin recuperación de contraseña ni verificación de email. | Requieren enviar correos: fuera del MVP local. |

**Telemetría de Next.js.** Al arrancar, Next avisa de que envía telemetría
anónima de uso a Vercel. No incluye documentos, pero contradice el espíritu
"local". Se desactiva con `npx next telemetry disable` (ajuste por usuario
en este equipo) o con la variable `NEXT_TELEMETRY_DISABLED=1`.
**Pendiente de decisión del equipo.**

## 3. Consecuencias de D-01 (SQLite) que el equipo debe conocer

- **No hay RLS.** El aislamiento entre empresas se impone en tres capas:
  1. `src/servidor/bd/repositorio.ts`: toda consulta lleva `empresa_id = ?`, y
     el id sale de la sesión, nunca del navegador.
  2. Triggers del esquema: una incidencia, línea de IVA, corrección o periodo
     no puede apuntar a un documento de otra empresa.
  3. `tests/aislamiento.test.ts`: falla si una empresa ve datos de otra **o**
     si algún fichero de `src/` fuera de `src/servidor/bd/` ejecuta SQL.
  Es más débil que la RLS de Postgres: una consulta mal escrita dentro del
  repositorio no la para la base de datos. Por eso cada función nueva del
  repositorio debe venir con su prueba de aislamiento.
- **No hay Supabase Auth.** La autenticación es propia (fase 3, ver D-14).
- **No hay Supabase Storage.** Los originales irán a
  `datos/originales/<empresa_id>/<sha256>.<ext>`, escritos una sola vez y
  marcados como solo lectura (fase 4).
- **Migración a Supabase:** el SQL es casi todo portable, pero los triggers
  usan sintaxis de SQLite y habría que reescribirlos en PL/pgSQL y añadir las
  políticas RLS. No es trivial; no está previsto en los 10 días.

## 4. Supuestos de producto

| # | Supuesto | Estado |
|---|---|---|
| S-01 | El trimestre de un documento lo marca su **fecha de emisión**, no la de subida. | Supuesto |
| S-02 | El plan Prueba admite **30 documentos en total** durante sus 14 días, no 30 al mes. | Supuesto |
| S-03 | Un documento cuenta para el límite al **subirse**, aunque luego sea un duplicado o ilegible. | Supuesto `[A VERIFICAR]` con el equipo: alternativa, no contar duplicados exactos. |
| S-04 | En el MVP cada usuario pertenece a una sola empresa; el modelo (membresías) admite varias. | Supuesto |
| S-05 | Un duplicado exacto (mismo SHA-256) se guarda igualmente y abre incidencia `duplicado` bloqueante; no se rechaza en la subida. | Supuesto |
| S-06 | Tipo de cambio: `1 EUR = x moneda`; `total_eur = total / x`, con la fecha de emisión. | Supuesto |
| S-07 | Frankfurter publica tipos de referencia del BCE solo en días hábiles; para festivos y fines de semana devuelve el día hábil anterior. | `[A VERIFICAR]` en la fase 5 |
| S-08 | Plazo de conservación de originales: al menos 4 años (prescripción tributaria) y 6 si se aplica el Código de Comercio. Afecta a la política de borrado. | `[A VERIFICAR]` (consultar a un gestor; no es asesoramiento legal) |

## 5. Huecos y fallos detectados en el planteamiento

1. **No tenemos el "documento de decisiones consolidado".** El prompt exige
   RF-01..RF-09, RNF-01..RNF-07 y PL-01..PL-04, pero solo nombra algunos
   (RF-01 acceso, RF-02/03/08 subida y original, RF-05 lectura, RF-06/07
   corrección y duplicados, RF-09 Excel). **RNF-01..07 y el contenido exacto
   de PL-01..04 son desconocidos.** Hay que añadir ese documento en
   `docs/decisiones.md` antes de la fase 2, o la comparativa no podrá medirse
   contra sus criterios.
2. **El motor B (PaddleOCR) "mejor con GPU" no aplica:** la GPU es una Intel
   integrada sin CUDA. Funcionará en CPU, más lento.
3. **Motor C (Ollama, VLM de 7B) en esta máquina:** sin GPU dedicada y con
   16 GB de RAM, un modelo de visión de 7B cuantizado correrá en CPU. Cabe
   esperar del orden de decenas de segundos a minutos por documento.
   `[A VERIFICAR]` en la fase 2 (medir, no suponer). SmolVLM2 será más rápido
   y probablemente menos preciso.
4. **Instalación de motores (resuelto en la fase 2):** Tesseract va como
   paquete npm (tesseract.js, datos de español incluidos) y RapidOCR en el
   entorno virtual `.venv-ocr`. Ollama sigue sin instalar (ver D-09).
5. **El banco sintético sobrestima la precisión:** son imágenes limpias,
   generadas por ordenador. Para elegir motor hacen falta **tickets reales**
   (mínimo recomendado: 15-20, fotografiados con móvil, en
   `banco-tickets/reales/`), leídos solo con motores locales.
6. **El arena (#D1A468) no sirve para texto sobre crema:** el contraste
   calculado es de unos 2:1 (AA exige 4,5:1). Marrón oscuro sobre crema: unos
   10,9:1; marrón: unos 6,9:1.
7. **Precios de producción** (Supabase Pro 25 USD/mes, Vercel Pro 20 USD/mes,
   Stripe 1,5 % + 0,25 €): copiados del enunciado, sin verificar; solo
   informativos `[A VERIFICAR]`.

## 6. MVP local frente a producción

| Pieza | MVP local (lo que se construye) | Producción (solo documentado) |
|---|---|---|
| Base de datos | SQLite (`datos/cuentapp.db`) | Supabase Postgres con RLS por empresa |
| Autenticación | Propia: scrypt + cookie de sesión | Supabase Auth |
| Originales | Carpeta `datos/originales/` | Supabase Storage con políticas por empresa |
| Correo entrante | Buzón simulado + subida de adjuntos | Proveedor de correo entrante (fuera de alcance) |
| Copia "Drive" | Carpeta local año/trimestre/categoría | Google Drive con OAuth `[A VERIFICAR]` |
| Cobro | Planes y límites aplicados, sin cobro real | Stripe |
| Alojamiento | `npm run dev` en el portátil | Vercel |

En el código, `src/config.ts` define `MODO` (`local` o `produccion`). Solo
`local` está implementado.

## 7. Licencias

| Componente | Licencia | Estado |
|---|---|---|
| Next.js, React, Tailwind, zod, better-sqlite3, Vitest, tsx | MIT | Conocido; `[A VERIFICAR]` con `npx license-checker` antes de la entrega |
| ExcelJS (fase 7) | MIT | `[A VERIFICAR]` al instalarlo |
| Anton, Bebas Neue (fase 9) | SIL Open Font License 1.1 | `[A VERIFICAR]`; se alojarán en local, sin CDN |
| Tesseract | Apache 2.0 | `[A VERIFICAR]` en la fase 2 |
| PaddleOCR | Apache 2.0 | `[A VERIFICAR]` en la fase 2 |
| Modelos de Ollama | Cada uno tiene la suya (algunas no son abiertas para uso comercial) | `[A VERIFICAR]` por modelo en la fase 2 |

## 8. Notas del entorno

- Node portátil: **no está en el PATH del sistema**. Ver el README para
  añadirlo a la sesión o al PATH de usuario.
- npm 11 no ejecuta scripts de instalación sin aprobación (`allowScripts`).
  better-sqlite3 13 trae binarios precompilados y funciona sin ellos.
  Queda pendiente `unrs-resolver` (lo usa ESLint); el lint funciona, pero
  revisadlo con `npm install-scripts ls`.
- La red de esta máquina es lenta con el registro de npm (~100 s por paquete
  en algunas descargas): instalad dependencias nuevas con margen.
