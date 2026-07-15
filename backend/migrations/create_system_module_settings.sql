-- Visibilidad global de módulos (admin Configuración)
USE ticket_system;

CREATE TABLE IF NOT EXISTS system_module_settings (
    module_key VARCHAR(64) NOT NULL PRIMARY KEY,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO system_module_settings (module_key, is_enabled) VALUES
    ('companies', 1),
    ('depositarios', 1),
    ('treasury', 1),
    ('monitoring', 1),
    ('locations', 1),
    ('problems', 1),
    ('reports', 1),
    ('purchases', 1)
ON DUPLICATE KEY UPDATE module_key = module_key;
