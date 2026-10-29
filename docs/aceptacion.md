# AceptaciÃ³n â€” Cuentapp (fase 10)

ComprobaciÃ³n de cada requisito frente a lo construido. **Aviso:** no tenemos
el Â«documento de decisiones consolidadoÂ», asÃ­ que el texto de cada RF/RNF es
nuestra interpretaciÃ³n (ver `SUPUESTOS.md`, Â§5.1). Â«PruebaÂ» = prueba
automÃ¡tica (`npm test`, 15 ficheros, 138 pruebas en verde el 29/10/2026);
Â«NavegadorÂ» = comprobado a mano en la app.

## Bloqueantes de la entrega

| CondiciÃ³n | Evidencia | Estado |
|---|---|---|
| Ninguna empresa ve ni toca datos de otra | `tests/aislamiento.test.ts`, pruebas de aislamiento en cada fichero de fase, triggers del esquema, revisiÃ³n de seguridad (D-50: sin fugas) | âœ” |
| No se pierde ningÃºn original | Escritura atÃ³mica + solo lectura + triggers sin borrado (`tests/originales.test.ts`), papelera en lugar de borrado (D-41), baja sin borrado (D-42), `npm run originales:verificar` | âœ” |

## Requisitos funcionales

| RF | QuÃ© | Evidencia | Estado |
|---|---|---|---|
| RF-01 | Registro, entrada, sesiÃ³n, aislamiento | `acceso`, `aislamiento`, `seguridad` (Server Actions con sesiÃ³n) Â· Navegador | âœ” |
| RF-02 | Subida de PDF, JPG, PNG, WebP y SVG; lÃ­mites de tamaÃ±o y plan | `originales`, `buzon-copia-limites` Â· Navegador | âœ” |
| RF-03 | Ver y descargar el original | `originales` (cabeceras, 404 entre empresas) Â· Navegador | âœ” |
| RF-05 | Lectura automÃ¡tica y validaciones | `procesar`, `validaciones`, `analizar-texto`, `banco`; `npm run lectura:probar` 136/144 campos | âœ” con banco sintÃ©tico; sin tickets reales |
| RF-06 | CorrecciÃ³n manual, historial y Â«ValidarÂ» | `correccion-duplicados` Â· Navegador | âœ” |
| RF-07 | Duplicados exactos y lÃ³gicos | `correccion-duplicados`, `papelera-cuenta` | âœ” |
| RF-08 | Original inmutable y comprobado | `originales`, `migraciones` (triggers tras migrar) | âœ” |
| RF-09 | SemÃ¡foro del trimestre y Excel para el gestor | `semaforo-excel` Â· Navegador | âœ” |
| RF-04 | (sin definir en lo que tenemos) | â€” | `[A VERIFICAR]` con el documento consolidado |

## Funcionalidades adicionales

| | QuÃ© | Evidencia | Estado |
|---|---|---|---|
| FA-02 | BuzÃ³n de correo (simulado) | `buzon-copia-limites` Â· pÃ¡gina Â«BuzÃ³nÂ» | âœ” simulado (D-45) |
| â€” | Copia local por trimestre | `buzon-copia-limites` | âœ” (D-46) |
| FA-03 | PWA | Manifiesto e icono | Parcial: sin service worker (D-49) |
| â€” | Planes, lÃ­mites, cambio de plan | `buzon-copia-limites` Â· Â«Mi cuentaÂ» | âœ” sin cobro (D-47) |
| â€” | Textos legales | `/legal/*` | Borradores (D-48) |

## Requisitos no funcionales (interpretaciÃ³n)

| | QuÃ© | Estado |
|---|---|---|
| Coste cero y local | Sin servicios de pago; OCR local; solo Frankfurter recibe moneda y fecha | âœ” |
| Privacidad | NingÃºn documento sale del equipo hacia servicios de IA | âœ” |
| Accesibilidad AA | Etiquetas, `aria-invalid`/`aria-describedby`, estados con icono y texto, contraste revisado en la paleta (Â§5.6) | RevisiÃ³n manual; sin auditorÃ­a con herramienta `[A VERIFICAR]` |
| Seguridad | RevisiÃ³n del 29/10/2026 (D-50); riesgos aceptados en D-51 | âœ” para MVP local |
| Mantenibilidad | TypeScript estricto, `npm run typecheck` y `npm run lint` sin errores, migraciones versionadas | âœ” |
| Arranque en 3 comandos | README | âœ” |

## Lo que falta o queda fuera

- Documento de decisiones consolidado (RF-04, RNF-01..07 y PL-01..04 oficiales).
- ValidaciÃ³n de la lectura con tickets reales (15-20 fotos de mÃ³vil).
- RevisiÃ³n jurÃ­dica de los textos legales; tipografÃ­as propias; service worker.
- Servidor de correo real, Google Drive, cobro con Stripe y despliegue (solo documentados).
