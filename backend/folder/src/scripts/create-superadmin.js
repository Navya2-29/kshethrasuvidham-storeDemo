require("dotenv").config();
const db = require("../config/db.config");
const { hashPassword } = require("../utils/password.util");

async function createSuperAdmin() {

  try {

    // =========================
    // 1. CHECK IF EXISTS
    // =========================
    const [existing] = await db.query(`
      SELECT id FROM users WHERE role_id = ? AND username = ?
    `, [1, "superadmin"]);

    if (existing.length > 0) {
      console.log("⚠️ Super Admin already exists");
      return;
    }

    // =========================
    // 2. HASH PASSWORD
    // =========================
    const passwordHash = await hashPassword("Super@123");

    // =========================
    // 3. INSERT USER
    // =========================
    await db.query(`
      INSERT INTO users (
        username,
        password,
        email,
        mobile_number,
        role_id,
        is_active,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      "superadmin",
      passwordHash,
      "superadmin@system.com",
      "9999999999",
      1,        // SUPER_ADMIN role_id
      1,        // active
      1,      // created_by
    ]);

    console.log("✅ Super Admin created successfully");

  } catch (error) {
    console.error("❌ Error creating super admin:", error.message);
  } finally {
    process.exit();
  }
}

createSuperAdmin();