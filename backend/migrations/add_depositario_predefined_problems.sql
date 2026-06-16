-- Problemas predefinidos para tickets de depositarios / mantenimiento de equipos
-- Agrega "Atención remota" y "Error de software" en categorías relacionadas.
--
-- Ver categorías en tu BD:
--   SELECT id, name, company_id FROM ticket_categories ORDER BY name;
-- Ver problemas por categoría:
--   SELECT p.id, p.title, c.name FROM predefined_problems p
--   JOIN ticket_categories c ON c.id = p.category_id
--   WHERE p.title IN ('Atención remota', 'Error de software');

USE ticket_system;

SET @dep_mantenimiento := (
    SELECT id FROM departments
    WHERE UPPER(TRIM(name)) LIKE '%MANTENIMIENTO%'
    ORDER BY id
    LIMIT 1
);

SET @dep_mantenimiento := IFNULL(@dep_mantenimiento, 2);

-- Quitar inserciones previas en categorías que no son de depositarios/equipos
-- (usa subconsulta por id para compatibilidad con SQL_SAFE_UPDATES)
DELETE FROM predefined_problems
WHERE id IN (
    SELECT id FROM (
        SELECT pp.id
        FROM predefined_problems pp
        INNER JOIN ticket_categories tc ON tc.id = pp.category_id
        WHERE pp.title IN ('Atención remota', 'Error de software')
          AND NOT (
              UPPER(tc.name) LIKE '%DEPOSIT%'
              OR UPPER(tc.name) LIKE '%EQUIP%'
              OR UPPER(tc.name) LIKE '%CONTADOR%'
              OR UPPER(tc.name) LIKE '%CABEZAL%'
              OR UPPER(tc.name) LIKE '%BILL%'
              OR EXISTS (
                  SELECT 1 FROM tickets t
                  WHERE t.category_id = tc.id AND t.depositario_id IS NOT NULL
              )
          )
    ) AS ids_a_borrar
);

INSERT INTO predefined_problems (title, description, category_id, department_id)
SELECT 'Atención remota',
       'Soporte y diagnóstico remoto sobre el depositario o equipo.',
       tc.id,
       @dep_mantenimiento
FROM ticket_categories tc
WHERE tc.name NOT LIKE '%Area de%'
  AND (
      UPPER(tc.name) LIKE '%DEPOSIT%'
      OR UPPER(tc.name) LIKE '%EQUIP%'
      OR UPPER(tc.name) LIKE '%CONTADOR%'
      OR UPPER(tc.name) LIKE '%CABEZAL%'
      OR UPPER(tc.name) LIKE '%BILL%'
      OR EXISTS (
          SELECT 1 FROM tickets t
          WHERE t.category_id = tc.id AND t.depositario_id IS NOT NULL
      )
  )
  AND NOT EXISTS (
      SELECT 1 FROM predefined_problems pp
      WHERE pp.category_id = tc.id AND pp.title = 'Atención remota'
  );

INSERT INTO predefined_problems (title, description, category_id, department_id)
SELECT 'Error de software',
       'Fallo, bloqueo o comportamiento anómalo del software del equipo o depositario.',
       tc.id,
       @dep_mantenimiento
FROM ticket_categories tc
WHERE tc.name NOT LIKE '%Area de%'
  AND (
      UPPER(tc.name) LIKE '%DEPOSIT%'
      OR UPPER(tc.name) LIKE '%EQUIP%'
      OR UPPER(tc.name) LIKE '%CONTADOR%'
      OR UPPER(tc.name) LIKE '%CABEZAL%'
      OR UPPER(tc.name) LIKE '%BILL%'
      OR EXISTS (
          SELECT 1 FROM tickets t
          WHERE t.category_id = tc.id AND t.depositario_id IS NOT NULL
      )
  )
  AND NOT EXISTS (
      SELECT 1 FROM predefined_problems pp
      WHERE pp.category_id = tc.id AND pp.title = 'Error de software'
  );
