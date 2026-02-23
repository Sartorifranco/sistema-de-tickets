-- Columna para almacenar token FCM (Push Notifications)
ALTER TABLE users ADD COLUMN fcm_token VARCHAR(256) NULL;
