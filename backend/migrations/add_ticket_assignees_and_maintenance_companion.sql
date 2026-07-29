-- Multi-asignación de agentes en tickets + acompañante tipado en mantenimientos
-- También asegura la categoría usada por el ticket automático de mantenimiento.

USE ticket_system;

CREATE TABLE IF NOT EXISTS ticket_assignees (
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ticket_id, user_id),
    KEY idx_ticket_assignees_user (user_id)
);

-- Backfill: responsable actual como assignee primario
INSERT IGNORE INTO ticket_assignees (ticket_id, user_id, is_primary)
SELECT id, assigned_to_user_id, 1
FROM tickets
WHERE assigned_to_user_id IS NOT NULL;

-- Acompañante como usuario del sistema (además de companion_name legado)
SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'mantenimientos'
      AND COLUMN_NAME = 'companion_user_id'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE mantenimientos ADD COLUMN companion_user_id INT NULL AFTER companion_name',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Categoría fija para tickets auto de mantenimiento
INSERT INTO ticket_categories (name, company_id)
SELECT 'Problemas de depositarios (General)', NULL
WHERE NOT EXISTS (
    SELECT 1 FROM ticket_categories
    WHERE TRIM(name) = 'Problemas de depositarios (General)'
);
