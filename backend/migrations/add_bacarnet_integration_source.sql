-- Marca los tickets creados por la API de Bacarnet.
-- Nullable y sin backfill: los tickets ya existentes no se modifican.
-- Esos tickets se reconocen por el título "Bacarnet - ..." en áreas de Bacar.
-- Idempotente.

SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tickets'
      AND COLUMN_NAME = 'integration_source'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE tickets ADD COLUMN integration_source VARCHAR(32) NULL DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
