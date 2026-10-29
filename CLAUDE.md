# Cuentapp — guía para trabajar en el proyecto

App web por suscripción para que una empresa gestione sus **documentos**
(facturas completas y tickets simplificados; en la interfaz se dice siempre
«documentos», nunca «facturas»). Propuesta de valor: **el semáforo del
trimestre**. Proyecto final de 4 alumnos, MVP local y de coste cero.

Léete también `README.md` (arranque y estructura) y `SUPUESTOS.md`
(decisiones D-xx, supuestos S-xx, huecos y separación MVP local / producción).

## Entorno

- Node 24 LTS. En el portátil de Rodrigo está en
  `C:\Users\rodri\tools\node-v24.22.1-win-x64` y **no** en el PATH:
  `$env:PATH = "C:\Users\rodri\tools\node-v24.22.1-win-x64;$env:PATH"`.
- Stack: Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, TypeScript,
  zod 4, better-sqlite3, Vitest.
- Base de datos SQLite en `datos/cuentapp.db`; originales en
  `datos/originales/<empresa>/<sha256>.<ext>` (todo fuera de git).
- Lectura automática: Python 3.11 + `.venv-ocr` con RapidOCR (ver README).
  Sin ella la app funciona, pero los documentos pasan a revisión manual.

## Comandos

```bash
npm run dev            # servidor de desarrollo (puerto 3000)
npm test               # Vitest: debe pasar entero antes de cada commit
npm run typecheck      # tsc --noEmit
npm run db:reset       # crea la BD con dos empresas de prueba (se niega si hay originales)
npm run db:migrar      # aplica migraciones pendientes con copia previa
npm run lectura:probar # banco sintético por la lectura real (~136/144 campos)
```

## Reglas que no se negocian

1. **Aislamiento entre empresas.** Toda consulta pasa por
   `repositorioDeEmpresa(bd, empresaId)` (`src/servidor/bd/repositorio.ts`).
   Las páginas y acciones usan `repositorioActual()` (`src/servidor/auth/sesion.ts`):
   la empresa sale de la sesión, nunca del navegador. No hay SQL fuera de
   `src/servidor/bd/`, `src/app` no importa el repositorio y los componentes
   cliente no importan `@/servidor` (lo vigilan pruebas estáticas). Un fallo de
   aislamiento **bloquea la entrega**.
2. **El original no se pierde ni se altera.** Escritura atómica, solo lectura,
   triggers que impiden modificar o borrar, y hash comprobado cada vez que se
   sirve. Perder un original **bloquea la entrega**.
3. **Esquema.** `bd/esquema.sql` está congelado (base v2). Cada cambio es una
   migración nueva `bd/migraciones/NNN-*.sql` y se sube `VERSION_ESQUEMA` en
   `src/servidor/bd/conexion.ts` (hay prueba).
4. **Importes en céntimos enteros.** Moneda extranjera: se guarda la original y
   la conversión a euros con el tipo del BCE (Frankfurter, en caché).
5. **Privacidad:** nunca enviar documentos reales a niveles gratuitos de
   servicios de IA. Solo documentos sin datos personales. Los reales van en
   `banco-tickets/reales/` (fuera de git) y solo con motores locales.
6. Sin servicios de pago ni claves reales en el repositorio.
7. Interfaz en español, accesibilidad AA, estados siempre con **icono y texto**.
8. Separar «MVP local» y «producción» en el código (`src/config.ts`) y en
   `SUPUESTOS.md`. Si falta información, anota el supuesto en `SUPUESTOS.md`
   y sigue.
9. Código sencillo y comentado; cada fase termina ejecutable y con commit.

## Modelo de dominio

- Estados: `recibido → procesando → pendiente_revision | incidencia → validado`.
  La validación es **siempre manual** (botón «Validar»).
- Tipo: factura completa / ticket simplificado; se detecta solo y se puede corregir.
- Lectura: `extractInvoice` (`src/servidor/lectura/extraer.ts`) es la única
  puerta al motor; devuelve una `Extraccion` (zod, valor + confianza por campo).
  Cola en segundo plano (`cola.ts`, lanzada con `after()`); la lista se refresca
  cada 3 s.
- Validaciones deterministas en `src/dominio/validaciones.ts`; cada aviso tiene
  nivel `rojo | ambar | info`. Los avisos rojos crean incidencias bloqueantes.
- **Semáforo** (pendiente de implementar en la fase 7):
  - Verde: todo validado y sin incidencias abiertas.
  - Ámbar: documentos recibidos/procesando/pendientes, campos dudosos, o
    factura completa sin NIF del emisor o del receptor.
  - Rojo: incidencias bloqueantes (duplicado sin resolver, ilegible, problema
    documental relevante).
  - Solo informativo: ticket sin NIF del receptor.

## Estado (29-10-2026)

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Arranque, esquema SQLite, banco sintético | Hecha |
| 2 | Comparativa de motores PL-01..PL-04 (gana RapidOCR, provisional) | Hecha |
| 3 | RF-01 acceso, sesiones y aislamiento | Hecha |
| 4 | RF-02/03/08 subida y original inmutable | Hecha |
| 5 | RF-05 lectura automática, validaciones, tipo de cambio | Hecha |
| 6 | RF-06 corrección + «Validar»; RF-07 duplicados (punto de control) | **Siguiente** |
| 7 | RF-09 exportación Excel + semáforo del trimestre | Pendiente |
| 8 | Buzón de correo simulado + copia local | Pendiente |
| 9 | Precios, límites del plan, textos legales, diseño | Pendiente |
| 10 | Aceptación, revisión de seguridad, README, entrega | Pendiente |

Punto de control de la fase 6: si RF-01..RF-07 no pasan, se suspenden FA-03 y
la PWA.

### Pistas para la fase 6

- Las correcciones se guardan en la tabla `correcciones` (ya existe); la
  `extraccion_json` original es inmutable por trigger: no se reescribe, se
  corrige encima.
- Tras corregir hay que volver a ejecutar `validar()` y recalcular avisos.
- `buscarPorHash` ya detecta duplicados exactos al subir (`recibir.ts`
  devuelve `duplicadoDe`); falta crear la incidencia `duplicado` y detectar
  duplicados «lógicos» (mismo emisor + número + fecha + total).
- Las incidencias tienen estado `abierta | resuelta`; resolverlas debe quedar
  registrado.

## Pendiente fuera del código

- Falta el «documento de decisiones consolidado» con el texto oficial de
  RF-01..RF-09, RNF-01..RNF-07 y PL-01..PL-04: lo implementado sigue mi
  interpretación (ver `SUPUESTOS.md`).
- Faltan tickets reales para validar la lectura (el banco es sintético).
- Telemetría de Next.js sin decidir (`npx next telemetry disable`).
- Motor C (Ollama, ~7,5 GB) no autorizado ni medido.

## Pruebas manuales en el navegador

Las cuentas de prueba están en `scripts/bd-reset.ts` (solo valen en local).
Compruébalo en el navegador solo en los puntos de control; en el resto,
bastan las pruebas automáticas.
