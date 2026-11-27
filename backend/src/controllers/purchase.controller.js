const db = require("../config/db.config");
const { mirrorToSoleDepartment } = require("../utils/stockSync.util");

async function isBookstore() {
  const [[row]] = await db.query(
    "SELECT is_bookstore FROM client_settings WHERE id = 1"
  );
  return !!(row && row.is_bookstore);
}

// Author/Publisher are only required when the product actually has at least
// one of each configured - otherwise a product missing that Product Master
// data would make this purchase permanently unsavable.
async function productAuthorPublisherRequirement(product_id) {
  const [[row]] = await db.query(
    `SELECT
       EXISTS(SELECT 1 FROM product_authors WHERE product_id = ?) AS hasAuthors,
       EXISTS(SELECT 1 FROM product_publishers WHERE product_id = ?) AS hasPublishers`,
    [product_id, product_id]
  );
  return { hasAuthors: !!row?.hasAuthors, hasPublishers: !!row?.hasPublishers };
}

async function validateItems(items, bookstore) {
  if (!Array.isArray(items) || items.length === 0) {
    return "At least one item is required";
  }

  for (const item of items) {
    if (!item.product_id) return "Product is required for every item";

    const qty = Number(item.qty);
    if (!qty || qty <= 0) return "Quantity must be greater than 0 for every item";

    if (bookstore) {
      const { hasAuthors, hasPublishers } = await productAuthorPublisherRequirement(item.product_id);
      if (hasAuthors && !item.author_id) return "Author is required for every book item";
      if (hasPublishers && !item.publisher_id) return "Publisher is required for every book item";
    }
  }

  return null;
}

exports.createPurchase = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { header, items } = req.body;

    if (!header?.invoice_no || !header?.supplier_id || !header?.invoice_date || !header?.receipt_date) {
      return res.status(400).json({
        message: "Invoice No, Supplier, Invoice Date and Receipt Date are required",
      });
    }

    const bookstore = await isBookstore();
    const itemsError = await validateItems(items, bookstore);
    if (itemsError) {
      return res.status(400).json({ message: itemsError });
    }

    await conn.beginTransaction();

    // Insert Header
    const [result] = await conn.query(
      `INSERT INTO purchase_header
      (order_no, invoice_no, supplier_id, invoice_date, receipt_date,
       total_amount, discount_amount, other_charges, bill_amount, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        header.order_no,
        header.invoice_no,
        header.supplier_id,
        header.invoice_date,
        header.receipt_date,
        header.total_amount,
        header.discount_amount,
        header.other_charges,
        header.bill_amount,
        header.created_by
      ]
    );

    const purchaseId = result.insertId;

    for (let item of items) {
      const qty = Number(item.qty) || 0;
      const free_qty = Number(item.free_qty) || 0;
      const cost_price = Number(item.cost_price) || 0;
      const mrp = Number(item.mrp) || 0;
      const amount = Number(item.amount) || 0;
      const discount = Number(item.discount) || 0;

      await conn.query(
        `INSERT INTO purchase_items
        (purchase_id, product_id, author_id, publisher_id, qty, free_qty, unit, mrp, cost_price, cgst, sgst, amount, hsn_code, gst_percent, discount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          item.product_id,
          item.author_id || null,
          item.publisher_id || null,
          qty,
          free_qty,
          item.unit,
          mrp,
          cost_price,
          item.cgst,
          item.sgst,
          amount,
          item.hsn_code || '',
          item.gst_percent,
          discount
        ]
      );

      // Update STOCK (MAIN STORE / godown - purchases always land here,
      // regardless of which department is selected in the app; stock only
      // reaches a department via Stock Transfer)
      await conn.query(
        `INSERT INTO stock
        (product_id, location_type, location_id, qty, free_qty)
        VALUES (?, 'MAIN_STORE', 0, ?, ?)
        ON DUPLICATE KEY UPDATE
          qty = qty + VALUES(qty),
          free_qty = free_qty + VALUES(free_qty)`,
        [item.product_id, qty, free_qty]
      );

      await mirrorToSoleDepartment(conn, item.product_id, qty, free_qty);
    }

    await conn.commit();

    res.status(201).json({
      message: "Purchase saved successfully"
    });

  } catch (err) {
    await conn.rollback();

    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        message: "Invoice already exists"
      });
    }

    res.status(500).json({
      message: "Purchase failed"
    });
  } finally {
    conn.release();
  }
};

// Get All Purchases (with supplier name, cancelled info, and product names)
exports.getAllPurchases = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        ph.id,
        ph.order_no,
        ph.invoice_no,
        ph.supplier_id,
        ph.invoice_date,
        ph.receipt_date,
        ph.total_amount,
        ph.discount_amount,
        ph.other_charges,
        ph.bill_amount,
        ph.status,
        ph.cancel_reason,
        ph.cancelled_by,
        ph.cancelled_at,
        u.username AS cancelled_by_name,
        s.supplier_name,
        s.mobile AS supplier_mobile,
        (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = ph.id) AS total_items,
        (SELECT GROUP_CONCAT(CONCAT(p.product_name, IF(pi.qty > 1, CONCAT(' (x', pi.qty, ')'), '')) SEPARATOR ', ')
         FROM purchase_items pi
         LEFT JOIN products p ON pi.product_id = p.id
         WHERE pi.purchase_id = ph.id) AS product_names
      FROM purchase_header ph
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      LEFT JOIN users u ON ph.cancelled_by = u.id
      ORDER BY ph.id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("GET ALL PURCHASES ERROR:", err);
    res.status(500).json({ message: "Error fetching purchases" });
  }
};

exports.updatePurchase = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const id = req.params.id;
    const { header, items } = req.body;

    if (!header?.invoice_no || !header?.supplier_id || !header?.invoice_date || !header?.receipt_date) {
      return res.status(400).json({
        message: "Invoice No, Supplier, Invoice Date and Receipt Date are required",
      });
    }

    const bookstore = await isBookstore();
    const itemsError = await validateItems(items, bookstore);
    if (itemsError) {
      return res.status(400).json({ message: itemsError });
    }

    await conn.beginTransaction();

    const [existingHeader] = await conn.query(
      `SELECT status FROM purchase_header WHERE id=?`,
      [id]
    );

    if (!existingHeader.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Purchase not found" });
    }

    if (existingHeader[0].status === 'CANCELLED') {
      await conn.rollback();
      return res.status(400).json({ message: "This purchase has been cancelled and cannot be edited" });
    }

    // 1) Get old items
    const [oldItems] = await conn.query(
      `SELECT * FROM purchase_items WHERE purchase_id=?`,
      [id]
    );

    // 2) Reverse old stock
    for (let old of oldItems) {
      await conn.query(
        `UPDATE stock
         SET
           qty = qty - ?,
           free_qty = free_qty - ?
         WHERE product_id=?
         AND location_type='MAIN_STORE'
         AND location_id=0`,
        [old.qty, old.free_qty, old.product_id]
      );

      await mirrorToSoleDepartment(conn, old.product_id, -old.qty, -old.free_qty);
    }

    // 3) Update header
    const [headerResult] = await conn.query(
      `UPDATE purchase_header SET
        order_no=?,
        invoice_no=?,
        supplier_id=?,
        invoice_date=?,
        receipt_date=?,
        total_amount=?,
        discount_amount=?,
        other_charges=?,
        bill_amount=?
      WHERE id=?`,
      [
        header.order_no,
        header.invoice_no,
        header.supplier_id,
        header.invoice_date,
        header.receipt_date,
        header.total_amount,
        header.discount_amount,
        header.other_charges,
        header.bill_amount,
        id
      ]
    );

    if (headerResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Purchase not found" });
    }

    // 4) Delete old items
    await conn.query(
      `DELETE FROM purchase_items WHERE purchase_id=?`,
      [id]
    );

    // 5) Insert new items + stock
    for (let item of items) {
      const qty = Number(item.qty) || 0;
      const free_qty = Number(item.free_qty) || 0;
      const cost_price = Number(item.cost_price) || 0;
      const mrp = Number(item.mrp) || 0;
      const discount = Number(item.discount) || 0;

      await conn.query(
        `INSERT INTO purchase_items
        (purchase_id, product_id, author_id, publisher_id, qty, free_qty, unit, mrp, cost_price, cgst, sgst, amount, hsn_code, gst_percent, discount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.product_id,
          item.author_id || null,
          item.publisher_id || null,
          qty,
          free_qty,
          item.unit,
          mrp,
          cost_price,
          Number(item.cgst) || 0,
          Number(item.sgst) || 0,
          Number(item.amount) || 0,
          item.hsn_code || '',
          Number(item.gst_percent) || 0,
          discount
        ]
      );

      await conn.query(
        `INSERT INTO stock
        (product_id, location_type, location_id, qty, free_qty, cost_price, mrp)
        VALUES (?, 'MAIN_STORE', 0, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          qty = qty + VALUES(qty),
          free_qty = free_qty + VALUES(free_qty),
          cost_price = VALUES(cost_price),
          mrp = VALUES(mrp)`,
        [item.product_id, qty, free_qty, cost_price, mrp]
      );

      await mirrorToSoleDepartment(conn, item.product_id, qty, free_qty);
    }

    await conn.commit();

    res.json({ message: "Purchase updated successfully" });
  } catch (err) {
    await conn.rollback();
    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: "Invoice already exists" });
    }

    res.status(500).json({
      message: "Update failed"
    });
  } finally {
    conn.release();
  }
};

// Cancel a purchase (not a delete) - reverses its stock impact and records
// who cancelled it and why. A cancelled purchase stays visible for audit but
// can never be edited or cancelled again.
exports.cancelPurchase = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;
    const { cancel_reason, cancelled_by } = req.body;

    if (!cancel_reason || !cancel_reason.trim()) {
      return res.status(400).json({ message: "Cancellation reason is required" });
    }

    await conn.beginTransaction();

    const [headerRows] = await conn.query(
      `SELECT status FROM purchase_header WHERE id=?`,
      [id]
    );

    if (!headerRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Purchase not found" });
    }

    if (headerRows[0].status === 'CANCELLED') {
      await conn.rollback();
      return res.status(400).json({ message: "This purchase is already cancelled" });
    }

    const [items] = await conn.query(
      `SELECT * FROM purchase_items WHERE purchase_id=?`,
      [id]
    );

    for (const item of items) {
      await conn.query(
        `UPDATE stock
         SET qty = qty - ?, free_qty = free_qty - ?
         WHERE product_id=?
         AND location_type='MAIN_STORE'
         AND location_id=0`,
        [item.qty, item.free_qty, item.product_id]
      );

      await mirrorToSoleDepartment(conn, item.product_id, -item.qty, -item.free_qty);
    }

    await conn.query(
      `UPDATE purchase_header SET
        status='CANCELLED',
        cancel_reason=?,
        cancelled_by=?,
        cancelled_at=NOW()
      WHERE id=?`,
      [cancel_reason.trim(), cancelled_by || null, id]
    );

    await conn.commit();

    res.json({ message: "Purchase cancelled successfully" });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Cancel failed" });
  } finally {
    conn.release();
  }
};

exports.getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const [headerRows] = await db.query(
      `SELECT ph.*, s.supplier_name, s.mobile AS supplier_mobile, u.username AS cancelled_by_name
       FROM purchase_header ph
       LEFT JOIN suppliers s ON ph.supplier_id = s.id
       LEFT JOIN users u ON ph.cancelled_by = u.id
       WHERE ph.id = ?`,
      [id]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    const [items] = await db.query(
      `SELECT pi.*, p.product_name, p.product_code, a.author_name, pub.publisher_name
       FROM purchase_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       LEFT JOIN authors a ON a.id = pi.author_id
       LEFT JOIN publishers pub ON pub.id = pi.publisher_id
       WHERE pi.purchase_id = ?`,
      [id]
    );

    res.json({
      header: headerRows[0],
      items: items
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error fetching purchase"
    });
  }
};
