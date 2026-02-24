-- Añadir campo rubro a proveedores para filtrado inteligente por categoría
-- Ejecutar: mysql -u root -p ticket_system < migrations/add_supplier_rubro.sql
-- Si la columna ya existe, ignorar el error.

ALTER TABLE users ADD COLUMN supplier_rubro VARCHAR(100) NULL
    COMMENT 'Rubro del proveedor (ej: Tecnología / IT, Librería) para matching con solicitudes';
