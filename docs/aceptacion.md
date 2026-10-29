# Aceptación — Cuentapp (fase 10)

Comprobación de cada requisito frente a lo construido. **Aviso:** no tenemos
el «documento de decisiones consolidado». Los códigos RF/FA siguen la tabla
del prototipo HTML del equipo (D-52); los RNF son nuestra interpretación
(ver `SUPUESTOS.md`, §5.1). «Prueba» = prueba
automática (`npm test`, 16 ficheros, 154 pruebas en verde el 29/10/2026);
«Navegador» = comprobado a mano en la app.

## Bloqueantes de la entrega

| Condición | Evidencia | Estado |
|---|---|---|
| Ninguna empresa ve ni toca datos de otra | `tests/aislamiento.test.ts`, pruebas de aislamiento en cada fichero de fase, triggers del esquema, revisión de seguridad (D-50: sin fugas) | ✔ |
| No se pierde ningún original | Escritura atómica + solo lectura + triggers sin borrado (`tests/originales.test.ts`), papelera en lugar de borrado (D-41), baja sin borrado (D-42), `npm run originales:verificar` | ✔ |

## Requisitos funcionales

| RF | Qué | Evidencia | Estado |
|---|---|---|---|
| RF-01 | Registro, entrada, sesión, aislamiento y **recuperación de contraseña** (RFQ, req. 1) | `acceso`, `aislamiento`, `seguridad` (Server Actions con sesión), `requisitos-rfq` (enlace de un uso, 30 min, cierra sesiones) · Navegador | ✔ correo simulado (D-57) |
| RF-02 | Foto desde el móvil (cámara trasera) | Botón «Hacer una foto» en Documentos (`capture="environment"`) | ✔ sin probar en un móvil real |
| RF-03 | Arrastrar o elegir PDF/imagen; formatos y 10 MB | `originales`, `buzon-copia-limites` · zona de arrastre · Navegador | ✔ |
| RF-04 | Reenvío por correo y **compartir desde el móvil** | Buzón simulado (`buzon-copia-limites`, página «Buzón»); `share_target` del manifiesto → `/compartir` (Navegador: POST con sesión, 403 con otro origen, sin sesión a /entrar) | ✔ buzón simulado (D-45); compartir sin probar en un Android real (D-58) |
| RF-05 | Lectura automática y validaciones, con **categoría del gasto** sugerida | `procesar`, `validaciones`, `analizar-texto`, `banco`, `requisitos-rfq` (categorías); `npm run lectura:probar` 136/144 campos | ✔ con banco sintético; sin tickets reales; categorías sin medir (D-56) |
| RF-06 | Corrección manual, historial y «Validar» | `correccion-duplicados` · Navegador | ✔ |
| RF-07 | Duplicados exactos y lógicos | `correccion-duplicados`, `papelera-cuenta` | ✔ |
| RF-08 | Original conservado, inmutable y comprobado; ver y descargar | `originales`, `migraciones` (triggers tras migrar) · Navegador | ✔ |
| RF-09 | Excel para la gestoría | `semaforo-excel` · Navegador | ✔ |

## Funcionalidades adicionales

| | Qué | Evidencia | Estado |
|---|---|---|---|
| FA-01 | Semáforo, panel y avisos con enlace a cada documento | `semaforo-excel` · Panel | ✔ |
| FA-02 | Buzón empresarial | `buzon-copia-limites` · página «Buzón» | ✔ simulado (D-45) |
| FA-03 | Google Drive | Copia local por trimestre como sustituto (`buzon-copia-limites`) | Parcial: sin Drive (D-46) |
| — | PWA | Manifiesto e icono | Parcial: sin service worker (D-49) |
| — | Planes, límites, cambio de plan | `buzon-copia-limites` · «Mi cuenta» | ✔ sin cobro (D-47) |
| — | Página de precios (RFQ, «Modelo de negocio») | `/precios`: tarjetas, tabla comparativa y preguntas frecuentes · Navegador | ✔ (D-59) |
| — | Panel con cifras: mes frente al anterior y gasto por categoría | `requisitos-rfq` (`resumenMes`, aislamiento) · Panel | ✔ (D-59) |
| — | Avisos de trimestre a punto de cerrar y plazo del 303 | `requisitos-rfq` (`avisosDePlazo`, hora de España) | ✔ (D-59) |
| — | Informe por categoría | Hoja «Por categoría» del Excel (`requisitos-rfq`) | ✔ (D-56) |
| — | Textos legales | Pie con enlaces a `/legal/*` | Contenido pendiente del equipo (D-48) |

## Guía legal (LEG-01..12)

Ninguno se declara superado (la guía exige evidencias en el entorno final).
Implementado para la demo: aceptación versionada en el registro (LEG-02),
avisos en contexto y simulaciones rotuladas (LEG-06/07 en modo académico),
semáforo y Excel según el cap. 13 (LEG-08), solo cookie técnica (LEG-09),
prueba sin tarjeta y precio provisional (LEG-10). Pendientes y discrepancias:
`SUPUESTOS.md`, D-53 y D-54.

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

- Documento de decisiones consolidado (RNF-01..07 y PL-01..04 oficiales).
- Recuperación de contraseña (RF-01 en el prototipo): necesita enviar correos, fuera del MVP local (S-09).
- Validación de la lectura con tickets reales (15-20 fotos de móvil).
- Contenido de los textos legales (lo aporta el equipo); tipografías propias; service worker.
- Servidor de correo real, Google Drive, cobro con Stripe y despliegue (solo documentados).
