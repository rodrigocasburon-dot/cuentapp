-- =====================================================================
-- Cuentapp · Esquema de la base de datos (MVP local, SQLite)
-- =====================================================================
-- Convenciones:
--   * Identificadores: texto UUID generado en la aplicación.
--   * Fechas: texto ISO 8601 (AAAA-MM-DD o AAAA-MM-DDTHH:MM:SSZ).
--   * Importes: ENTEROS en céntimos para evitar errores de redondeo
--     (12,34 € se guarda como 1234). Nunca REAL para dinero.
--   * Toda tabla con datos de cliente lleva empresa_id. SQLite no tiene
--     RLS: el aislamiento lo impone src/servidor/bd/repositorio.ts y lo
--     comprueban las pruebas de tests/aislamiento.test.ts.
--   * En producción (Supabase/Postgres) cada tabla tendría además una
--     política RLS "empresa_id in (empresas del usuario)". Ver SUPUESTOS.md.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- Versión del esquema. Súbela cada vez que cambies este fichero: el servidor
-- se niega a arrancar con una base de datos de otra versión (ver conexion.ts).
-- 1 = fase 1 · 2 = fase 3 (sesiones con hash, intentos de acceso)
PRAGMA user_version = 2;

-- ---------------------------------------------------------------------
-- Planes de suscripción (datos de referencia, no pertenecen a ninguna empresa)
-- ---------------------------------------------------------------------
CREATE TABLE planes (
  id                TEXT PRIMARY KEY CHECK (id IN ('prueba', 'cuentapp', 'despacho')),
  nombre            TEXT    NOT NULL,
  precio_centimos   INTEGER NOT NULL CHECK (precio_centimos >= 0),  -- sin IVA, al mes
  limite_docs_mes   INTEGER,          -- NULL = sin límite definido (Despacho)
  limite_docs_total INTEGER,          -- solo Prueba: 30 documentos en total
  dias_prueba       INTEGER,          -- solo Prueba: 14 días
  disponible        INTEGER NOT NULL DEFAULT 1 CHECK (disponible IN (0, 1))  -- Despacho = 0 ("próximamente")
);

-- ---------------------------------------------------------------------
-- Empresas (el "inquilino": todo lo demás cuelga de aquí)
-- ---------------------------------------------------------------------
CREATE TABLE empresas (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  nif           TEXT,                              -- NIF/CIF de la propia empresa (receptor de sus facturas)
  plan_id       TEXT NOT NULL REFERENCES planes(id),
  prueba_hasta  TEXT,                              -- fin del periodo de prueba
  buzon         TEXT NOT NULL UNIQUE,              -- dirección del buzón simulado (FA-02)
  creada_en     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------------
-- Usuarios y membresías (un usuario pertenece a una o más empresas)
-- En el MVP cada usuario tendrá una sola empresa, pero el modelo admite más.
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  hash_contrasena  TEXT NOT NULL,                  -- scrypt con sal; nunca la contraseña en claro
  nombre           TEXT NOT NULL,
  creado_en        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE membresias (
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id),
  empresa_id  TEXT NOT NULL REFERENCES empresas(id),
  rol         TEXT NOT NULL DEFAULT 'titular' CHECK (rol IN ('titular', 'miembro')),
  PRIMARY KEY (usuario_id, empresa_id)
);

-- Sesiones de acceso (RF-01). El navegador guarda un token aleatorio en una
-- cookie; aquí solo guardamos su SHA-256. Si alguien copia la base de datos,
-- no puede usar estas filas para entrar.
-- La sesión vale solo mientras exista la membresía (usuario, empresa).
CREATE TABLE sesiones (
  id          TEXT PRIMARY KEY CHECK (length(id) = 64),  -- sha256(token) en hexadecimal
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id),
  empresa_id  TEXT NOT NULL REFERENCES empresas(id),
  expira_en   TEXT NOT NULL,
  creada_en   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Intentos de acceso fallidos, para frenar a quien prueba contraseñas.
CREATE TABLE intentos_acceso (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  clave      TEXT NOT NULL,                        -- email normalizado
  creado_en  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX intentos_acceso_clave ON intentos_acceso (clave, creado_en);

-- ---------------------------------------------------------------------
-- Periodos (trimestres) por empresa
-- ---------------------------------------------------------------------
CREATE TABLE periodos (
  id          TEXT PRIMARY KEY,
  empresa_id  TEXT NOT NULL REFERENCES empresas(id),
  anio        INTEGER NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  trimestre   INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  UNIQUE (empresa_id, anio, trimestre)
);

-- ---------------------------------------------------------------------
-- Documentos (facturas completas y tickets simplificados)
-- ---------------------------------------------------------------------
CREATE TABLE documentos (
  id               TEXT PRIMARY KEY,
  empresa_id       TEXT NOT NULL REFERENCES empresas(id),
  periodo_id       TEXT REFERENCES periodos(id),   -- NULL hasta conocer la fecha del documento

  -- Original: se escribe una vez y no se modifica nunca (ver triggers abajo)
  origen           TEXT NOT NULL CHECK (origen IN ('subida', 'buzon')),
  nombre_original  TEXT NOT NULL,
  mime             TEXT NOT NULL,
  tamano_bytes     INTEGER NOT NULL CHECK (tamano_bytes > 0),
  ruta_original    TEXT NOT NULL,                  -- relativa a la carpeta de originales
  hash_sha256      TEXT NOT NULL CHECK (length(hash_sha256) = 64),

  -- Ciclo de vida
  estado           TEXT NOT NULL DEFAULT 'recibido' CHECK (estado IN
                     ('recibido', 'procesando', 'pendiente_revision', 'validado', 'incidencia')),
  tipo             TEXT CHECK (tipo IN ('factura_completa', 'ticket_simplificado')),  -- valor vigente
  tipo_detectado   TEXT CHECK (tipo_detectado IN ('factura_completa', 'ticket_simplificado')),  -- lo que dijo el lector

  -- Campos extraídos (valor vigente, ya corregido por el usuario si procede)
  nif_emisor       TEXT,
  nombre_emisor    TEXT,
  nif_receptor     TEXT,
  numero           TEXT,
  fecha_emision    TEXT,
  moneda           TEXT CHECK (moneda IS NULL OR length(moneda) = 3),  -- ISO 4217: EUR, USD...
  base_centimos    INTEGER,                        -- suma de bases (moneda original)
  cuota_centimos   INTEGER,                        -- suma de cuotas de IVA (moneda original)
  total_centimos   INTEGER,                        -- total (moneda original)
  tipo_cambio      REAL,                           -- 1 EUR = x moneda; NULL si moneda = EUR
  fecha_cambio     TEXT,                           -- fecha del tipo de cambio aplicado
  total_eur_centimos INTEGER,

  -- Salida del lector tal como llegó (JSON validado con zod) y confianza por campo
  extraccion_json  TEXT,                           -- inmutable por ejecución: sirve para auditar al motor
  confianza_json   TEXT,                           -- {"nif_emisor": 0.93, "total": 0.71, ...}
  motor_lectura    TEXT,                           -- p. ej. "tesseract-5.5" (fase 2)

  validado_en      TEXT,
  validado_por     TEXT REFERENCES usuarios(id),
  creado_en        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  -- Un documento validado debe tener quién y cuándo
  CHECK (estado <> 'validado' OR (validado_en IS NOT NULL AND validado_por IS NOT NULL))
);

CREATE INDEX documentos_empresa_periodo ON documentos (empresa_id, periodo_id);
CREATE INDEX documentos_empresa_hash    ON documentos (empresa_id, hash_sha256);  -- duplicados exactos (RF-07)

-- Desglose de IVA: un documento puede tener varios tipos (21 %, 10 %, 4 %...)
CREATE TABLE lineas_iva (
  id              TEXT PRIMARY KEY,
  empresa_id      TEXT NOT NULL REFERENCES empresas(id),
  documento_id    TEXT NOT NULL REFERENCES documentos(id),
  tipo_iva        REAL    NOT NULL CHECK (tipo_iva >= 0 AND tipo_iva <= 100),
  base_centimos   INTEGER NOT NULL,
  cuota_centimos  INTEGER NOT NULL
);

-- Correcciones manuales (RF-06): historial de quién cambió qué
CREATE TABLE correcciones (
  id              TEXT PRIMARY KEY,
  empresa_id      TEXT NOT NULL REFERENCES empresas(id),
  documento_id    TEXT NOT NULL REFERENCES documentos(id),
  campo           TEXT NOT NULL,
  valor_anterior  TEXT,
  valor_nuevo     TEXT,
  usuario_id      TEXT NOT NULL REFERENCES usuarios(id),
  creada_en       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------------
-- Incidencias (alimentan el semáforo del trimestre)
-- ---------------------------------------------------------------------
CREATE TABLE incidencias (
  id            TEXT PRIMARY KEY,
  empresa_id    TEXT NOT NULL REFERENCES empresas(id),
  documento_id  TEXT NOT NULL REFERENCES documentos(id),
  tipo          TEXT NOT NULL CHECK (tipo IN
                  ('duplicado', 'ilegible', 'documental', 'campo_dudoso', 'falta_nif')),
  bloqueante    INTEGER NOT NULL CHECK (bloqueante IN (0, 1)),  -- 1 = rojo en el semáforo
  estado        TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'resuelta')),
  descripcion   TEXT NOT NULL,
  creada_en     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  resuelta_en   TEXT
);

-- ---------------------------------------------------------------------
-- Uso mensual (contador para aplicar los límites del plan)
-- ---------------------------------------------------------------------
CREATE TABLE uso_mensual (
  empresa_id  TEXT NOT NULL REFERENCES empresas(id),
  mes         TEXT NOT NULL CHECK (mes GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),  -- AAAA-MM
  documentos  INTEGER NOT NULL DEFAULT 0 CHECK (documentos >= 0),
  PRIMARY KEY (empresa_id, mes)
);

-- =====================================================================
-- Garantías de integridad (triggers)
-- =====================================================================

-- 1) El original es inmutable: no se puede cambiar su ruta, hash, tamaño,
--    tipo MIME, nombre ni la empresa a la que pertenece.
CREATE TRIGGER documentos_original_inmutable
BEFORE UPDATE OF origen, nombre_original, mime, tamano_bytes, ruta_original, hash_sha256, empresa_id
ON documentos
BEGIN
  SELECT RAISE(ABORT, 'El original de un documento no se puede modificar');
END;

-- 2) Los documentos no se borran en el MVP (perder un original bloquea la entrega).
CREATE TRIGGER documentos_sin_borrado
BEFORE DELETE ON documentos
BEGIN
  SELECT RAISE(ABORT, 'Los documentos no se pueden borrar');
END;

-- 3) La salida original del lector no se reescribe una vez guardada.
CREATE TRIGGER documentos_extraccion_inmutable
BEFORE UPDATE OF extraccion_json ON documentos
WHEN OLD.extraccion_json IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'La extracción original no se puede reescribir; usa correcciones');
END;

-- 4) Las filas hijas deben pertenecer a la misma empresa que su documento.
--    Así una línea, corrección o incidencia nunca puede "colarse" en otra empresa.
CREATE TRIGGER lineas_iva_misma_empresa
BEFORE INSERT ON lineas_iva
WHEN NEW.empresa_id IS NOT (SELECT empresa_id FROM documentos WHERE id = NEW.documento_id)
BEGIN
  SELECT RAISE(ABORT, 'La línea de IVA no pertenece a la empresa del documento');
END;

CREATE TRIGGER correcciones_misma_empresa
BEFORE INSERT ON correcciones
WHEN NEW.empresa_id IS NOT (SELECT empresa_id FROM documentos WHERE id = NEW.documento_id)
BEGIN
  SELECT RAISE(ABORT, 'La corrección no pertenece a la empresa del documento');
END;

CREATE TRIGGER incidencias_misma_empresa
BEFORE INSERT ON incidencias
WHEN NEW.empresa_id IS NOT (SELECT empresa_id FROM documentos WHERE id = NEW.documento_id)
BEGIN
  SELECT RAISE(ABORT, 'La incidencia no pertenece a la empresa del documento');
END;

CREATE TRIGGER documentos_periodo_misma_empresa
BEFORE UPDATE OF periodo_id ON documentos
WHEN NEW.periodo_id IS NOT NULL
 AND NEW.empresa_id IS NOT (SELECT empresa_id FROM periodos WHERE id = NEW.periodo_id)
BEGIN
  SELECT RAISE(ABORT, 'El periodo no pertenece a la empresa del documento');
END;

CREATE TRIGGER documentos_periodo_misma_empresa_ins
BEFORE INSERT ON documentos
WHEN NEW.periodo_id IS NOT NULL
 AND NEW.empresa_id IS NOT (SELECT empresa_id FROM periodos WHERE id = NEW.periodo_id)
BEGIN
  SELECT RAISE(ABORT, 'El periodo no pertenece a la empresa del documento');
END;

-- 5) Mantener actualizado_en al día
CREATE TRIGGER documentos_actualizado_en
AFTER UPDATE ON documentos
WHEN NEW.actualizado_en = OLD.actualizado_en
BEGIN
  UPDATE documentos SET actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id;
END;
