const db = require("../config/db.config");
const { generateInvoice } = require("../services/invoiceService");

const ORDER_PREFIX = "order";

function getMonthYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  return month + year;
}

async function isBookstore() {
  const [[row]] = await db.query(
    "SELECT is_bookstore FROM client_settings WHERE id = 1"
  );
  return !!(row && row.is_bookstore);
}

// Author/Publisher are only required when the product actually has at least
// one of each configured - otherwise a product missing that Product Master
// data would make this order permanently unsavable.
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

// GET next order number (preview only - does not allocate)
exports.getNextOrderNo = async (req, res) => {
  try {
    const monthKey = getMonthYear();

    const [[row]] = await db.query(
      `SELECT last_number FROM invoice_sequence WHERE prefix = ? AND month_key = ?`,
      [ORDER_PREFIX, monthKey]
    );

    const nextSerial = (row?.last_number || 0) + 1;

    res.json({ order_no: `${ORDER_PREFIX}-${nextSerial}/${monthKey}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// CREATE
exports.createOrder = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { supplier_id, order_date, items } = req.body;

    if (!supplier_id || !order_date) {
      return res.status(400).json({ message: "Supplier and Order Date are required" });
    }

    const bookstore = await isBookstore();
    const itemsError = await validateItems(items, bookstore);
    if (itemsError) {
      return res.status(400).json({ message: itemsError });
    }

    await conn.beginTransaction();

    // Order number is always generated server-side - never trust a
    // client-supplied value, to avoid duplicates/races.
    const order_no = await generateInvoice(ORDER_PREFIX, conn);

    const [result] = await conn.query(
      `INSERT INTO orders (order_no, supplier_id, order_date)
       VALUES (?, ?, ?)`,
      [order_no, supplier_id, order_date]
    );

    const orderId = result.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, author_id, publisher_id, qty)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.author_id || null, item.publisher_id || null, item.qty]
      );
    }

    await conn.commit();

    res.status(201).json({ id: orderId, order_no, message: "Order created successfully" });
  } catch (err) {
    await conn.rollback();
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Order number already exists, please retry" });
    }

    res.status(500).json({ message: "Server error" });
  } finally {
    conn.release();
  }
};

// GET ALL
exports.getOrders = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT o.id, o.order_no, o.order_date,
             s.supplier_name, s.mobile_number
      FROM orders o
      JOIN suppliers s ON s.id = o.supplier_id
      WHERE o.is_deleted = 0
      ORDER BY o.id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET BY ID
exports.getOrderById = async (req, res) => {
  try {
    const id = req.params.id;

    const [order] = await db.query(`SELECT * FROM orders WHERE id = ?`, [id]);

    if (!order.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const [items] = await db.query(
      `SELECT oi.*, a.author_name, pub.publisher_name
       FROM order_items oi
       LEFT JOIN authors a ON a.id = oi.author_id
       LEFT JOIN publishers pub ON pub.id = oi.publisher_id
       WHERE oi.order_id = ?`,
      [id]
    );

    res.json({
      ...order[0],
      items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET BY ORDER NUMBER (used by Purchase to pull in items from an order)
exports.getOrderByNumber = async (req, res) => {
  try {
    const { orderNo } = req.params;

    const [order] = await db.query(
      `SELECT * FROM orders WHERE order_no = ? AND is_deleted = 0`,
      [orderNo]
    );

    if (!order.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const [items] = await db.query(
      `SELECT oi.*, p.product_code, p.product_name, a.author_name, pub.publisher_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN authors a ON a.id = oi.author_id
       LEFT JOIN publishers pub ON pub.id = oi.publisher_id
       WHERE oi.order_id = ?`,
      [order[0].id]
    );

    res.json({
      ...order[0],
      items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE (order number is never changed)
exports.updateOrder = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const id = req.params.id;
    const { supplier_id, order_date, items } = req.body;

    if (!supplier_id || !order_date) {
      return res.status(400).json({ message: "Supplier and Order Date are required" });
    }

    const bookstore = await isBookstore();
    const itemsError = await validateItems(items, bookstore);
    if (itemsError) {
      return res.status(400).json({ message: itemsError });
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE orders SET supplier_id=?, order_date=? WHERE id=?`,
      [supplier_id, order_date, id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Order not found" });
    }

    await conn.query(`DELETE FROM order_items WHERE order_id=?`, [id]);

    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, author_id, publisher_id, qty)
         VALUES (?, ?, ?, ?, ?)`,
        [id, item.product_id, item.author_id || null, item.publisher_id || null, item.qty]
      );
    }

    await conn.commit();

    res.json({ message: "Order updated successfully" });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    conn.release();
  }
};

// DELETE (Soft)
exports.deleteOrder = async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE orders SET is_deleted=1 WHERE id=? AND is_deleted=0`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
