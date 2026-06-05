-- Módulo Gestión de Máquinas de Tesorería

CREATE TABLE IF NOT EXISTS treasury_machines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  brand VARCHAR(128) NOT NULL DEFAULT 'Glory',
  model VARCHAR(128) NOT NULL,
  serial_number VARCHAR(128) NOT NULL,
  location VARCHAR(255) NOT NULL,
  counted_bills INT NULL,
  status ENUM('operativa', 'reparacion', 'baja') NOT NULL DEFAULT 'operativa',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_treasury_serial (serial_number),
  INDEX idx_treasury_status (status),
  INDEX idx_treasury_type (type)
);

CREATE TABLE IF NOT EXISTS machine_maintenances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  machine_id INT NOT NULL,
  maintenance_type ENUM('preventivo', 'correctivo') NOT NULL,
  maintenance_date DATE NULL,
  user_id INT NULL,
  observations TEXT NOT NULL,
  previous_status ENUM('operativa', 'reparacion', 'baja') NOT NULL,
  new_status ENUM('operativa', 'reparacion', 'baja') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mm_machine FOREIGN KEY (machine_id) REFERENCES treasury_machines(id) ON DELETE CASCADE,
  CONSTRAINT fk_mm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_mm_machine (machine_id),
  INDEX idx_mm_created (created_at)
);
