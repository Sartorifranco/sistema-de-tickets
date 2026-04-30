-- Teléfono de contacto opcional en tickets
-- Ejecutar en la base del sistema (p. ej. ticket_system)

ALTER TABLE tickets
ADD COLUMN telefono_contacto VARCHAR(64) NULL DEFAULT NULL
COMMENT 'Teléfono de contacto opcional del solicitante';
