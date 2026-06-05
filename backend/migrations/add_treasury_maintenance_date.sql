-- Fecha del mantenimiento (puede diferir de created_at si se carga a posteriori)
ALTER TABLE machine_maintenances
  ADD COLUMN maintenance_date DATE NULL AFTER maintenance_type;

UPDATE machine_maintenances
SET maintenance_date = DATE(created_at)
WHERE maintenance_date IS NULL;
