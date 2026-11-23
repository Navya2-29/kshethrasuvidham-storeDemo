const db = require("../config/db.config");
const permissions = require("../config/role-permissions");
const {
  hashPassword
} = require("../utils/password.util");

async function getRoleName(roleId) {
  const [rows] = await db.query(
    "SELECT role_name FROM roles WHERE id = ?",
    [roleId]
  );

  return rows.length
    ? rows[0].role_name
    : null;
}

function canManage(loggedRole, targetRole) {
  return permissions[loggedRole]
    ?.includes(targetRole);
}

exports.getAllUsers = async (loggedUser) => {

  const allowedRoles =
    permissions[loggedUser.role] || [];

  if (!allowedRoles.length) {
    return [];
  }

  const placeholders =
    allowedRoles.map(() => '?').join(',');

  const [rows] = await db.query(`
   SELECT
      u.id,
      u.username,
      u.email,
      u.mobile_number,
      u.is_active,
      u.role_id,
      r.role_name,
      u.last_login_at,
      u.created_at,
      u.updated_at
    FROM users u
    INNER JOIN roles r
      ON r.id = u.role_id
    WHERE u.is_active = 1
      AND r.role_name IN (?)
    ORDER BY u.id DESC
  `, [allowedRoles]);


  return rows;
};

exports.getUserById = async (
  loggedUser,
  id
) => {

  const [rows] = await db.query(`
    SELECT
      u.id,
      u.username,
      u.email,
      u.mobile_number,
      u.role_id,
      r.role_name,
      u.is_active
    FROM users u
    INNER JOIN roles r
      ON r.id = u.role_id
    WHERE u.id = ?
  `, [id]);

  if (!rows.length) {
    throw new Error("User not found");
  }

  const user = rows[0];

  if (
    !canManage(
      loggedUser.role,
      user.role_name
    )
  ) {
    throw new Error("No permission");
  }

  return user;
};

exports.createUser = async (
  loggedUser,
  data
) => {

  const targetRole =
    await getRoleName(data.role_id);

  if (
    !canManage(
      loggedUser.role,
      targetRole
    )
  ) {
    throw new Error(
      "No permission to create this role"
    );
  }

  const passwordHash =
    await hashPassword(data.password);

  await db.query(`
    INSERT INTO users
    (
      username,
      password,
      email,
      mobile_number,
      role_id,
      created_by
    )
    VALUES (?,?,?,?,?,?)
  `, [
    data.username,
    passwordHash,
    data.email,
    data.mobile_number,
    data.role_id,
    loggedUser.id
  ]);

  return true;
};

exports.updateUser = async (loggedUser, userId, data) => {

  const existing = await exports.getUserById(loggedUser, userId);

  if (!existing) {
    throw new Error("User not found");
  }

  if (!canManage(loggedUser.role, existing.role_name)) {
    throw new Error("No permission to update user");
  }

  const newRole = await getRoleName(data.role_id);

  if (!canManage(loggedUser.role, newRole)) {
    throw new Error("No permission to assign role");
  }

  if (!data.password || data.password === "") {
    delete data.password;
  }

  const fields = [
    "username = ?",
    "email = ?",
    "mobile_number = ?",
    "role_id = ?",
    "updated_by = ?"
  ];

  const values = [
    data.username,
    data.email,
    data.mobile_number,
    data.role_id,
    loggedUser.id
  ];

  if (data.password) {
    const hashedPassword = await hashPassword(data.password);
    fields.push("password = ?");
    values.push(hashedPassword);
  }

  values.push(userId);

  await db.query(`
    UPDATE users
    SET ${fields.join(", ")}
    WHERE id = ?
  `, values);

  // 👇 RETURN MESSAGE HERE
  return {
    message: "User updated successfully"
  };
};

exports.deleteUser = async (loggedUser, userId) => {

  const existing = await exports.getUserById(loggedUser, userId);

  if (!existing) {
    throw new Error("User not found");
  }

  await db.query(`
    UPDATE users
    SET is_active = 0,
        updated_by = ?
    WHERE id = ?
  `, [
    loggedUser.id,
    userId
  ]);

  return true;
};

// ============================================
// CHANGE PASSWORD
// ============================================
exports.changePassword = async (
  loggedUser,
  userId,
  password
) => {

  // ----------------------------
  // VALIDATION
  // ----------------------------
  if (!userId) {
    throw new Error("User id required");
  }

  if (!password || password.trim() === "") {
    throw new Error("Password required");
  }

  if (password.length < 6) {
    throw new Error(
      "Password must be minimum 6 characters"
    );
  }

  // ----------------------------
  // GET TARGET USER
  // ----------------------------
  const [rows] = await db.query(`
    SELECT
      u.id,
      r.role_name
    FROM users u
    INNER JOIN roles r
      ON r.id = u.role_id
    WHERE u.id = ?
      AND u.is_active = 1
  `, [userId]);

  if (!rows.length) {
    throw new Error("User not found");
  }

  const targetUser = rows[0];

  // ----------------------------
  // PERMISSION CHECK
  // Self password change OR role permission
  // ----------------------------
  const isSelf =
    Number(loggedUser.id) === Number(userId);

  const allowed =
    canManage(
      loggedUser.role,
      targetUser.role_name
    );

  if (!isSelf && !allowed) {
    throw new Error("No permission");
  }

  // ----------------------------
  // HASH PASSWORD
  // ----------------------------
  const passwordHash =
    await hashPassword(password);

  // ----------------------------
  // UPDATE
  // ----------------------------
  await db.query(`
    UPDATE users
    SET
      password = ?,
      updated_by = ?,
      updated_at = NOW()
    WHERE id = ?
  `, [
    passwordHash,
    loggedUser.id,
    userId
  ]);

  // ----------------------------
  // RESPONSE
  // ----------------------------
  return {
    user_id: Number(userId)
  };
};