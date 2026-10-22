CREATE TABLE IF NOT EXISTS technician_route_plans (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  weekday TINYINT NOT NULL COMMENT '1=lunes ... 7=domingo',
  depositario_ids JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_tech_route_day (user_id, weekday),
  CONSTRAINT fk_tech_route_plan_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
