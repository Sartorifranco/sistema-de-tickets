-- Migration: Preferencias de notificación (Fase 3 - Módulo Compras)
-- Ejecutar: mysql -u root -p ticket_system < migrations/add_notification_preferences.sql

-- Agregar columnas de preferencias de notificación
ALTER TABLE users 
ADD COLUMN notification_email VARCHAR(255) NULL,
ADD COLUMN whatsapp_number VARCHAR(30) NULL,
ADD COLUMN push_enabled BOOLEAN NOT NULL DEFAULT TRUE;
