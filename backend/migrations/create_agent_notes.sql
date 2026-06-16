-- Notas rápidas del dashboard de agentes
CREATE TABLE IF NOT EXISTS agent_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_agent_notes_agent (agent_id),
    CONSTRAINT fk_agent_notes_user FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
