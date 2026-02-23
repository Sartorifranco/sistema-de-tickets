-- Permite related_id como VARCHAR para soportar IDs de Firestore (compras)
-- Ejecutar: mysql -u user -p database < migrations/alter_notifications_related_id_varchar.sql
ALTER TABLE notifications MODIFY COLUMN related_id VARCHAR(64) NULL;
