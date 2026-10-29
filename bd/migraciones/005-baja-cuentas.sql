-- Migración 5: baja de cuentas (D-42).
-- No se borra nada: la empresa y su usuario quedan marcados y ya no pueden
-- entrar; los documentos y originales se conservan (D-06, S-08).
-- No pongas aquí PRAGMA user_version: lo fija migrar() con el número del fichero.

ALTER TABLE empresas ADD COLUMN baja_en TEXT;
ALTER TABLE usuarios ADD COLUMN baja_en TEXT;
