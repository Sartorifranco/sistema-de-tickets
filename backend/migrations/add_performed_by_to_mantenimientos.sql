-- Agrega la columna 'performed_by' para registrar si el mantenimiento lo realizó Permaquim o Bacar
-- Ejecutar en MySQL desde la carpeta backend:
--   mysql -u root -p ticket_system < migrations/add_performed_by_to_mantenimientos.sql
-- O copiar y pegar en phpMyAdmin / MySQL Workbench

ALTER TABLE mantenimientos 
ADD COLUMN performed_by VARCHAR(20) NULL DEFAULT NULL 
COMMENT 'permaquim o bacar';
