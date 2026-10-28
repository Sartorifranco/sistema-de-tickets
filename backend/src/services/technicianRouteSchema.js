/**
 * Deja las hojas de ruta compartidas: una sola fila por fecha.
 * Es idempotente. Se corre al arrancar el backend y también a mano
 * con scripts/run-technician-route-shared-migration.js
 */

const TEMPLATES_SQL = `
CREATE TABLE IF NOT EXISTS technician_route_templates (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  depositario_ids JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tech_route_template_user (user_id, sort_order),
  CONSTRAINT fk_tech_route_template_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const ASSIGNMENTS_SQL = `
CREATE TABLE IF NOT EXISTS technician_route_assignments (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  route_date DATE NOT NULL,
  template_id INT NULL,
  depositario_ids JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_tech_route_date (route_date),
  KEY idx_tech_route_assignment_user (user_id),
  CONSTRAINT fk_tech_route_assignment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tech_route_assignment_template FOREIGN KEY (template_id) REFERENCES technician_route_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

async function indexExists(db, table, name) {
    const [rows] = await db.query(
        `SELECT 1 AS ok
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
         LIMIT 1`,
        [table, name]
    );
    return rows.length > 0;
}

async function ensureSharedTechnicianRoutes(db) {
    await db.query(TEMPLATES_SQL);
    await db.query(ASSIGNMENTS_SQL);

    if (!(await indexExists(db, 'technician_route_assignments', 'idx_tech_route_assignment_user'))) {
        await db.query(
            'ALTER TABLE technician_route_assignments ADD KEY idx_tech_route_assignment_user (user_id)'
        );
    }

    await db.query(
        `DELETE a FROM technician_route_assignments a
         INNER JOIN (
            SELECT route_date, MAX(id) AS keep_id
            FROM technician_route_assignments
            GROUP BY route_date
            HAVING COUNT(*) > 1
         ) d ON a.route_date = d.route_date AND a.id <> d.keep_id`
    );

    if (await indexExists(db, 'technician_route_assignments', 'uniq_tech_route_assignment')) {
        await db.query('ALTER TABLE technician_route_assignments DROP INDEX uniq_tech_route_assignment');
    }
    if (!(await indexExists(db, 'technician_route_assignments', 'uniq_tech_route_date'))) {
        await db.query(
            'ALTER TABLE technician_route_assignments ADD UNIQUE KEY uniq_tech_route_date (route_date)'
        );
    }
}

module.exports = { ensureSharedTechnicianRoutes };
