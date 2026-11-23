const db = require("../config/db.config");
const { comparePassword } = require("../utils/password.util");
const { generateAccessToken } = require("../utils/jwt.util");

exports.login = async (username, password) => {
  const [rows] = await db.query(
    `SELECT u.id, u.username, u.password,u.email,u.mobile_number, r.role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = ? AND u.is_active = 1`,
    [username]
  );

  if (!rows.length) {
    const err = new Error("Invalid credentials");
    err.statusCode = 401;
    throw err;
  }

  const user = rows[0];

  const match = await comparePassword(password, user.password);
  if (!match) {
    const err = new Error("Invalid credentials");
    err.statusCode = 401;
    throw err;
  }

  // update last login (optional)
  await db.query(
    `UPDATE users SET last_login_at = NOW() WHERE id = ?`,
    [user.id]
  );

  const accessToken = generateAccessToken({
    id: user.id,
    role: user.role_name,
  });

  return { accessToken, user };
};