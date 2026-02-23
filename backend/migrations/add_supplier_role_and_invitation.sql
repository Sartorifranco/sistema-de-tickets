-- Migration: Rol supplier + campos para invitación de proveedores
-- Ejecutar: node run-supplier-migration.js (o vía mysql directamente)

-- 1. Agregar 'supplier' al ENUM de role
ALTER TABLE users 
MODIFY COLUMN role ENUM('admin', 'agent', 'client', 'boss', 'purchasing', 'supplier') NOT NULL 
DEFAULT 'client';

-- 2. Campos para link de invitación (proveedor establece contraseña por primera vez)
ALTER TABLE users 
ADD COLUMN supplier_invitation_token VARCHAR(64) NULL,
ADD COLUMN supplier_invitation_expires DATETIME NULL;
