# Aceptación — Cuentapp (fase 10)

Comprobación de cada requisito frente a lo construido. **Aviso:** no tenemos
el «documento de decisiones consolidado», así que el texto de cada RF/RNF es
nuestra interpretación (ver `SUPUESTOS.md`, §5.1). «Prueba» = prueba
automática (`npm test`, 15 ficheros, 138 pruebas en verde el 29/10/2026);
«Navegador» = comprobado a mano en la app.

## Bloqueantes de la entrega

| Condición | Evidencia | Estado |
|---|---|---|
| Ninguna empresa ve ni toca datos de otra | `tests/aislamiento.test.ts`, pruebas de aislamiento en cada fichero de fase, triggers del esquema, revisión de seguridad (D-50: sin fugas) | ✔ |
| No se pierde ningún original | Escritura atómica + solo lectura + triggers sin borrado (`tests/originales.test.ts`), papelera en lugar de borrado (D-41), baja sin borrado (D-42), `npm run originales:verificar` | ✔ |

## Requisitos funcionales

| RF | Qué | Evidencia | Estado |
|---|---|---|---|
| RF-01 | Registro, entrada, sesión, aislamiento | `acceso`, `aislamiento`, `seguridad` (Server Actions con sesión) · Navegador | ✔ |
| RF-02 | Subida de PDF, JPG, PNG, WebP y SVG; límites de tamaño y plan | `originales`, `buzon-copia-limites` · Navegador | ✔ |
| RF-03 | Ver y descargar el original | `originales` (cabeceras, 404 entre empresas) · Navegador | ✔ |
| RF-05 | Lectura automática y validaciones | `procesar`, `validaciones`, `analizar-texto`, `banco`; `npm run lectura:probar` 136/144 campos | ✔ con banco sintético; sin tickets reales |
| RF-06 | Corrección manual, historial y «Validar» | `correccion-duplicados` · Navegador | ✔ |
| RF-07 | Duplicados exactos y lógicos | `correccion-duplicados`, `papelera-cuenta` | ✔ |
| RF-08 | Original inmutable y comprobado | `originales`, `migraciones` (triggers tras migrar) | ✔ |
| RF-09 | Semáforo del trimestre y Excel para el gestor | `semaforo-excel` · Navegador | ✔ |
| RF-04 | (sin definir en lo que tenemos) | — | `[A VERIFICAR]` con el documento consolidado |

## Funcionalidades adicionales

| | Qué | Evidencia | Estado |
|---|---|---|---|
| FA-02 | Buzón de correo (simulado) | `buzon-copia-limites` · página «Buzón» | ✔ simulado (D-45) |
| — | Copia local por trimestre | `buzon-copia-limites` | ✔ (D-46) |
| FA-03 | PWA | Manifiesto e icono | Parcial: sin service worker (D-49) |
| — | Planes, límites, cambio de plan | `buzon-copia-limites` · «Mi cuenta» | ✔ sin cobro (D-47) |
| — | Textos legales | Pie con enlaces a `/legal/*` | Contenido pendiente del equipo (D-48) |

## Requisitos no funcionales (interpretación)

| | Qué | Estado |
|---|---|---|
| Coste cero y local | Sin servicios de pago; OCR local; solo Frankfurter recibe moneda y fecha | ✔ |
| Privacidad | Ningún documento sale del equipo hacia servicios de IA | ✔ |
| Accesibilidad AA | Etiquetas, `aria-invalid`/`aria-describedby`, estados con icono y texto, contraste revisado en la paleta (§5.6) | Revisión manual; sin auditoría con herramienta `[A VERIFICAR]` |
| Seguridad | Revisión del 29/10/2026 (D-50); riesgos aceptados en D-51 | ✔ para MVP local |
| Mantenibilidad | TypeScript estricto, `npm run typecheck` y `npm run lint` sin errores, migraciones versionadas | ✔ |
| Arranque en 3 comandos | README | ✔ |

## Lo que falta o queda fuera

- Documento de decisiones consolidado (RF-04, RNF-01..07 y PL-01..04 oficiales).
- Validación de la lectura con tickets reales (15-20 fotos de móvil).
- Contenido de los textos legales (lo aporta el equipo); tipografías propias; service worker.
- Servidor de correo real, Google Drive, cobro con Stripe y despliegue (solo documentados).
