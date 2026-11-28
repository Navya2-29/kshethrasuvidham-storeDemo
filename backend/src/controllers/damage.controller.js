const db = require("../config/db.config");
const { mirrorToSoleDepartment } = require("../utils/stockSync.util");

// Ensure the damage_records table exists
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS damage_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      damage_no VARCHAR(50) NOT NULL UNIQUE,
      product_id INT NOT NULL,
      department_id INT DEFAULT NULL,
      damaged_qty DECIMAL(10,2) NOT NULL,
      cost_price DECIMAL(10,2) DEFAULT 0,
      selling_price DECIMAL(10,2) DEFAULT 0,
      total_loss DECIMAL(10,2) DEFAULT 0,
      damage_type VARCHAR(50) DEFAULT 'Broken',
      damage_date DATE NOT NULL,
      remarks TEXT,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_prod (product_id),
      INDEX idx_dept (department_id)
    )
  `);
}

// Generate next damage reference number (e.g. DMG-0001)
async function generateDamageNo() {
  const [[maxRow]] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(damage_no, 5) AS UNSIGNED)) AS max_num 
     FROM damage_records 
     WHERE damage_no REGEXP '^DMG-[0-9]+$'`
  );
  if (maxRow && maxRow.max_num) {
    const nextSeq = Number(maxRow.max_num) + 1;
    return `DMG-${String(nextSeq).padStart(4, "0")}`;
  }

  const [[cntRow]] = await db.query(`SELECT COUNT(*) AS total FROM damage_records`);
  const nextSeq = (cntRow?.total || 0) + 1;
  return `DMG-${String(nextSeq).padStart(4, "0")}`;
}

// GET all damage records
exports.getAllDamageRecords = async (req, res) => {
  try {
    await ensureTable();

    const [rows] = await db.query(`
      SELECT
        dr.*,
        p.product_name,
        p.product_code,
        p.unit,
        d.dept_name,
        u.username AS reported_by_name
      FROM damage_records dr
      LEFT JOIN products p ON dr.product_id = p.id
      LEFT JOIN departments d ON dr.department_id = d.id
      LEFT JOIN users u ON dr.created_by = u.id
      ORDER BY dr.id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("GET ALL DAMAGE RECORDS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch damage records", error: err.message });
  }
};

// CREATE damage record & update stock
exports.createDamageRecord = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureTable();

    const {
      product_id,
      department_id,
      damaged_qty,
      damage_type,
      damage_date,
      remarks,
      created_by,
    } = req.body;

    const qty = Number(damaged_qty);
    if (!product_id || !qty || qty <= 0) {
      return res.status(400).json({ message: "Valid product and damaged quantity are required" });
    }

    await conn.beginTransaction();

    // 1. Fetch product prices
    const [[product]] = await conn.query(
      `SELECT id, product_code, product_name, cost_price, selling_price, unit FROM products WHERE id = ?`,
      [product_id]
    );

    if (!product) {
      await conn.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    const locType = department_id ? "DEPARTMENT" : "MAIN_STORE";
    const locId = department_id ? Number(department_id) : 0;

    // Check available stock: quantity can NEVER be negative
    const [[stockRow]] = await conn.query(
      `SELECT qty FROM stock WHERE product_id = ? AND location_type = ? AND location_id = ?`,
      [product_id, locType, locId]
    );

    const availableStock = Number(stockRow?.qty || 0);
    if (availableStock <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: "Product is out of stock. Product quantity cannot be negative." });
    }
    if (qty > availableStock) {
      await conn.rollback();
      return res.status(400).json({
        message: `Damaged quantity (${qty}) exceeds available stock (${availableStock}). Product quantity cannot be negative.`,
      });
    }

    const costPrice = Number(product.cost_price || 0);
    const sellingPrice = Number(product.selling_price || 0);
    const totalLoss = Number((costPrice * qty).toFixed(2));
    const damageNo = await generateDamageNo();
    const entryDate = damage_date || new Date().toISOString().split("T")[0];

    // 2. Insert into damage_records
    const [result] = await conn.query(
      `INSERT INTO damage_records (
        damage_no, product_id, department_id, damaged_qty,
        cost_price, selling_price, total_loss, damage_type,
        damage_date, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        damageNo,
        product_id,
        department_id || null,
        qty,
        costPrice,
        sellingPrice,
        totalLoss,
        damage_type || "Broken",
        entryDate,
        remarks || "",
        created_by || null,
      ]
    );

    const recordId = result.insertId;

    // 3. Deduct stock and increment damaged_qty in stock table
    await conn.query(
      `UPDATE stock
       SET qty = GREATEST(0, qty - ?),
           damaged_qty = damaged_qty + ?
       WHERE product_id = ?
         AND location_type = ?
         AND location_id = ?`,
      [qty, qty, product_id, locType, locId]
    );

    if (locType === "MAIN_STORE") {
      await mirrorToSoleDepartment(conn, product_id, -qty, 0);
    }

    // 4. Log in stock_ledger
    await conn.query(
      `INSERT INTO stock_ledger (
        product_id, from_location_type, from_location_id,
        to_location_type, to_location_id,
        qty, free_qty, damaged_qty,
        rate, amount, transaction_type, reference_id, reference_no
      ) VALUES (?, ?, ?, 'DAMAGE', 0, 0, 0, ?, ?, ?, 'DAMAGE', ?, ?)`,
      [
        product_id,
        locType,
        locId,
        qty,
        costPrice,
        totalLoss,
        recordId,
        damageNo,
      ]
    );

    await conn.commit();

    res.status(201).json({
      message: "Damage recorded successfully and stock updated",
      data: {
        id: recordId,
        damage_no: damageNo,
        product_id,
        product_name: product.product_name,
        product_code: product.product_code,
        department_id,
        damaged_qty: qty,
        cost_price: costPrice,
        selling_price: sellingPrice,
        total_loss: totalLoss,
        damage_type: damage_type || "Broken",
        damage_date: entryDate,
        remarks: remarks || "",
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("CREATE DAMAGE RECORD ERROR:", err);
    res.status(500).json({ message: "Failed to record damage", error: err.message });
  } finally {
    conn.release();
  }
};

// DELETE / REVERSE damage record
exports.deleteDamageRecord = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;

    await conn.beginTransaction();

    const [[record]] = await conn.query(
      `SELECT * FROM damage_records WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (!record) {
      await conn.rollback();
      return res.status(404).json({ message: "Damage record not found" });
    }

    const locType = record.department_id ? "DEPARTMENT" : "MAIN_STORE";
    const locId = record.department_id ? Number(record.department_id) : 0;
    const qty = Number(record.damaged_qty);

    // Revert stock
    await conn.query(
      `UPDATE stock
       SET qty = qty + ?,
           damaged_qty = GREATEST(0, damaged_qty - ?)
       WHERE product_id = ?
         AND location_type = ?
         AND location_id = ?`,
      [qty, qty, record.product_id, locType, locId]
    );

    if (locType === "MAIN_STORE") {
      await mirrorToSoleDepartment(conn, record.product_id, qty, 0);
    }

    // Delete record
    await conn.query(`DELETE FROM damage_records WHERE id = ?`, [id]);

    await conn.commit();

    res.json({ message: "Damage record reversed and stock restored successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("DELETE DAMAGE RECORD ERROR:", err);
    res.status(500).json({ message: "Failed to delete damage record", error: err.message });
  } finally {
    conn.release();
  }
};
