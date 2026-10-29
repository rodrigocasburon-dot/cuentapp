-- Migración 3 · Fase 5: lectura automática (RF-05)
-- No pongas aquí PRAGMA user_version: lo fija migrar() con el número del fichero.

-- Resultado de las validaciones deterministas, como lista JSON:
-- [{"codigo": "descuadre_total", "nivel": "ambar", "texto": "..."}, ...]
ALTER TABLE documentos ADD COLUMN avisos_json TEXT;
-- Cuándo terminó la lectura automática (NULL = todavía no)
ALTER TABLE documentos ADD COLUMN procesado_en TEXT;
-- Desde cuándo está en "procesando" (para recuperar los que se quedaron a medias)
ALTER TABLE documentos ADD COLUMN procesando_desde TEXT;

-- Caché de tipos de cambio (datos de referencia del BCE vía Frankfurter;
-- no pertenecen a ninguna empresa). 1 EUR = valor unidades de la moneda.
CREATE TABLE tipos_cambio (
  moneda        TEXT NOT NULL CHECK (length(moneda) = 3),
  fecha_pedida  TEXT NOT NULL,   -- fecha del documento
  fecha_bce     TEXT NOT NULL,   -- día hábil cuyo tipo se aplica (fines de semana y festivos → el anterior)
  valor         REAL NOT NULL CHECK (valor > 0),
  PRIMARY KEY (moneda, fecha_pedida)
);
