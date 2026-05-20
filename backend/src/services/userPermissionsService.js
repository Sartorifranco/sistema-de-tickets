const pool = require('../config/db');
const {
    ALL_PERMISSION_KEYS,
    AGENT_ASSIGNABLE_KEYS,
    AGENT_DEFAULT_PRESET,
} = require('../constants/permissions');

async function loadUserPermissions(userId) {
    const [rows] = await pool.execute(
        'SELECT permission_key FROM user_permissions WHERE user_id = ?',
        [userId]
    );
    return rows.map((r) => r.permission_key);
}

async function loadUserAuthExtras(userId) {
    const [[userRow]] = await pool.execute(
        'SELECT role, is_super_admin FROM users WHERE id = ?',
        [userId]
    );
    if (!userRow) {
        return { is_super_admin: false, permissions: [] };
    }

    const role = userRow.role;
    const isSuperAdmin = role === 'admin' && !!userRow.is_super_admin;

    if (isSuperAdmin) {
        return { is_super_admin: true, permissions: ALL_PERMISSION_KEYS };
    }

    const stored = await loadUserPermissions(userId);

    if (stored.length > 0) {
        return { is_super_admin: false, permissions: stored };
    }

    if (role === 'agent') {
        return { is_super_admin: false, permissions: [...AGENT_DEFAULT_PRESET] };
    }

    return { is_super_admin: false, permissions: [] };
}

function isStaffWithRbac(user) {
    return user && (user.role === 'admin' || user.role === 'agent');
}

function userHasPermission(user, permissionKey) {
    if (!user) return false;
    if (user.is_super_admin) return true;
    if (!isStaffWithRbac(user)) return false;
    const list = user.permissions || [];
    return list.includes(permissionKey);
}

function userHasAnyPermission(user, keys) {
    if (!user) return false;
    if (user.is_super_admin) return true;
    if (!isStaffWithRbac(user)) return false;
    const list = user.permissions || [];
    return keys.some((k) => list.includes(k));
}

function userHasAllPermissions(user, keys) {
    if (!user) return false;
    if (user.is_super_admin) return true;
    if (!isStaffWithRbac(user)) return false;
    const list = user.permissions || [];
    return keys.every((k) => list.includes(k));
}

async function setUserPermissions(targetUserId, permissionKeys, isSuperAdmin) {
    const [[target]] = await pool.execute('SELECT role FROM users WHERE id = ?', [targetUserId]);
    if (!target) {
        throw new Error('Usuario no encontrado.');
    }

    let valid;
    if (target.role === 'agent') {
        valid = permissionKeys.filter((k) => AGENT_ASSIGNABLE_KEYS.includes(k));
    } else if (target.role === 'admin') {
        valid = permissionKeys.filter((k) => ALL_PERMISSION_KEYS.includes(k));
    } else {
        throw new Error('Solo admin y agente pueden tener permisos granulares.');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM user_permissions WHERE user_id = ?', [targetUserId]);
        for (const key of valid) {
            await conn.execute(
                'INSERT INTO user_permissions (user_id, permission_key) VALUES (?, ?)',
                [targetUserId, key]
            );
        }
        if (typeof isSuperAdmin === 'boolean' && target.role === 'admin') {
            await conn.execute('UPDATE users SET is_super_admin = ? WHERE id = ?', [
                isSuperAdmin ? 1 : 0,
                targetUserId,
            ]);
        }
        await conn.commit();
        return loadUserAuthExtras(targetUserId);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function buildAuthUserPayload(userRow) {
    const extras = await loadUserAuthExtras(userRow.id);
    return {
        id: userRow.id,
        username: userRow.username,
        email: userRow.email,
        role: userRow.role,
        company_id: userRow.company_id,
        department_id: userRow.department_id,
        company_name: userRow.company_name || null,
        is_super_admin: Boolean(extras.is_super_admin),
        permissions: extras.permissions,
    };
}

async function countSuperAdmins(excludeUserId = null) {
    let sql = "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_super_admin = 1";
    const params = [];
    if (excludeUserId) {
        sql += ' AND id != ?';
        params.push(excludeUserId);
    }
    const [[row]] = await pool.execute(sql, params);
    return row.c;
}

module.exports = {
    loadUserPermissions,
    loadUserAuthExtras,
    buildAuthUserPayload,
    userHasPermission,
    userHasAnyPermission,
    userHasAllPermissions,
    setUserPermissions,
    countSuperAdmins,
};
