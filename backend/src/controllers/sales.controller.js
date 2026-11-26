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
        payload.created_by || 1,
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
