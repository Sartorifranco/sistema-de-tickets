CREATE TABLE IF NOT EXISTS technician_route_day_sheets (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  route_date DATE NOT NULL,
  depositario_ids JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_tech_route_date (user_id, route_date),
  CONSTRAINT fk_tech_route_day_sheet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
