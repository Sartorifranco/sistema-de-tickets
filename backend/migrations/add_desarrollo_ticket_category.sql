-- ticket_system: categoría DESARROLLO en ticket_categories + corrección de tickets mal etiquetados
-- La aplicación usa la tabla `ticket_categories` (no `categories`) para category_id en tickets.
-- Revisá nombres reales en tu BD con:
--   SELECT id, name, company_id FROM ticket_categories WHERE company_id = 1 OR company_id IS NULL;

USE ticket_system;

-- 1) Crear categoría DESARROLLO para empresa 1 (idempotente)
INSERT INTO ticket_categories (name, company_id)
SELECT 'DESARROLLO', 1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1
    FROM ticket_categories tc
    WHERE tc.name = 'DESARROLLO'
      AND tc.company_id <=> 1
);

-- 2) IDs necesarios
SET @cat_desarrollo := (
    SELECT id FROM ticket_categories
    WHERE name = 'DESARROLLO' AND company_id <=> 1
    ORDER BY id DESC
    LIMIT 1
);

-- Categoría "Implementaciones" mal usada para tickets del área Desarrollo (ajustá el LIKE si tus nombres difieren)
SET @cat_implementaciones := (
    SELECT id FROM ticket_categories
    WHERE company_id <=> 1
      AND (
          UPPER(TRIM(name)) = 'IMPLEMENTACIONES'
          OR UPPER(TRIM(name)) LIKE '%IMPLEMENTACION%'
      )
    ORDER BY id
    LIMIT 1
);

SET @dep_desarrollo := (
    SELECT id FROM departments
    WHERE LOWER(TRIM(name)) = 'desarrollo'
    LIMIT 1
);

-- 3) Corregir tickets: departamento Desarrollo pero categoría tipo Implementaciones
UPDATE tickets t
SET t.category_id = @cat_desarrollo
WHERE @cat_desarrollo IS NOT NULL
  AND @dep_desarrollo IS NOT NULL
  AND @cat_implementaciones IS NOT NULL
  AND t.department_id = @dep_desarrollo
  AND t.category_id = @cat_implementaciones;

-- Verificación opcional:
-- SELECT COUNT(*) FROM tickets WHERE department_id = @dep_desarrollo AND category_id = @cat_desarrollo;
