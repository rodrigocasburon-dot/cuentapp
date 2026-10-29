-- Migración 4 · Fase 6: corrección manual, validación y duplicados (RF-06, RF-07)
-- No pongas aquí PRAGMA user_version: lo fija migrar() con el número del fichero.

-- Columnas de auditoría y referencia en incidencias
ALTER TABLE incidencias ADD COLUMN resuelta_por TEXT REFERENCES usuarios(id);
ALTER TABLE incidencias ADD COLUMN motivo_resolucion TEXT;
ALTER TABLE incidencias ADD COLUMN documento_referencia_id TEXT REFERENCES documentos(id);

-- Marcado de descarte en documentos (los documentos nunca se borran: se marcan)
ALTER TABLE documentos ADD COLUMN descartado_en TEXT;
ALTER TABLE documentos ADD COLUMN descartado_por TEXT REFERENCES usuarios(id);

-- Trigger de aislamiento: el documento de referencia de una incidencia debe ser de la misma empresa
CREATE TRIGGER IF NOT EXISTS incidencias_referencia_misma_empresa
BEFORE INSERT ON incidencias
WHEN NEW.documento_referencia_id IS NOT NULL
 AND NEW.empresa_id IS NOT (SELECT empresa_id FROM documentos WHERE id = NEW.documento_referencia_id)
BEGIN
  SELECT RAISE(ABORT, 'El documento de referencia no pertenece a la misma empresa');
END;

CREATE TRIGGER IF NOT EXISTS incidencias_referencia_misma_empresa_upd
BEFORE UPDATE OF documento_referencia_id, empresa_id ON incidencias
WHEN NEW.documento_referencia_id IS NOT NULL
 AND NEW.empresa_id IS NOT (SELECT empresa_id FROM documentos WHERE id = NEW.documento_referencia_id)
BEGIN
  SELECT RAISE(ABORT, 'El documento de referencia no pertenece a la misma empresa');
END;
