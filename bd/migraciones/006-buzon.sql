-- Migración 6 · Fase 8: buzón de correo simulado (FA-02).
-- De cada documento llegado por correo guardamos quién lo envió y el asunto.
-- No pongas aquí PRAGMA user_version: lo fija migrar() con el número del fichero.

ALTER TABLE documentos ADD COLUMN correo_remitente TEXT;
ALTER TABLE documentos ADD COLUMN correo_asunto TEXT;
