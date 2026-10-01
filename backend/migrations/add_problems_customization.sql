-- Personalización del módulo Problemáticas
--
-- predefined_problems:
--   is_active        -> permite ocultar un problema del formulario de tickets sin borrarlo
--   sort_order       -> orden en que aparece dentro de su categoría
--   default_priority -> prioridad sugerida que se precarga al elegir el problema
--
-- ticket_categories:
--   is_active        -> permite ocultar una categoría del formulario sin borrarla
--   sort_order       -> orden en que aparece en el desplegable
--
-- Idempotente: el script scripts/run-problems-customization-migration.js
-- revisa information_schema y solo agrega las columnas que faltan.
-- Si preferís aplicarlo a mano, ejecutá las sentencias de abajo una por una
-- (MySQL devuelve "Duplicate column name" si ya existe: se puede ignorar).

USE ticket_system;

ALTER TABLE predefined_problems
    ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE predefined_problems
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

ALTER TABLE predefined_problems
    ADD COLUMN default_priority ENUM('low', 'medium', 'high', 'urgent') NULL DEFAULT NULL;

ALTER TABLE ticket_categories
    ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE ticket_categories
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0;
