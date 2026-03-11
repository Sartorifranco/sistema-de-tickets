-- Tabla para tokens FCM (soporta múltiples dispositivos por usuario)
-- Ejecutar: mysql -u root -p ticket_system < migrations/create_user_fcm_tokens.sql

CREATE TABLE IF NOT EXISTS user_fcm_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_token (token(191)),
    CONSTRAINT fk_user_fcm_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
