const db = require("../config/db.config");
const { getSoleDepartmentId } = require("../utils/stockSync.util");

exports.getProductStock = async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    // Single-department stores mirror every MAIN_STORE change into the sole
    // department (see stockSync.util.js) but never reduce MAIN_STORE for
    // sales - showing it alongside the department would double the visible
    // total. There, the department's row alone is authoritative.
    const soleDeptId = await getSoleDepartmentId(db);

    if (soleDeptId) {
      const [[dept]] = await db.query(
        `SELECT
           d.id AS department_id,
           d.dept_name AS store,
           COALESCE(s.qty, 0) AS qty,
           COALESCE(s.free_qty, 0) AS free_qty,
           COALESCE(s.damaged_qty, 0) AS damaged_qty
         FROM departments d
         LEFT JOIN stock s
           ON s.location_id = d.id
           AND s.location_type = 'DEPARTMENT'
           AND s.product_id = ?
         WHERE d.id = ?`,
        [productId, soleDeptId]
      );

      return res.json([
        {
          ...dept,
          total_available: Number(dept?.qty || 0) + Number(dept?.free_qty || 0),
        },
      ]);
    }

    // 🔴 MAIN STORE
    const [[main]] = await db.query(
      `SELECT
         COALESCE(qty, 0) AS qty,
         COALESCE(free_qty, 0) AS free_qty,
         COALESCE(damaged_qty, 0) AS damaged_qty
       FROM stock
       WHERE product_id = ?
       AND location_type = 'MAIN_STORE'
       AND location_id = 0`,
      [productId]
    );

    // 🔴 DEPARTMENTS
    const [departments] = await db.query(
      `SELECT
         d.id AS department_id,
         d.dept_name AS store,
         COALESCE(s.qty, 0) AS qty,
         COALESCE(s.free_qty, 0) AS free_qty,
         COALESCE(s.damaged_qty, 0) AS damaged_qty
       FROM departments d
       LEFT JOIN stock s
         ON s.location_id = d.id
         AND s.location_type = 'DEPARTMENT'
         AND s.product_id = ?
         WHERE d.is_active = 1
       ORDER BY d.id`,
      [productId]
    );

    const stock = [
      {
        store: "MAIN STORE",
        qty: main?.qty || 0,
        free_qty: main?.free_qty || 0,
        damaged_qty: main?.damaged_qty || 0,
        total_available:
          Number(main?.qty || 0) + Number(main?.free_qty || 0),
      },
      ...departments.map((d) => ({
        ...d,
        total_available:
          Number(d.qty || 0) + Number(d.free_qty || 0),
      })),
    ];

    res.json(stock);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


/* =======================
   TRANSFER STOCK (FIXED)
======================= */

// -----------------------------
// Transfer stock: Main store → Department
// -----------------------------
// =============================
// 🔹 TRANSFER STOCK
// MAIN_STORE → DEPARTMENT
// =============================
exports.transferStock = async (req, res) => {
  const {
    productId,
    departmentId,
    quantity,
    freeQty,
    transferDate,
    created_by
  } = req.body;

  const freeQuantity = Number(freeQty || 0);

  //  VALIDATION
  if (!productId || !departmentId || !quantity || !transferDate ||!created_by) {
    return res.status(400).json({
      message: "Missing required fields"
    });
  }

  if (quantity <= 0) {
    return res.status(400).json({
      message: "Quantity must be greater than 0"
    });
  }

  if (freeQuantity < 0) {
    return res.status(400).json({
      message: "Free quantity cannot be negative"
    });
  }

  let conn;

  try {
    // In single-department stores, stock is already auto-mirrored into the
    // sole department on every purchase/opening/direct-entry (see
    // stockSync.util.js) - a manual transfer on top of that would double the
    // department's stock instead of moving anything.
    const soleDeptId = await getSoleDepartmentId(db);
    if (soleDeptId) {
      return res.status(400).json({
        message: "Stock Transfer is not applicable for single-department stores - stock is already available in your one department."
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // =============================
    // 🔹 0. VALIDATE TARGET DEPARTMENT
    // =============================
    const [[targetDept]] = await conn.query(
      `SELECT id FROM departments WHERE id = ? AND is_active = 1`,
      [departmentId]
    );

    if (!targetDept) {
      throw new Error("Selected department is not active");
    }

    // =============================
    // 🔹 1. LOCK MAIN STORE STOCK
    // =============================
    const [[mainStock]] = await conn.query(
      `SELECT qty, free_qty
       FROM stock
       WHERE product_id = ?
       AND location_type = 'MAIN_STORE'
       AND location_id = 0
       FOR UPDATE`,
      [productId]
    );

    if (!mainStock) {
      throw new Error("Main store stock not found");
    }

    const currentQty = Number(mainStock.qty || 0);
    const currentFreeQty = Number(mainStock.free_qty || 0);

    if (currentQty < quantity) {
      throw new Error(
        `Insufficient stock. Available: ${currentQty}`
      );
    }

    if (freeQuantity > currentFreeQty) {
      throw new Error(
        `Insufficient free stock. Available: ${currentFreeQty}`
      );
    }

    // =============================
    // 🔹 2. UPDATE MAIN STORE
    // =============================
    await conn.query(
      `UPDATE stock
       SET qty = qty - ?,
           free_qty = free_qty - ?
       WHERE product_id = ?
       AND location_type = 'MAIN_STORE'
       AND location_id = 0`,
      [quantity, freeQuantity, productId]
    );

    // =============================
    // 🔹 3. UPDATE / INSERT DEPARTMENT STOCK
    // =============================
    await conn.query(
      `INSERT INTO stock (
        product_id,
        location_type,
        location_id,
        qty,
        free_qty,
        damaged_qty
      )
      VALUES (?, 'DEPARTMENT', ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE
        qty = qty + VALUES(qty),
        free_qty = free_qty + VALUES(free_qty)`,
      [productId, departmentId, quantity, freeQuantity]
    );

    // =============================
    // 🔹 4. INSERT TRANSFER RECORD
    // =============================
    await conn.query(
      `INSERT INTO stock_transfer (
        product_id,
        to_department,
        quantity,
        transfer_date,
        created_by
      )
      VALUES (?, ?, ?, ?, ?)`,
      [
        productId,
        departmentId,
        quantity,
        transferDate,
        created_by
      ]
    );

    // =============================
    // 🔹 5. COMMIT TRANSACTION
    // =============================
    await conn.commit();

    return res.json({
      message: "Stock transferred successfully"
    });

  } catch (err) {
    if (conn) await conn.rollback();

    console.error(err);

    return res.status(500).json({
      message: err.message
    });

  } finally {
    if (conn) conn.release();
  }
};