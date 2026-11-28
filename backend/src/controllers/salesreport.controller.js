const db = require("../config/db.config");

/**
 * 1. Minimal Sales Report
 * Columns: sl_no, invoice_no, username, product_name, receipt_date, payment_mode, total_amount
 */
exports.getSalesReport = async (req, res) => {
  try {
    const filters = req.method === "POST" ? (req.body || req.query) : req.query;
    const { from_date, to_date, payment_mode, user_id } = filters || {};

    let query = `
      SELECT
        sh.id,
        sh.invoice_no,
        COALESCE(u.username, 'Counter') AS username,
        COALESCE(
          (SELECT GROUP_CONCAT(CONCAT(si.product_name, IF(si.qty > 1, CONCAT(' (x', si.qty, ')'), '')) SEPARATOR ', ')
           FROM sales_items si WHERE si.sales_id = sh.id),
          'Items'
        ) AS product_name,
        sh.receipt_date,
        sh.payment_mode,
        sh.bill_amount AS total_amount
      FROM sales_header sh
      LEFT JOIN users u ON sh.created_by = u.id
      WHERE (sh.status IS NULL OR sh.status != 'CANCELLED')
    `;

    const params = [];

    if (from_date && to_date) {
      query += ` AND DATE(sh.receipt_date) BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    } else if (from_date) {
      query += ` AND DATE(sh.receipt_date) >= ?`;
      params.push(from_date);
    } else if (to_date) {
      query += ` AND DATE(sh.receipt_date) <= ?`;
      params.push(to_date);
    }

    if (payment_mode) {
      query += ` AND sh.payment_mode = ?`;
      params.push(payment_mode);
    }

    if (user_id) {
      query += ` AND sh.created_by = ?`;
      params.push(user_id);
    }

    query += ` ORDER BY sh.receipt_date DESC, sh.id DESC`;

    const [rows] = await db.query(query, params);

    const totalAmount = rows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

    res.json({
      success: true,
      data: rows,
      total_amount: Number(totalAmount.toFixed(2)),
      count: rows.length,
    });
  } catch (error) {
    console.error("GET SALES REPORT ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to generate sales report", error: error.message });
  }
};

/**
 * 2. Minimal Item-Wise Sales Report
 * Columns: sl_no, invoice_no, product_name, qty, payment_mode, username, receipt_date, total_amount
 */
exports.getItemWiseSalesReport = async (req, res) => {
  try {
    const filters = req.method === "POST" ? (req.body || req.query) : req.query;
    const { from_date, to_date, product_id, payment_mode, user_id } = filters || {};

    let query = `
      SELECT
        si.id AS item_id,
        sh.invoice_no,
        si.product_id,
        si.product_name,
        si.qty AS quantity,
        sh.payment_mode,
        COALESCE(u.username, 'Counter') AS username,
        sh.receipt_date,
        si.amount AS total_amount
      FROM sales_items si
      JOIN sales_header sh ON si.sales_id = sh.id
      LEFT JOIN users u ON sh.created_by = u.id
      WHERE (sh.status IS NULL OR sh.status != 'CANCELLED')
    `;

    const params = [];

    if (from_date && to_date) {
      query += ` AND DATE(sh.receipt_date) BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    } else if (from_date) {
      query += ` AND DATE(sh.receipt_date) >= ?`;
      params.push(from_date);
    } else if (to_date) {
      query += ` AND DATE(sh.receipt_date) <= ?`;
      params.push(to_date);
    }

    if (product_id) {
      query += ` AND si.product_id = ?`;
      params.push(product_id);
    }

    if (payment_mode) {
      query += ` AND sh.payment_mode = ?`;
      params.push(payment_mode);
    }

    if (user_id) {
      query += ` AND sh.created_by = ?`;
      params.push(user_id);
    }

    query += ` ORDER BY sh.receipt_date DESC, sh.id DESC, si.id ASC`;

    const [rows] = await db.query(query, params);

    const totalQuantity = rows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

    res.json({
      success: true,
      data: rows,
      total_quantity: totalQuantity,
      total_amount: Number(totalAmount.toFixed(2)),
      count: rows.length,
    });
  } catch (error) {
    console.error("GET ITEM-WISE SALES REPORT ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to generate item-wise sales report", error: error.message });
  }
};
