-- RBAC: permisos granulares por usuario admin
ALTER TABLE users
  ADD COLUMN is_super_admin TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INT NOT NULL,
  permission_key VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_key),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Los admins existentes conservan acceso total hasta que se configure lo contrario
UPDATE users SET is_super_admin = 1 WHERE role = 'admin';
