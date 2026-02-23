-- Migration: Agregar roles 'boss' y 'purchasing' al módulo de compras
-- Ejecutar: mysql -u root -p ticket_system < migrations/add_purchase_roles_to_users.sql
-- O copiar y pegar en phpMyAdmin / MySQL Workbench

-- IMPORTANTE: Verifique primero el tipo de la columna role:
--   SHOW COLUMNS FROM users LIKE 'role';

-- OPCIÓN 1: Si la columna 'role' es ENUM, ejecute este ALTER
-- (Si falla, probablemente sea VARCHAR; use OPCIÓN 2)
-- ALTER TABLE users 
-- MODIFY COLUMN role ENUM('admin', 'agent', 'client', 'boss', 'purchasing') NOT NULL 
-- DEFAULT 'client'
-- COMMENT 'admin, agent, client, boss (jefe depto), purchasing (encargado compras)';

-- OPCIÓN 2: Si la columna 'role' es VARCHAR, NO ejecute el ALTER anterior.
-- Los valores 'boss' y 'purchasing' funcionarán directamente.
-- Asignar roles manualmente o desde el panel Admin:
--   UPDATE users SET role = 'boss', department_id = <id_depto> WHERE id = <id_jefe>;
--   UPDATE users SET role = 'purchasing' WHERE id = <id_encargado_compras>;
