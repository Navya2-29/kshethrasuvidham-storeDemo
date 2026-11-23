const pool = require("../config/db.config");
const { mirrorToSoleDepartment } = require("../utils/stockSync.util");

/* =====================================================
   HELPERS
===================================================== */
function getFinancialYear(dateString) {
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  return month >= 4
    ? `${year}-${year + 1}`
    : `${year - 1}-${year}`;
}

async function isBookstore() {
  const [[row]] = await pool.query(
    'SELECT is_bookstore FROM client_settings WHERE id = 1'
  );
  return !!(row && row.is_bookstore);
}

// Author/Publisher are only required when the product actually has at least
// one of each configured - otherwise a product missing that Product Master
// data would make this transaction permanently unsavable.
async function productAuthorPublisherRequirement(product_id) {
  const [[row]] = await pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM product_authors WHERE product_id = ?) AS hasAuthors,
       EXISTS(SELECT 1 FROM product_publishers WHERE product_id = ?) AS hasPublishers`,
    [product_id, product_id]
  );
  return { hasAuthors: !!row?.hasAuthors, hasPublishers: !!row?.hasPublishers };
}

/* ==========================================
   GET ALL OPENING STOCK LIST
========================================== */
exports.getOpenings = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        os.id,
        os.product_id,
        os.author_id,
        os.publisher_id,
        p.product_code,
        p.product_name,
        a.author_name,
        pub.publisher_name,

        os.qty,
        os.cost_price,

        (os.qty * os.cost_price) AS total_value,

        os.opening_date,
        os.financial_year,
        os.remarks,

        os.created_by,
        os.created_at,
        os.updated_by,
        os.updated_at

      FROM opening_stock os
      INNER JOIN products p
        ON p.id = os.product_id
      LEFT JOIN authors a ON a.id = os.author_id
      LEFT JOIN publishers pub ON pub.id = os.publisher_id

      WHERE os.is_deleted = 0

      ORDER BY os.id DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch opening stock list"
    });
  }
};

/* =====================================================
   CREATE OPENING STOCK
===================================================== */
exports.createOpening = async (req, res) => {
  const {
    product_id,
    qty,
    cost_price,
    opening_date,
    remarks,
    created_by
  } = req.body;

  let { author_id, publisher_id } = req.body;
  author_id = author_id || null;
  publisher_id = publisher_id || null;

  if (!product_id || qty == null || cost_price == null || !opening_date) {
    return res.status(400).json({
      error: "product_id, qty, cost_price, opening_date required"
    });
  }

  const bookstore = await isBookstore();
  if (bookstore) {
    const { hasAuthors, hasPublishers } = await productAuthorPublisherRequirement(product_id);
    if (hasAuthors && !author_id) {
      return res.status(400).json({ message: "Author is required for this product" });
    }
    if (hasPublishers && !publisher_id) {
      return res.status(400).json({ message: "Publisher is required for this product" });
    }
  }

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const fy = getFinancialYear(opening_date);

    // prevent duplicate opening
    const [exists] = await conn.query(`
      SELECT id
      FROM opening_stock
      WHERE product_id = ?
        AND financial_year = ?
        AND is_deleted = 0
      LIMIT 1
    `, [product_id, fy]);

    if (exists.length > 0) {
      await conn.rollback();
      return res.status(400).json({
        message: "Opening stock already exists for this product in this financial year"
      });
    }

    // insert opening
    const [result] = await conn.query(`
      INSERT INTO opening_stock (
        product_id,
        author_id,
        publisher_id,
        qty,
        cost_price,
        opening_date,
        financial_year,
        remarks,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product_id,
      author_id,
      publisher_id,
      qty,
      cost_price,
      opening_date,
      fy,
      remarks || "",
      created_by || null
    ]);

    // increase MAIN_STORE stock
    await conn.query(`
      INSERT INTO stock (
        product_id,
        location_type,
        location_id,
        qty
      )
      VALUES (?, 'MAIN_STORE', 0, ?)
      ON DUPLICATE KEY UPDATE
      qty = qty + VALUES(qty)
    `, [product_id, qty]);

    await mirrorToSoleDepartment(conn, product_id, qty);

    await conn.commit();

    res.json({
      message: "Opening stock created successfully",
      id: result.insertId
    });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
};


/* =====================================================
   UPDATE OPENING STOCK
===================================================== */
exports.updateOpening = async (req, res) => {
  const { id } = req.params;

  const {
    qty,
    cost_price,
    opening_date,
    remarks,
    updated_by
  } = req.body;

  let { author_id, publisher_id } = req.body;
  author_id = author_id || null;
  publisher_id = publisher_id || null;

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // get old row
    const [rows] = await conn.query(`
      SELECT *
      FROM opening_stock
      WHERE id = ?
        AND is_deleted = 0
      LIMIT 1
    `, [id]);

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Opening stock not found" });
    }

    const oldRow = rows[0];

    const bookstore = await isBookstore();
    if (bookstore) {
      const { hasAuthors, hasPublishers } = await productAuthorPublisherRequirement(oldRow.product_id);
      if (hasAuthors && !author_id) {
        await conn.rollback();
        return res.status(400).json({ message: "Author is required for this product" });
      }
      if (hasPublishers && !publisher_id) {
        await conn.rollback();
        return res.status(400).json({ message: "Publisher is required for this product" });
      }
    }

    const newQty = qty == null ? Number(oldRow.qty) : Number(qty);
    const oldQty = Number(oldRow.qty);

    const diffQty = newQty - oldQty;

    const newDate = opening_date || oldRow.opening_date;
    const fy = getFinancialYear(newDate);

    // update opening table
    await conn.query(`
      UPDATE opening_stock
      SET qty = ?,
          cost_price = ?,
          author_id = ?,
          publisher_id = ?,
          opening_date = ?,
          financial_year = ?,
          remarks = ?,
          updated_by = ?
      WHERE id = ?
    `, [
      newQty,
      cost_price == null ? oldRow.cost_price : cost_price,
      author_id,
      publisher_id,
      newDate,
      fy,
      remarks == null ? oldRow.remarks : remarks,
      updated_by || null,
      id
    ]);

    // adjust stock by difference
    await conn.query(`
      UPDATE stock
      SET qty = qty + ?
      WHERE product_id = ?
        AND location_type = 'MAIN_STORE'
        AND location_id = 0
    `, [
      diffQty,
      oldRow.product_id
    ]);

    await mirrorToSoleDepartment(conn, oldRow.product_id, diffQty);

    await conn.commit();

    res.json({
      message: "Opening stock updated successfully"
    });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
};


/* =====================================================
   DELETE OPENING STOCK
===================================================== */
exports.deleteOpening = async (req, res) => {
  const { id } = req.params;
  const { deleted_by } = req.body;

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // get row
    const [rows] = await conn.query(`
      SELECT *
      FROM opening_stock
      WHERE id = ?
        AND is_deleted = 0
      LIMIT 1
    `, [id]);

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Opening stock not found" });
    }

    const row = rows[0];

    // soft delete
    await conn.query(`
      UPDATE opening_stock
      SET is_deleted = 1,
          deleted_by = ?,
          deleted_at = NOW()
      WHERE id = ?
    `, [
      deleted_by || null,
      id
    ]);

    // reduce stock
    await conn.query(`
      UPDATE stock
      SET qty = qty - ?
      WHERE product_id = ?
        AND location_type = 'MAIN_STORE'
        AND location_id = 0
    `, [
      row.qty,
      row.product_id
    ]);

    await mirrorToSoleDepartment(conn, row.product_id, -row.qty);

    await conn.commit();

    res.json({
      message: "Opening stock deleted successfully"
    });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
};