-- Propietario, condición comercial y fecha de instalación de cada depositario.
-- La fecha estimada se guarda como el día 1 del mes codificado en el número de serie
-- (por ejemplo FD-1023-827 -> octubre 2023). install_date_source distingue esa
-- estimación de una fecha cargada a mano.
-- Aplicar con: node scripts/run-depositario-commercial-migration.js

ALTER TABLE depositarios
    ADD COLUMN owner VARCHAR(100) NULL AFTER serial_number,
    ADD COLUMN commercial_action VARCHAR(20) NULL AFTER owner,
    ADD COLUMN installed_on DATE NULL AFTER commercial_action,
    ADD COLUMN install_date_source VARCHAR(32) NULL AFTER installed_on;
