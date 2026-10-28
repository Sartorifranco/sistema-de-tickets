-- Hojas de ruta nombradas (Hoja de ruta 1, 2, 3) y la fecha en que el técnico las usa.
-- depositario_ids NULL en la asignación significa "usar la hoja base".
-- Un array guarda el cambio de ese día y no toca la base.

CREATE TABLE IF NOT EXISTS technician_route_templates (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  depositario_ids JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tech_route_template_user (user_id, sort_order),
  CONSTRAINT fk_tech_route_template_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_route_assignments (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  route_date DATE NOT NULL,
  template_id INT NULL,
  depositario_ids JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_tech_route_date (route_date),
  KEY idx_tech_route_assignment_user (user_id),
  CONSTRAINT fk_tech_route_assignment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tech_route_assignment_template FOREIGN KEY (template_id) REFERENCES technician_route_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
