const db = require('../config/db.config');

exports.getRoles = async (req, res, next) => {
  try {

    const loggedUserRole = req.user.role;

    const roleMap = {
      SUPER_ADMIN: [
        'SUPER_ADMIN',
        'ADMIN',
        'AUDIT',
        'STAFF'
      ],

      ADMIN: [
        'AUDIT',
        'STAFF'
      ],

      STAFF: [],

      AUDIT: []
    };

    const allowedRoles =
      roleMap[loggedUserRole] || [];

    if (!allowedRoles.length) {
      return res.json([]);
    }

    const placeholders =
      allowedRoles.map(() => '?').join(',');

    const [rows] = await db.query(`
      SELECT
        id,
        role_name
      FROM roles
      WHERE role_name IN (${placeholders})
      ORDER BY id
    `, allowedRoles);

    res.json(rows);

  } catch (error) {
    next(error);
  }
};