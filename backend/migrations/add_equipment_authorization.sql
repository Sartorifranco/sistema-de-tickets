-- Autorización de solicitudes de nuevo equipamiento.
-- Aplicar con: node scripts/run-equipment-authorization-migration.js (idempotente)

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Un registro por autorizante notificado. Cuando uno decide, el resto queda 'cancelled'.
CREATE TABLE IF NOT EXISTS ticket_authorizations (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    request_data JSON NULL,
    approver_name VARCHAR(150) NULL,
    approver_email VARCHAR(255) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    email_sent_at DATETIME NULL,
    email_error VARCHAR(500) NULL,
    decided_at DATETIME NULL,
    decision_note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ticket_authorizations_token (token_hash),
    KEY idx_ticket_authorizations_ticket (ticket_id),
    CONSTRAINT fk_ticket_authorizations_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Problemática "Solicitud de nuevo equipamiento" en Hardware y Periféricos (la agrega el script si falta).
