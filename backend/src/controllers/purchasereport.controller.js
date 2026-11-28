const db = require("../config/db.config");

/**
 * 1. Purchase Bill Report (with payment mode breakdown, supplier, discount, tax, totals)
 * Columns: SINO, BILL DATE, BILL NO, SUPPLIER, CASH, UPI, CHEQUE, M.ORDER, DEBIT, BANK, ONLINE, DUE, DISCOUNT, TAX, TOTAL
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
        ph.total_amount AS gross_amount,
        COALESCE(ph.discount_amount, 0) AS discount_amount,
        ph.other_charges,
        COALESCE(ph.bill_amount, ph.total_amount, 0) AS bill_amount,
        COALESCE(ph.bill_amount, ph.total_amount, 0) AS total_amount,
        (SELECT COALESCE(SUM(pi.cgst + pi.sgst), 0) FROM purchase_items pi WHERE pi.purchase_id = ph.id) AS tax_amount,
        (SELECT COALESCE(SUM(pi.cgst + pi.sgst), 0) FROM purchase_items pi WHERE pi.purchase_id = ph.id) AS gst_amount,
        COALESCE(ph.payment_mode, 'Cash') AS payment_mode,
        ph.status,
        ph.created_by,
        u.username AS created_by_name,
        (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = ph.id) AS total_items,
        (SELECT GROUP_CONCAT(CONCAT(p.product_name, IF(pi.qty > 1, CONCAT(' (x', pi.qty, ')'), '')) SEPARATOR ', ')
         FROM purchase_items pi
         LEFT JOIN products p ON pi.product_id = p.id
         WHERE pi.purchase_id = ph.id) AS product_names,
        CASE WHEN UPPER(COALESCE(ph.payment_mode, 'Cash')) LIKE '%CASH%' OR UPPER(ph.payment_mode) = 'CA' THEN COALESCE(ph.bill_amount, ph.total_amount, 0) ELSE 0 END AS cash_amount,
        CASE WHEN UPPER(ph.payment_mode) LIKE '%UPI%' OR UPPER(ph.payment_mode) = 'UP' THEN COALESCE(ph.bill_amount, ph.total_amount, 0) ELSE 0 END AS upi_amount,
        CASE WHEN UPPER(ph.payment_mode) LIKE '%CHEQUE%' OR UPPER(ph.payment_mode) LIKE '%CHQ%' OR UPPER(ph.payment_mode) = 'CH' THEN COALESCE(ph.bill_amount, ph.total_amount, 0) ELSE 0 END AS cheque_amount,
        CASE WHEN UPPER(ph.payment_mode) LIKE '%M.ORDER%' OR UPPER(ph.payment_mode) LIKE '%MONEY ORDER%' OR UPPER(ph.payment_mode) LIKE '%MO%' THEN COALESCE(ph.bill_amount, ph.total_amount, 0) ELSE 0 END AS morder_amount,
        CASE WHEN UPPER(ph.payment_mode) LIKE '%DEBIT%' OR UPPER(ph.payment_mode) LIKE '%CARD%' OR UPPER(ph.payment_mode) = 'CD' THEN COALESCE(ph.bill_amount, ph.total_amount, 0) ELSE 0 END AS debit_amount,
        CASE WHEN UPPER(ph.payment_mode) LIKE '%BANK%' OR UPPER(ph.payment_mode) LIKE '%NEFT%' OR UPPER(ph.payment_mode) LIKE '%RTGS%' THEN COALESCE(ph.bill_amount, ph.total_amount, 0) ELSE 0 END AS bank_amount,
        CASE WHEN UPPER(ph.payment_mode) LIKE '%ONLINE%' THEN COALESCE(ph.bill_amount, ph.total_amount, 0) ELSE 0 END AS online_amount,
        CASE WHEN UPPER(ph.payment_mode) LIKE '%DUE%' OR UPPER(ph.payment_mode) LIKE '%CREDIT%' THEN COALESCE(ph.bill_amount, ph.total_amount, 0) ELSE 0 END AS due_amount
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

    const totals = rows.reduce(
      (acc, r) => {
        acc.cash += Number(r.cash_amount || 0);
        acc.upi += Number(r.upi_amount || 0);
        acc.cheque += Number(r.cheque_amount || 0);
        acc.morder += Number(r.morder_amount || 0);
        acc.debit += Number(r.debit_amount || 0);
        acc.bank += Number(r.bank_amount || 0);
        acc.online += Number(r.online_amount || 0);
        acc.due += Number(r.due_amount || 0);
        acc.discount += Number(r.discount_amount || 0);
        acc.tax += Number(r.tax_amount || r.gst_amount || 0);
        acc.total += Number(r.total_amount || 0);
        return acc;
      },
      { cash: 0, upi: 0, cheque: 0, morder: 0, debit: 0, bank: 0, online: 0, due: 0, discount: 0, tax: 0, total: 0 }
    );

    res.json({
      success: true,
      data: rows,
      totals: {
        cash: Number(totals.cash.toFixed(2)),
        upi: Number(totals.upi.toFixed(2)),
        cheque: Number(totals.cheque.toFixed(2)),
        morder: Number(totals.morder.toFixed(2)),
        debit: Number(totals.debit.toFixed(2)),
        bank: Number(totals.bank.toFixed(2)),
        online: Number(totals.online.toFixed(2)),
        due: Number(totals.due.toFixed(2)),
        discount: Number(totals.discount.toFixed(2)),
        tax: Number(totals.tax.toFixed(2)),
        total: Number(totals.total.toFixed(2)),
      },
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
 * Returns: purchases that have status = 'CANCELLED' with discount and tax
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
        COALESCE(ph.discount_amount, 0) AS discount_amount,
        (SELECT COALESCE(SUM(pi.cgst + pi.sgst), 0) FROM purchase_items pi WHERE pi.purchase_id = ph.id) AS tax_amount,
        (SELECT COALESCE(SUM(pi.cgst + pi.sgst), 0) FROM purchase_items pi WHERE pi.purchase_id = ph.id) AS gst_amount,
        COALESCE(ph.bill_amount, ph.total_amount) AS total_amount,
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

    const totalDiscount = rows.reduce((sum, r) => sum + Number(r.discount_amount || 0), 0);
    const totalTax = rows.reduce((sum, r) => sum + Number(r.tax_amount || r.gst_amount || 0), 0);
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

    res.json({
      success: true,
      data: rows,
      total_discount: Number(totalDiscount.toFixed(2)),
      total_tax: Number(totalTax.toFixed(2)),
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
        COALESCE(pi.discount, 0) AS discount_amount,
        (COALESCE(pi.cgst, 0) + COALESCE(pi.sgst, 0)) AS tax_amount,
        COALESCE(pi.gst_percent, 0) AS gst_percent,
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

    const totalDiscount = rows.reduce((sum, row) => sum + Number(row.discount_amount || 0), 0);
    const totalTax = rows.reduce((sum, row) => sum + Number(row.tax_amount || 0), 0);
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    res.json({
      success: true,
      data: rows,
      total_discount: Number(totalDiscount.toFixed(2)),
      total_tax: Number(totalTax.toFixed(2)),
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
exports.getPurchaseBillReport = exports.getPurchaseReport;

