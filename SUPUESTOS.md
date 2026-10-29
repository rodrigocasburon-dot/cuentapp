# SUPUESTOS.md — Cuentapp

Registro vivo de supuestos, decisiones y dudas. Cada entrada indica si está
**verificada** (comprobada en esta máquina o en la documentación del paquete
instalado) o es **supuesta** (pendiente de confirmar). `[A VERIFICAR]` marca
lo que alguien del equipo debe comprobar antes de darlo por bueno.

Última actualización: 29/10/2026 (fase 10, entrega).

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
| Límite documentos/mes | 100 (Cuentapp, 20 €) y 300 (Cuentapp Pro, 40 €) | Decidido por el equipo el 29/10/2026 (D-55); antes, supuesto de 250 |
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
| S-09 | Sin verificación de email. La recuperación de contraseña sí existe desde el 29/10/2026, con correo simulado (D-57). | La verificación requiere enviar correos: fuera del MVP local. |

**Telemetría de Next.js.** Al arrancar, Next avisa de que envía telemetría
anónima de uso a Vercel. No incluye documentos, pero contradice el espíritu
"local". Se desactiva con `npx next telemetry disable` (ajuste por usuario
en este equipo) o con la variable `NEXT_TELEMETRY_DISABLED=1`.
**Pendiente de decisión del equipo.**

### Fase 4 (29/10/2026) · RF-02, RF-03, RF-08 subida y original

| # | Decisión | Motivo / estado |
|---|---|---|
| D-20 | Formatos admitidos: **PDF, JPEG, PNG y WebP**, detectados por sus primeros bytes (no por extensión ni por lo que diga el navegador). | SVG y HTML podrían ejecutar código al abrirse. **HEIC (fotos de iPhone) no se admite**: el navegador no lo muestra y los motores OCR no lo leen; el iPhone convierte a JPEG al subir desde Safari `[A VERIFICAR]` con un iPhone real. |
| D-21 | Límites: **10 MB por archivo, 10 archivos por subida** (`bodySizeLimit` de las Server Actions a 101 MB). | Una foto de móvil ocupa 2-8 MB. |
| D-22 | Original guardado **por su SHA-256** en `datos/originales/<empresa>/<hash>.<ext>`, escritura atómica (temporal + enlace), **solo lectura** después. Un duplicado exacto reutiliza el mismo fichero. | Verificado en disco (atributo de solo lectura activo en Windows). |
| D-23 | El original se **comprueba contra su hash cada vez que se sirve**; si no coincide, no se entrega (error 500 y aviso en el registro). `npm run originales:verificar` revisa todos. | RF-08. |
| D-24 | Un documento de otra empresa devuelve **404, igual que uno inexistente**. | No revela qué identificadores existen. |
| D-25 | Orden: primero se guarda el original y después la fila. Puede quedar un original sin fila (inofensivo), nunca una fila sin original. | |
| D-26 | El uso mensual se cuenta al dar de alta el documento, en la misma transacción, con el **mes en hora de España**. Los **límites del plan aún no se aplican** (fase 9). | S-03 sigue abierto: ahora mismo cuentan también los duplicados. |
| D-27 | El duplicado exacto se recibe y se avisa ("es idéntico a…"); la **incidencia bloqueante** llega en la fase 6 (RF-07). | |

**Consecuencia práctica:** con originales guardados, `npm run db:reset` se
niega a borrar la base de datos. Para empezar de cero en local hay que
borrar a mano la carpeta `datos/` entera (se pierden todos los documentos).
Hasta que haya migraciones (D-19), cambiar el esquema obliga a eso.

### Fase 5 (29/10/2026) · RF-05 lectura integrada

| # | Decisión | Motivo / estado |
|---|---|---|
| D-28 | **Migraciones** (`bd/migraciones/NNN-*.sql`, `npm run db:migrar`, copia de seguridad previa). `esquema.sql` queda congelado como base v2. | Ya hay originales: no se puede volver a crear la BD. Probado con la BD local real (v2 → v3, originales intactos). Sustituye a D-19. |
| D-29 | `extractInvoice(ruta)` es la única puerta a la lectura: devuelve una `Extraccion` validada con zod. Motor B (RapidOCR) como **servicio Python persistente** (el modelo se carga una vez, ~3 s). | Cambiar de motor = cambiar solo `src/servidor/lectura/extraer.ts`. |
| D-30 | **PDF:** si trae texto (factura generada por programa) se usa ese texto (~0,04 s, exacto); si es escaneado, se convierte a imagen (200 ppp, máx. 3 páginas) y pasa por OCR. Librería `pypdfium2` 5.14 (3,8 MB, PyPI) en `.venv-ocr`. | Licencia de pypdfium2/PDFium `[A VERIFICAR]` (se declaran Apache-2.0/BSD). |
| D-31 | La lectura va **en segundo plano** (`after()` de Next tras la subida), de uno en uno; la lista se refresca sola cada 3 s mientras haya documentos leyéndose. Los atascados en "procesando" más de 10 min vuelven a la cola. | Una subida de 10 fotos no bloquea la pantalla. |
| D-32 | Estados tras leer: **incidencia** si hay un aviso rojo; si no, **pendiente de revisión**. Nunca "validado" automáticamente. Si el motor falla → revisión manual (ámbar). Si el archivo está **dañado** → incidencia "ilegible". | La validación es manual (fase 6). |
| D-33 | Avisos de las validaciones guardados en `documentos.avisos_json` con nivel rojo/ámbar/info. Solo los rojos generan fila en `incidencias`. | El semáforo (fase 7) leerá ambos. |
| D-34 | Rojo: ilegible (≤1 campo leído), archivo dañado, **documento a nombre de otro NIF** (si el NIF leído es válido y con confianza ≥ 0,8; si no, ámbar). Ámbar: NIF con control erróneo o ajeno a España, factura completa sin NIF, sin total o sin desglose, descuadre (> 1 cént. por línea), cuota ≠ base × tipo, tipo de IVA no español, fecha futura o de hace > 4 años, moneda desconocida, sin tipo de cambio, campo con confianza < 0,6. Info: ticket sin NIF de receptor, moneda extranjera. | Umbrales provisionales; ajustar con tickets reales. |
| D-35 | Tipo de cambio: Frankfurter `api.frankfurter.dev/v1`, 1 EUR = x moneda, `total_eur = total / x`, **caché en BD** por moneda y fecha. Sin red → aviso ámbar y total en euros vacío. | Verificado: fin de semana → último día hábil (S-07 resuelto). Solo se envían moneda y fecha. |

### Fase 6 (29/10/2026) · RF-06 y RF-07 corrección, validación y duplicados

| # | Decisión | Motivo / estado |
|---|---|---|
| D-36 | **Migración 4** (`bd/migraciones/004-correccion-duplicados.sql`): amplía `incidencias` (`resuelta_por`, `motivo_resolucion`, `documento_referencia_id`) y `documentos` (`descartado_en`, `descartado_por`). Se añade trigger para asegurar que el `documento_referencia_id` pertenece a la misma empresa. | Trazabilidad de quién y cuándo resuelve incidencias o descarta documentos, manteniendo el aislamiento multi-empresa. |
| D-37 | **Corrección manual (RF-06):** cada cambio de campo o líneas de IVA se registra en `correcciones` con valor anterior y nuevo; `extraccion_json` es inmutable. Tras cada corrección se vuelve a ejecutar `validar()`, recalculando avisos e incidencias. Si el documento estaba validado, se revierte a `pendiente_revision`. | Auditoría íntegra de cambios manuales y consistencia del semáforo. |
| D-38 | **Validación manual (RF-06):** el botón «Validar» se activa únicamente si no hay incidencias bloqueantes abiertas y el documento no está descartado. Registra `validado_en` y `validado_por`. | La validación nunca es automática. |
| D-41 | **Papelera** en lugar de borrado: «Mover a la papelera» (en la ficha o marcando varios en la lista) usa `descartado_en`; el documento sale de la lista, del semáforo y del Excel, pero su fila y su original se conservan y se puede **recuperar**. Acciones en bloque: validar, mover a la papelera y recuperar. | D-06 y S-08: perder un original bloquea la entrega y hay obligación de conservarlos. El equipo no eligió modo; se aplica el recomendado. |
| D-42 | **Baja de la cuenta** (migración 5): marca empresa y usuario titular con `baja_en`, cierra sus sesiones y ya no pueden entrar. **No borra datos.** El email queda ocupado (no se puede registrar de nuevo). Las cuentas de demostración no se pueden dar de baja. «Mi cuenta» permite además cambiar nombre de empresa, NIF y nombre del usuario; cambiar el NIF no revalida documentos ya leídos. | Conservación legal (S-08). Borrado real o anonimización: `[A VERIFICAR]` con RGPD antes de producción. |
| D-40 | **SVG admitido** (decisión del equipo, 29/10/2026; matiza D-20). Se reconoce por su contenido (XML cuyo primer elemento es `<svg>`), se guarda intacto, pero **nunca se muestra en la web**: se entrega siempre como descarga con `Content-Security-Policy: default-src 'none'; sandbox`. No pasa por el OCR: queda pendiente de revisión con el aviso ámbar `lectura_manual`. | Un SVG puede llevar scripts que robarían la sesión si se abriera dentro de la app. Leerlo exigiría convertirlo a imagen (otra librería, no autorizada). |
| D-39 | **Detección y resolución de duplicados (RF-07):** duplicado exacto detectado en la subida por SHA-256 (`recibirArchivo`), abriendo incidencia bloqueante `duplicado` que apunta al original. Duplicado lógico (mismo NIF de emisor, número, fecha y total) se comprueba al terminar la lectura y tras cada corrección. La resolución admite «no es duplicado» o «descartar este documento» (marcado con fecha y usuario, sin borrado físico, D-06). | Cumplimiento estricto de la regla de no borrado de documentos ni originales. |

**Resultado de `npm run lectura:probar`** (banco sintético por la lectura
real de la app, 16 lecturas: 12 imágenes + 4 facturas en PDF): **136/144
campos correctos (94 %)**; los 8 fallos son todos del ticket ilegible, que
acaba como incidencia, como debe. Imágenes: 2-5 s; PDF con texto: 0,04 s.
Sigue pendiente repetirlo con tickets reales.

### Fases 7 a 10 (29/10/2026)

| # | Decisión | Motivo / estado |
|---|---|---|
| D-44 | **Semáforo**: rojo solo por incidencias bloqueantes **abiertas**; ámbar por documentos sin validar (y sus avisos ámbar); los avisos de un documento **validado** no cuentan; trimestre vacío = «Sin documentos» (ni verde ni rojo). Trimestre actual en hora de España. | La validación manual es la decisión de que el documento está bien. Un trimestre vacío no está «listo para el gestor». |
| D-45 | **Buzón simulado** (FA-02): cada empresa tiene una dirección; un correo a ella mete sus adjuntos como documentos con origen `buzon`, remitente y asunto (migración 6). Se simula desde la página «Buzón» o con `npm run buzon:simular`. No hay servidor de correo. | MVP local. En producción, un proveedor de correo entrante llamaría a `recibirCorreo()`. |
| D-46 | **Copia local** (sustituto de Google Drive): copia los originales **validados** de un trimestre a `datos/copia/<empresa>/<año>/T<n>/{Facturas completas,Tickets}/` con el Excel; nunca toca el original, es idempotente. | Solo validados: lo que no ha revisado nadie no debería llegar al gestor. |
| D-47 | **Límites del plan** en subida y buzón: Prueba 30 documentos en total y 14 días; Cuentapp 100/mes y Pro 300/mes (D-55). **Cambio de plan simulado, sin cobro** (Stripe en producción). Comprobación y alta no son atómicas: dos subidas simultáneas pueden pasarse del cupo por pocos documentos. | Riesgo aceptado en local (un solo proceso). |
| D-48 | **Textos legales** (aviso legal, privacidad, términos, cookies): páginas y enlaces en el pie creados, **contenido pendiente** de los documentos del equipo (se muestra «Texto pendiente»). Solo hay una cookie técnica, sin banner. Aceptación obligatoria al registrarse. | Decisión del equipo (29/10/2026): no publicar borradores propios. |
| D-49 | **PWA**: manifiesto e icono; **sin service worker** (la app necesita el servidor). Tipografías Anton / Bebas Neue **no incorporadas**: se usan las del sistema (habría que descargarlas y verificar su licencia OFL). | Instalabilidad con icono SVG `[A VERIFICAR]` en Chrome y Safari. |
| D-50 | **Revisión de seguridad** (agente, solo lectura): sin hallazgos críticos ni altos ni fugas entre empresas. Arreglados: resolución manual solo de duplicados abiertos (M1), líneas de IVA validadas y acotadas (M2), intento de acceso apuntado antes de verificar y límite global de 20 altas / 15 min (M4), tope de píxeles en OCR (M5), `allowedOrigins` del propio codespace (B1), nombres sin caracteres bidi y con extensión real (B3), cabeceras de seguridad (B4), empresas de baja (B5), errores internos ocultos (B7). | Prueba estática nueva: toda Server Action comprueba la sesión. |
| D-51 | **Riesgos aceptados para el MVP local**, a resolver en producción: el límite de 101 MB de las Server Actions vale también para entrar/registrarse (M3; en producción, subida por un route handler con sesión previa y límite global bajo); sin límite por IP (no hay IP fiable en local); sesiones caducadas que no se purgan (B6, sin impacto). En Codespaces, **no hacer público el puerto 3000** (B2): el acceso de demostración dejaría entrar a cualquiera. | |

### Ideas del prototipo HTML del equipo (29/10/2026)

| # | Decisión | Motivo / estado |
|---|---|---|
| D-52 | El prototipo HTML (`cuentapp-main.zip`, sin backend, datos en `localStorage`) aporta: la **numeración de requisitos** (RF-02 foto desde el móvil, RF-03 arrastrar archivo, RF-04 reenvío por correo, FA-01 semáforo y avisos, FA-02 buzón, **FA-03 Google Drive**, no PWA) y los **casos PL-01..PL-04** (gasolinera arrugada = campo dudoso; supermercado con IVA 4/10/21 %; factura de Figma en inglés y USD; bar torcido y oscuro sin NIF del emisor). Incorporado: botón «Hacer una foto», zona de arrastre, búsqueda y filtros en Documentos, avisos con enlace en el panel y el fondo topográfico. | Nuestros PL-01..04 de la fase 2 eran umbrales definidos por nosotros (D-13); los casos del prototipo son **otra definición** `[A VERIFICAR]` con el documento consolidado. El banco sintético ya cubre casos parecidos (multi-IVA, USD, sin NIF). No se ha copiado su capa de datos ni su `localStorage`: aquí ya hay base de datos real. |

### Guía legal de implementación v1.0 (29/10/2026)

| # | Decisión | Motivo / estado |
|---|---|---|
| D-53 | Aplicado de la guía (`CUENTAPP_guia_legal_implementacion.pdf`) lo que cabe en la demo académica: **aceptación** de Condiciones y acuerdo de encargo con casilla propia, comprobada en servidor y **guardada con versión e instante UTC** en `aceptaciones_legales` (migración 7, inmutable, sin IP); casilla **opcional** de novedades; rutas `/legal/{aviso-legal,privacidad,condiciones,encargo,cookies}` en pie y registro; textos en contexto (subida, archivo rechazado, lectura, buzón simulado, correo sin adjuntos, copia local sin Drive, semáforo «registrados revisados» y su descargo, ticket sin NIF, Excel, prueba sin tarjeta, precio «+ IVA» provisional); **Excel solo con validados por defecto** (opción explícita para incluir pendientes con su estado), columnas de moneda, total original, tipo de cambio BCE y referencia, y **protección de fórmulas** en textos de terceros. | Las páginas legales siguen «Texto pendiente»: la guía prohíbe publicarlas sin titular, NIF, domicilio y canal reales (PV-03). La versión aceptada es `pendiente-2026-10-29` hasta tener los textos. |
| D-54 | **Discrepancias con la guía, pendientes de decisión del equipo:** (1) **Baja**: la guía (art. 28.3.g RGPD) pide devolver o suprimir los documentos del cliente al terminar, con ventana de exportación (P: 30 días); D-42 los conserva indefinidamente → hay que decidir plazo y borrado. (2) Límites de subida: la guía propone PDF/JPEG/PNG, 15 MB y 20 páginas; aquí 10 MB, 3 páginas leídas y además WebP y SVG (solo descarga). (3) Verificación de email: requiere envío de correo, fuera del MVP local (la recuperación de contraseña ya existe con correo simulado, D-57). (4) La guía cita «sin categoría» como motivo de ámbar: ya hay campo categoría (D-56), pero un documento sin categoría **no** cambia el semáforo hasta que el equipo lo decida. (5) Los textos de lectura de la guía hablan de OCR **e IA**; aquí la lectura es OCR local sin IA, y el texto se ha adaptado. | Ninguna se ha cambiado sin el equipo. |

### Planes (29/10/2026)

| # | Decisión | Motivo / estado |
|---|---|---|
| D-55 | **Planes:** Prueba (14 días, 30 documentos), **Cuentapp 20 €/mes + IVA con 100 documentos al mes** (antes 250) y **Cuentapp Pro 40 €/mes + IVA con 300 documentos al mes** (nuevo); Despacho, próximamente. Migración 8 para bases existentes. El límite cuenta **documentos** (facturas completas y tickets), no solo facturas. Desde «Mi cuenta» se puede pasar de un plan de pago a otro (sin cobro en esta versión). | Decisión del equipo. Tratamiento del IVA, prorrateo al cambiar de plan a mitad de mes y qué pasa si se baja de Pro a Cuentapp con más de 100 documentos ese mes: `[A VERIFICAR]` (hoy: el cupo se recalcula al momento; lo ya subido no se toca). |

### Requisitos del RFQ que faltaban (29/10/2026)

Revisado el enunciado (`RFQ herramienta de gestion de facturas.pdf`) frente a la web. Solo se ha hecho lo que es código; la prueba con tickets reales, la justificación del modelo de negocio y la normativa van en los entregables del equipo.

| # | Decisión | Motivo / estado |
|---|---|---|
| D-56 | **Categoría del gasto** (requisito 3): columna `documentos.categoria` (migración 9) con una lista cerrada de 10 categorías (`src/dominio/categorias.ts`). La lectura la **sugiere** con palabras clave deterministas, primero por el emisor y después por el texto leído (sin IA, regla 5 de privacidad); si nada encaja queda «Sin categoría». Se corrige en la ficha, queda en el historial y sale en el Excel (columna «Categoría» y hoja «Por categoría») y en el panel. | La precisión de las palabras clave no está medida con tickets reales `[A VERIFICAR]`. Un documento sin categoría no cambia el semáforo (D-54.4). |
| D-57 | **Recuperación de contraseña** (requisito 1): «¿Has olvidado tu contraseña?» en /entrar → /recuperar → enlace de un solo uso que caduca en **30 minutos** (tabla `recuperaciones`, migración 10, solo el SHA-256 del token). Mismo mensaje exista o no la cuenta; freno de 3 peticiones por email y 30 globales cada 15 min; al cambiarla se **cierran todas las sesiones**. El enlace usa `URL_PUBLICA` (`src/config.ts`), nunca la cabecera Host. **MVP local: el correo no se envía**: se guarda en `datos/correos-salientes/` y se avisa en la consola del servidor. | En producción, proveedor de correo transaccional (SPF/DKIM/DMARC). Riesgo aceptado: el freno es global, sin IP (como el registro, D-51); y hay una pequeña diferencia de tiempo entre email existente (escribe el fichero) e inexistente. |
| D-58 | **Compartir desde el móvil** (requisito 2, tercera vía): el manifiesto declara `share_target`; con la app instalada, «Compartir → Cuentapp» desde el correo o las descargas manda el PDF o la foto a `/compartir`, que aplica las mismas reglas que la subida (`src/servidor/documentos/subir.ts`). Sin sesión, a /entrar; un `Origin` ajeno recibe 403. | Solo Android (Chrome, Edge, Samsung Internet); Safari en iPhone no admite `share_target`: allí siguen el buzón y la foto. No probado en un móvil real `[A VERIFICAR]`; exige HTTPS fuera de localhost. |
| D-59 | **Panel con cifras y avisos de plazo** (funciones adicionales «Panel con cifras» y «Avisos»): bloque del mes con documentos y gasto en euros **frente al mes anterior** (por fecha del documento, incluye pendientes) y gasto por categoría; aviso cuando faltan ≤ 15 días para cerrar el trimestre y durante el plazo general del modelo 303 (1-20 de abril, julio y octubre; 1-30 de enero), con el color del semáforo de ese trimestre. Nueva página **/precios** con tabla comparativa y preguntas frecuentes. | Plazos: los generales de la AEAT; con domiciliación el cargo se pide antes y puede haber prórrogas: el texto remite al gestor. «Cargo del banco sin justificante» exige conexión bancaria: descartado. |

### Cobro con Stripe en modo de pruebas (29/10/2026)

| # | Decisión | Motivo / estado |
|---|---|---|
| D-60 | **Stripe Checkout en modo de pruebas**, opcional. Con `STRIPE_SECRET_KEY=sk_test_…` en `.env.local`, «Activar / Cambiar a» en «Mi cuenta» lleva a la página de pago de Stripe (suscripción mensual, precio del plan **+ 21 % de IVA**: 24,20 € y 48,40 €); al volver, `/cuenta/pago` **pide la sesión a Stripe** y solo activa el plan si es de esta empresa, está pagada y coinciden plan e importe. Cada pago queda en `pagos` (migración 11, sesión UNIQUE: recargar no lo aplica dos veces). Al cambiar de plan se cancela la suscripción anterior; al darse de baja, todas. **Una clave `sk_live_` se ignora**. Sin clave, cambio sin cobro como en D-47. API REST con `fetch`, sin dependencias nuevas; no se envían a Stripe ni el email ni el nombre. | IVA del 21 % para todos: supuesto `[A VERIFICAR]` (clientes de Canarias, Ceuta, Melilla o de otro país de la UE con NIF-IVA tributan distinto). Sin prorrateo ni webhooks: si se cancela o falla una renovación desde Stripe, la app no se entera; en producción, webhooks firmados. No probado contra Stripe real (falta una cuenta con clave de pruebas): probado con respuestas simuladas. |

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
- **No hay Supabase Storage.** Los originales van a
  `datos/originales/<empresa_id>/<sha256>.<ext>` (fase 4, ver D-22).
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
| S-07 | Frankfurter publica tipos de referencia del BCE solo en días hábiles; para festivos y fines de semana devuelve el día hábil anterior. | **Verificado** el 29/10/2026 (06/09/2026 → 04/09/2026) |
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
| Correo entrante | Buzón simulado + subida de adjuntos + compartir desde el móvil | Proveedor de correo entrante (fuera de alcance) |
| Correo saliente | Fichero en `datos/correos-salientes/` (recuperación de contraseña) | Proveedor transaccional con SPF/DKIM/DMARC |
| Copia "Drive" | Carpeta local año/trimestre/categoría | Google Drive con OAuth `[A VERIFICAR]` |
| Cobro | Planes y límites; sin clave, cambio sin cobro; con `STRIPE_SECRET_KEY=sk_test_…`, Stripe Checkout en modo de pruebas (D-60) | Stripe en modo real, con webhooks, facturas e impuestos |
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
