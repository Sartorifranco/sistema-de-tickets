-- Fase 1 integración GitHub: ajustes por usuario + repo en tickets de desarrollo
-- Ejecutar sobre la base del sistema (p. ej. USE ticket_system;)

CREATE TABLE IF NOT EXISTS developer_settings (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    github_username VARCHAR(255) NULL DEFAULT NULL,
    github_token_encrypted TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_developer_settings_user (user_id),
    CONSTRAINT fk_developer_settings_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tickets
    ADD COLUMN github_repo VARCHAR(255) NULL DEFAULT NULL
    COMMENT 'owner/repo de GitHub para tickets de Desarrollo';
