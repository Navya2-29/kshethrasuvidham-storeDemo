const db = require("../config/db.config");

/**
 * 1. Sales Bill Report (with payment mode breakdown, discount, tax, totals)
 * Columns: SINO, BILL DATE, BILL NO, CASH, UPI, CHEQUE, M.ORDER, DEBIT, BANK, ONLINE, DUE, DISCOUNT, TAX, TOTAL
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
        sh.receipt_date,
        COALESCE(sh.payment_mode, 'Cash') AS payment_mode,
        COALESCE(sh.discount_amount, 0) AS discount_amount,
        COALESCE(sh.gst_amount, 0) AS tax_amount,
        COALESCE(sh.bill_amount, sh.total_amount, 0) AS total_amount,
        CASE WHEN UPPER(COALESCE(sh.payment_mode, 'Cash')) LIKE '%CASH%' OR UPPER(sh.payment_mode) = 'CA' THEN COALESCE(sh.bill_amount, sh.total_amount, 0) ELSE 0 END AS cash_amount,
        CASE WHEN UPPER(sh.payment_mode) LIKE '%UPI%' OR UPPER(sh.payment_mode) = 'UP' THEN COALESCE(sh.bill_amount, sh.total_amount, 0) ELSE 0 END AS upi_amount,
        CASE WHEN UPPER(sh.payment_mode) LIKE '%CHEQUE%' OR UPPER(sh.payment_mode) LIKE '%CHQ%' OR UPPER(sh.payment_mode) = 'CH' THEN COALESCE(sh.bill_amount, sh.total_amount, 0) ELSE 0 END AS cheque_amount,
        CASE WHEN UPPER(sh.payment_mode) LIKE '%M.ORDER%' OR UPPER(sh.payment_mode) LIKE '%MONEY ORDER%' OR UPPER(sh.payment_mode) LIKE '%MO%' THEN COALESCE(sh.bill_amount, sh.total_amount, 0) ELSE 0 END AS morder_amount,
        CASE WHEN UPPER(sh.payment_mode) LIKE '%DEBIT%' OR UPPER(sh.payment_mode) LIKE '%CARD%' OR UPPER(sh.payment_mode) = 'CD' THEN COALESCE(sh.bill_amount, sh.total_amount, 0) ELSE 0 END AS debit_amount,
        CASE WHEN UPPER(sh.payment_mode) LIKE '%BANK%' OR UPPER(sh.payment_mode) LIKE '%NEFT%' OR UPPER(sh.payment_mode) LIKE '%RTGS%' THEN COALESCE(sh.bill_amount, sh.total_amount, 0) ELSE 0 END AS bank_amount,
        CASE WHEN UPPER(sh.payment_mode) LIKE '%ONLINE%' THEN COALESCE(sh.bill_amount, sh.total_amount, 0) ELSE 0 END AS online_amount,
        CASE WHEN UPPER(sh.payment_mode) LIKE '%DUE%' OR UPPER(sh.payment_mode) LIKE '%CREDIT%' THEN COALESCE(sh.bill_amount, sh.total_amount, 0) ELSE 0 END AS due_amount
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
        acc.tax += Number(r.tax_amount || 0);
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
    console.error("GET SALES REPORT ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to generate sales report", error: error.message });
  }
};

/**
 * 2. Item-Wise Sales Report
 * Columns: sl_no, invoice_no, product_name, qty, payment_mode, username, receipt_date, discount_amount, tax_amount, total_amount
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
        COALESCE(GREATEST(0, (si.qty * si.selling_price) - si.amount), 0) AS discount_amount,
        (COALESCE(si.cgst, 0) + COALESCE(si.sgst, 0)) AS tax_amount,
        si.gst_percentage,
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
    const totalDiscount = rows.reduce((sum, r) => sum + Number(r.discount_amount || 0), 0);
    const totalTax = rows.reduce((sum, r) => sum + Number(r.tax_amount || 0), 0);
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

    res.json({
      success: true,
      data: rows,
      total_quantity: totalQuantity,
      total_discount: Number(totalDiscount.toFixed(2)),
      total_tax: Number(totalTax.toFixed(2)),
      total_amount: Number(totalAmount.toFixed(2)),
      count: rows.length,
    });
  } catch (error) {
    console.error("GET ITEM-WISE SALES REPORT ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to generate item-wise sales report", error: error.message });
  }
};

// Sales Bill Report alias:
exports.getSalesBillReport = exports.getSalesReport;

