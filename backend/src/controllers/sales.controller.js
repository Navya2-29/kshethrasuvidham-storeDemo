// sales.controller.js
const db = require("../config/db.config");
const { generateInvoice } = require("../services/invoiceService");

// 1️⃣ Generate Next Invoice
exports.getNextInvoiceNo = async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();

    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const year = String(new Date().getFullYear()).slice(-2);
    const monthKey = month + year;

    const prefix = "SAL";

    const [[row]] = await connection.query(
      `SELECT last_number
       FROM invoice_sequence
       WHERE prefix = ? AND month_key = ?`,
      [prefix, monthKey],
    );

    const nextSerial = (row?.last_number || 0) + 1;

    res.json({
      invoice_no: `${prefix}-${nextSerial}/${monthKey}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  } finally {
    connection?.release();
  }
};
// Get products by department
// Get products by department
exports.getProductsByDepartment = async (req, res) => {
  try {
    const deptId = req.params.deptId;
    console.log(deptId);
    const [rows] = await db.query(
      `SELECT 
      p.id,
      p.product_code,
      p.product_name,
      p.gst_percent,
      p.hsn_code,
      p.unit,
      p.mrp,
      p.cost_price,
      COALESCE(p.is_price_editable, 0) AS is_price_editable,
      s.qty AS quantity

   FROM products p

   INNER JOIN stock s 
     ON s.product_id = p.id 
    AND s.location_type = 'DEPARTMENT'
    AND s.location_id = ?

   WHERE p.is_active = 1`,
      [deptId],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
//  Save Sale
exports.createSale = async (req, res) => {
  const payload = req.body;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // ============================
    // 1️⃣ Generate Invoice Number
    // ============================
    const invoiceNo = await generateInvoice("SAL", connection);

    // ============================
    // 2️⃣ Insert Header
    // ============================
    const [result] = await connection.query(
      `INSERT INTO sales_header (
        order_no,
        invoice_no,
        receipt_date,
        department_id,
        customer_name,
        customer_mobile,
        total_amount,
        payment_mode,
        cheque_date,
        cheque_no,
        bank_name,
        discount_amount,
        gst_amount,
        other_charges,
        bill_amount,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.order_no,
        invoiceNo,
        payload.receipt_date,
        payload.department_id,
        payload.customer_name,
        payload.customer_mobile,
        payload.total_amount || 0,
        payload.payment_mode,
        payload.payment_mode === "ch" ? payload.cheque_date : null,
        payload.payment_mode === "ch" ? payload.cheque_no : null,
        payload.bank_name || null,
        payload.discount_amount || 0,
        payload.gst_amount || 0,
        payload.other_charges || 0,
        payload.bill_amount || 0,
        payload.created_by || req.user?.id || 1,
      ],
    );

    const salesId = result.insertId;

    // ============================
    // 3️⃣ Process Items
    // ============================
    for (let item of payload.items) {
      // 🔒 Lock stock row (VERY IMPORTANT)
      const [[stock]] = await connection.query(
        `SELECT qty FROM stock
             WHERE product_id = ?
             AND location_type = 'DEPARTMENT'
             AND location_id = ?
             FOR UPDATE`,
        [item.product_id, payload.department_id],
      );

      if (!stock) {
        throw new Error(`No stock available for product ${item.product_id}`);
      }

      if (Number(stock.qty) < Number(item.qty)) {
        throw new Error(
          `Insufficient stock for product ${item.product_id}. Available: ${stock.qty}`,
        );
      }

      // 3.1 Insert sales item
      await connection.query(
        `INSERT INTO sales_items (
    sales_id,
    product_id,
    author_id,
    publisher_id,
    product_name,
    qty,
    unit,
    mrp,
    cost_price,
    selling_price,
    cgst,
    sgst,
    amount,
    gst_percentage,
    hsn_code
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          salesId,
          item.product_id,
          item.author_id || null,
          item.publisher_id || null,
          item.product_name,
          item.qty,
          item.unit,
          item.mrp,
          item.cost_price,
          item.selling_price,
          item.cgst,
          item.sgst,
          item.amount,
          item.gst_percentage || 0,
          item.hsn_code || "",
        ],
      );

      // 3.2 Deduct stock
      await connection.query(
        `UPDATE stock
           SET qty = qty - ?
           WHERE product_id = ?
           AND location_type = 'DEPARTMENT'
           AND location_id = ?`,
        [item.qty, item.product_id, payload.department_id],
      );

      // 3.3 Insert ledger
      await connection.query(
        `INSERT INTO stock_ledger
  (product_id, from_location_type, from_location_id,
    to_location_type, to_location_id,
    qty, free_qty, damaged_qty,
    rate, amount,
    transaction_type, reference_id, reference_no)
    VALUES (?, 'DEPARTMENT', ?, 'CUSTOMER', 0,
          ?, 0, 0,
          ?, ?, 'SALE', ?, ?)`,
        [
          item.product_id,
          payload.department_id,
          item.qty,
          item.selling_price,
          item.amount,
          salesId,
          invoiceNo,
        ],
      );
    }
    const [[header]] = await connection.query(
      `SELECT * FROM sales_header WHERE id = ?`,
      [salesId],
    );

    const [items] = await connection.query(
      `SELECT * FROM sales_items WHERE sales_id = ?`,
      [salesId],
    );
    // ============================
    // Commit
    // ============================
    await connection.commit();

    res.json({
      message: "Sale saved successfully",
       data: {
        ...header,
        items
      }
    });
  } catch (err) {
    if (connection) await connection.rollback();

    console.error(err);

    // Duplicate invoice
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Invoice number already exists",
      });
    }

    res.status(500).json({
      message: err.message || "Sale failed",
    });
  } finally {
    connection?.release();
  }
};

// GET products for sales dropdown
exports.getSalesProducts = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.product_code,
        p.product_name,
        p.unit,
        p.mrp,
        p.cost_price,
        p.selling_price,
        p.gst_percent,
        p.hsn_code,
        p.author_id,
        p.publisher_id,
        a.author_name,
        pub.publisher_name
      FROM products p
      LEFT JOIN authors a ON a.id = p.author_id
      LEFT JOIN publishers pub ON pub.id = p.publisher_id
      WHERE p.is_active = 1
        AND (p.sale_item = 'Y' OR p.sale_item = 1)
      ORDER BY p.product_name ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error("GET SALES PRODUCTS ERROR:", err);
    res.status(500).json({
      message: "Failed to fetch sales products",
    });
  }
};

// get deprtmentstock
exports.getDepartmentStock = async (req, res) => {
  try {
    const { deptId } = req.params;

    const [rows] = await db.query(
      `
      SELECT 
        product_id,
          (qty + IFNULL(free_qty, 0)) AS stock_qty
      FROM stock
      WHERE location_type = 'DEPARTMENT'
        AND location_id = ?
      `,
      [deptId],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get All Sales (with items count and department)
exports.getAllSales = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        sh.id,
        sh.order_no,
        sh.invoice_no,
        sh.receipt_date,
        sh.customer_name,
        sh.customer_mobile,
        sh.total_amount,
        sh.discount_amount,
        sh.gst_amount,
        sh.other_charges,
        sh.bill_amount,
        sh.payment_mode,
        sh.status,
        sh.cancel_reason,
        sh.cancelled_by,
        sh.cancelled_at,
        u2.username AS cancelled_by_name,
        sh.department_id,
        d.dept_name,
        u.username AS cashier_name,
        sh.created_at,
        (SELECT COUNT(*) FROM sales_items si WHERE si.sales_id = sh.id) AS total_items,
        (SELECT GROUP_CONCAT(CONCAT(si.product_name, IF(si.qty > 1, CONCAT(' (x', si.qty, ')'), '')) SEPARATOR ', ') FROM sales_items si WHERE si.sales_id = sh.id) AS product_names
      FROM sales_header sh
      LEFT JOIN departments d ON sh.department_id = d.id
      LEFT JOIN users u ON sh.created_by = u.id
      LEFT JOIN users u2 ON sh.cancelled_by = u2.id
      ORDER BY sh.id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("GET ALL SALES ERROR:", err);
    res.status(500).json({ message: "Server error fetching sales" });
  }
};

// Get Sale By ID with items
exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    const [headerRows] = await db.query(
      `SELECT
        sh.*,
        d.dept_name,
        u.username AS cashier_name
      FROM sales_header sh
      LEFT JOIN departments d ON sh.department_id = d.id
      LEFT JOIN users u ON sh.created_by = u.id
      WHERE sh.id = ?`,
      [id],
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const [items] = await db.query(
      `SELECT
        si.*,
        p.product_code
      FROM sales_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sales_id = ?`,
      [id],
    );

    res.json({
      header: headerRows[0],
      items,
    });
  } catch (err) {
    console.error("GET SALE BY ID ERROR:", err);
    res.status(500).json({ message: "Server error fetching sale details" });
  }
};

// Cancel Sale
exports.cancelSale = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;
    const { cancel_reason, cancelled_by, payment_return_method } = req.body;

    if (!cancel_reason || !cancel_reason.trim()) {
      return res.status(400).json({ message: "Cancel reason is required" });
    }

    await conn.beginTransaction();

    const [[sale]] = await conn.query(
      `SELECT * FROM sales_header WHERE id = ? FOR UPDATE`,
      [id],
    );

    if (!sale) {
      await conn.rollback();
      return res.status(404).json({ message: "Sale not found" });
    }

    if (sale.status === "CANCELLED") {
      await conn.rollback();
      return res.status(400).json({ message: "Sale is already cancelled" });
    }

    // Revert stock for each sold item
    const [items] = await conn.query(
      `SELECT * FROM sales_items WHERE sales_id = ?`,
      [id],
    );

    for (const item of items) {
      await conn.query(
        `UPDATE stock
         SET qty = qty + ?
         WHERE product_id = ?
           AND location_type = 'DEPARTMENT'
           AND location_id = ?`,
        [item.qty, item.product_id, sale.department_id],
      );

      await conn.query(
        `INSERT INTO stock_ledger
          (product_id, from_location_type, from_location_id,
           to_location_type, to_location_id,
           qty, free_qty, damaged_qty,
           rate, amount, transaction_type, reference_id, reference_no)
         VALUES (?, 'CUSTOMER', 0, 'DEPARTMENT', ?,
                 ?, 0, 0,
                 ?, ?, 'CANCEL_SALE', ?, ?)`,
        [
          item.product_id,
          sale.department_id,
          item.qty,
          item.selling_price,
          item.amount,
          id,
          sale.invoice_no,
        ],
      );
    }

    const recordedReason = payment_return_method
      ? `${cancel_reason.trim()} (Returned via ${payment_return_method})`
      : cancel_reason.trim();

    await conn.query(
      `UPDATE sales_header
       SET status = 'CANCELLED',
           cancel_reason = ?,
           cancelled_by = ?,
           cancelled_at = NOW()
       WHERE id = ?`,
      [recordedReason, cancelled_by || null, id],
    );

    await conn.commit();
    res.json({
      message: "Sale cancelled successfully",
      data: {
        id,
        status: "CANCELLED",
        cancel_reason: recordedReason,
        cancelled_by,
        cancelled_at: new Date().toISOString(),
        payment_return_method: payment_return_method || "Cash",
        items,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("CANCEL SALE ERROR:", err);
    res.status(500).json({ message: "Cancel failed" });
  } finally {
    conn.release();
  }
};
