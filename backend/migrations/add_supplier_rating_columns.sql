-- Script para agregar columnas de calificación (scoring) a proveedores
-- Ejecutar: mysql -u root -p ticket_system < migrations/add_supplier_rating_columns.sql
-- Promedio del proveedor = rating_sum / rating_count (cuando rating_count > 0)

ALTER TABLE users ADD COLUMN rating_sum INT DEFAULT 0;
ALTER TABLE users ADD COLUMN rating_count INT DEFAULT 0;

-- Si las columnas ya existen, MySQL dará error "Duplicate column name". En ese caso, omite este script.
