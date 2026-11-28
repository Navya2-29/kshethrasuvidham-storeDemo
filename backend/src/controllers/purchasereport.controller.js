const db = require("../config/db.config");

/**
 * 1. Purchase Report
 * Filters: from_date, to_date, supplier_id, user_id
 * Returns: list of purchases with supplier, items summary, totals
 */
exports.getPurchaseReport = async (req, res) => {
  try {
    const filters = req.method === "POST" ? req.body : req.query;
    const { from_date, to_date, supplier_id, user_id } = filters || {};

    let query = `
      SELECT
        ph.id,
        ph.order_no,
        ph.invoice_no,
        ph.supplier_id,
        s.supplier_name,
        s.mobile_number AS supplier_mobile,
        ph.invoice_date,
        ph.receipt_date,
        ph.total_amount,
        ph.discount_amount,
        ph.other_charges,
        ph.bill_amount,
        (SELECT COALESCE(SUM(pi.cgst + pi.sgst), 0) FROM purchase_items pi WHERE pi.purchase_id = ph.id) AS gst_amount,
        ph.status,
        ph.created_by,
        u.username AS created_by_name,
        (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = ph.id) AS total_items,
        (SELECT GROUP_CONCAT(CONCAT(p.product_name, IF(pi.qty > 1, CONCAT(' (x', pi.qty, ')'), '')) SEPARATOR ', ')
         FROM purchase_items pi
         LEFT JOIN products p ON pi.product_id = p.id
         WHERE pi.purchase_id = ph.id) AS product_names
      FROM purchase_header ph
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      LEFT JOIN users u ON ph.created_by = u.id
      WHERE (ph.status IS NULL OR ph.status != 'CANCELLED')
    `;

    const params = [];

    if (from_date && to_date) {
      query += ` AND DATE(COALESCE(ph.receipt_date, ph.invoice_date)) BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    } else if (from_date) {
      query += ` AND DATE(COALESCE(ph.receipt_date, ph.invoice_date)) >= ?`;
      params.push(from_date);
    } else if (to_date) {
      query += ` AND DATE(COALESCE(ph.receipt_date, ph.invoice_date)) <= ?`;
      params.push(to_date);
    }

    if (supplier_id) {
      query += ` AND ph.supplier_id = ?`;
      params.push(supplier_id);
    }

    if (user_id) {
      query += ` AND ph.created_by = ?`;
      params.push(user_id);
    }

    query += ` ORDER BY ph.id DESC`;

    const [rows] = await db.query(query, params);

    const totalBillAmount = rows.reduce((sum, r) => sum + Number(r.bill_amount || 0), 0);
    const totalGstAmount = rows.reduce((sum, r) => sum + Number(r.gst_amount || 0), 0);

    res.json({
      success: true,
      data: rows,
      total_amount: Number(totalBillAmount.toFixed(2)),
      total_gst: Number(totalGstAmount.toFixed(2)),
      count: rows.length,
    });
  } catch (error) {
    console.error("GET PURCHASE REPORT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate purchase report",
      error: error.message,
    });
  }
};

/**
 * 2. Purchase Return Report
 * Filters: from_date, to_date, supplier_id
 * Returns: purchases that have status = 'CANCELLED'
 */
exports.getPurchaseReturnReport = async (req, res) => {
  try {
    const filters = req.method === "POST" ? req.body : req.query;
    const { from_date, to_date, supplier_id } = filters || {};

    let query = `
      SELECT
        ph.id,
        ph.order_no,
        ph.invoice_no,
        ph.supplier_id,
        s.supplier_name,
        s.mobile_number AS supplier_mobile,
        ph.invoice_date,
        ph.receipt_date,
        ph.total_amount AS gross_amount,
        ph.discount_amount,
        ph.bill_amount AS total_amount,
        ph.status,
        ph.cancel_reason,
        ph.cancelled_by,
        ph.cancelled_at,
        u_canc.username AS cancelled_by_name,
        ph.created_by,
        u_creat.username AS created_by_name,
        (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = ph.id) AS total_items,
        (SELECT GROUP_CONCAT(CONCAT(p.product_name, IF(pi.qty > 1, CONCAT(' (x', pi.qty, ')'), '')) SEPARATOR ', ')
         FROM purchase_items pi
         LEFT JOIN products p ON pi.product_id = p.id
         WHERE pi.purchase_id = ph.id) AS product_names
      FROM purchase_header ph
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      LEFT JOIN users u_canc ON ph.cancelled_by = u_canc.id
      LEFT JOIN users u_creat ON ph.created_by = u_creat.id
      WHERE ph.status = 'CANCELLED'
    `;

    const params = [];

    if (from_date && to_date) {
      query += ` AND DATE(COALESCE(ph.cancelled_at, ph.receipt_date, ph.invoice_date)) BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    } else if (from_date) {
      query += ` AND DATE(COALESCE(ph.cancelled_at, ph.receipt_date, ph.invoice_date)) >= ?`;
      params.push(from_date);
    } else if (to_date) {
      query += ` AND DATE(COALESCE(ph.cancelled_at, ph.receipt_date, ph.invoice_date)) <= ?`;
      params.push(to_date);
    }

    if (supplier_id) {
      query += ` AND ph.supplier_id = ?`;
      params.push(supplier_id);
    }

    query += ` ORDER BY COALESCE(ph.cancelled_at, ph.id) DESC`;

    const [rows] = await db.query(query, params);

    const totalAmount = rows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

    res.json({
      success: true,
      data: rows,
      total_amount: Number(totalAmount.toFixed(2)),
      count: rows.length,
    });
  } catch (error) {
    console.error("GET PURCHASE RETURN REPORT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate purchase return report",
      error: error.message,
    });
  }
};

/**
 * 3. Product-Wise Purchase Report
 * Filters: from_date, to_date, product_id, product_code, product_name
 */
exports.getProductWisePurchaseReport = async (req, res) => {
  try {
    const filters = req.method === "POST" ? req.body : req.query;
    const { from_date, to_date, product_id, product_code, product_name } = filters || {};

    let query = `
      SELECT 
        ph.invoice_no,
        ph.invoice_date,
        s.supplier_name,
        p.product_code,
        p.product_name,
        pi.qty,
        pi.unit,
        pi.cost_price,
        pi.amount
      FROM purchase_items pi
      JOIN purchase_header ph ON pi.purchase_id = ph.id
      JOIN suppliers s ON ph.supplier_id = s.id
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE (ph.status IS NULL OR ph.status != 'CANCELLED')
    `;

    const params = [];

    if (from_date && to_date) {
      query += ` AND DATE(ph.invoice_date) BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    } else if (from_date) {
      query += ` AND DATE(ph.invoice_date) >= ?`;
      params.push(from_date);
    } else if (to_date) {
      query += ` AND DATE(ph.invoice_date) <= ?`;
      params.push(to_date);
    }

    if (product_id) {
      query += ` AND pi.product_id = ?`;
      params.push(product_id);
    } else if (product_code) {
      query += ` AND p.product_code = ?`;
      params.push(product_code);
    } else if (product_name) {
      query += ` AND p.product_name = ?`;
      params.push(product_name);
    }

    query += ` ORDER BY ph.invoice_date ASC, ph.id ASC`;

    const [rows] = await db.query(query, params);

    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    res.json({
      success: true,
      data: rows,
      total: Number(total.toFixed(2)),
      count: rows.length,
    });
  } catch (error) {
    console.error("GET PRODUCT-WISE PURCHASE REPORT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Backward compatibility alias:
exports.getProductWiseReport = exports.getProductWisePurchaseReport;
