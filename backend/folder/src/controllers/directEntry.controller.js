const pool = require('../config/db.config');
const { mirrorToSoleDepartment } = require('../utils/stockSync.util');

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
   CREATE DIRECT ENTRY
========================================== */
exports.createDirectEntry = async (req, res) => {

  const {
    product_id,
    qty,
    cost_price,
    entry_date,
    remarks,
    created_by
  } = req.body;

  let { author_id, publisher_id } = req.body;
  author_id = author_id || null;
  publisher_id = publisher_id || null;

  if (!product_id || !qty || !entry_date) {
    return res.status(400).json({
      error: 'Product, Qty, Date required'
    });
  }

  const bookstore = await isBookstore();
  if (bookstore) {
    const { hasAuthors, hasPublishers } = await productAuthorPublisherRequirement(product_id);
    if (hasAuthors && !author_id) {
      return res.status(400).json({ message: 'Author is required for this product' });
    }
    if (hasPublishers && !publisher_id) {
      return res.status(400).json({ message: 'Publisher is required for this product' });
    }
  }

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    /* INSERT ENTRY */
    const [result] = await conn.query(`
      INSERT INTO direct_entry (
        product_id,
        author_id,
        publisher_id,
        qty,
        cost_price,
        entry_date,
        remarks,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product_id,
      author_id,
      publisher_id,
      qty,
      cost_price || 0,
      entry_date,
      remarks || '',
      created_by || null
    ]);

    /* UPDATE STOCK */
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
    `, [
      product_id,
      qty
    ]);

    await mirrorToSoleDepartment(conn, product_id, qty);

    await conn.commit();

    res.json({
      message: 'Direct entry created successfully',
      id: result.insertId
    });

  } catch (err) {
    if (conn) await conn.rollback();

    res.status(500).json({
      error: err.message
    });

  } finally {
    if (conn) conn.release();
  }
};

/* ==========================================
   GET LIST
========================================== */
exports.getDirectEntries = async (req, res) => {

  try {
    const [rows] = await pool.query(`
  SELECT
    d.id,
    d.product_id,
    d.author_id,
    d.publisher_id,
    d.qty,
    d.cost_price,
    d.entry_date,
    d.remarks,

    p.product_code,
    p.product_name,
    a.author_name,
    pub.publisher_name

  FROM direct_entry d
  INNER JOIN products p
    ON p.id = d.product_id
  LEFT JOIN authors a ON a.id = d.author_id
  LEFT JOIN publishers pub ON pub.id = d.publisher_id

  WHERE d.is_deleted = 0
  ORDER BY d.id DESC
`);

    res.json(rows);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};

/* ==========================================
   UPDATE ENTRY (ADJUST STOCK DIFF)
========================================== */
exports.updateDirectEntry = async (req, res) => {

  const id = req.params.id;

  const {
    qty,
    cost_price,
    entry_date,
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

    /* OLD DATA */
    const [oldRows] = await conn.query(`
      SELECT product_id, qty
      FROM direct_entry
      WHERE id = ? AND is_deleted = 0
    `, [id]);

    if (!oldRows.length) {
      await conn.rollback();
      return res.status(404).json({
        error: 'Entry not found'
      });
    }

    const old = oldRows[0];

    const bookstore = await isBookstore();
    if (bookstore) {
      const { hasAuthors, hasPublishers } = await productAuthorPublisherRequirement(old.product_id);
      if (hasAuthors && !author_id) {
        await conn.rollback();
        return res.status(400).json({ message: 'Author is required for this product' });
      }
      if (hasPublishers && !publisher_id) {
        await conn.rollback();
        return res.status(400).json({ message: 'Publisher is required for this product' });
      }
    }

    const diff = Number(qty) - Number(old.qty);

    /* UPDATE ENTRY */
    await conn.query(`
      UPDATE direct_entry
      SET
        author_id = ?,
        publisher_id = ?,
        qty = ?,
        cost_price = ?,
        entry_date = ?,
        remarks = ?,
        updated_by = ?
      WHERE id = ?
    `, [
      author_id,
      publisher_id,
      qty,
      cost_price || 0,
      entry_date,
      remarks || '',
      updated_by || null,
      id
    ]);

    /* UPDATE STOCK */
    if (diff !== 0) {
      await conn.query(`
        UPDATE stock
        SET qty = qty + ?
        WHERE product_id = ?
          AND location_type = 'MAIN_STORE'
          AND location_id = 0
      `, [
        diff,
        old.product_id
      ]);

      await mirrorToSoleDepartment(conn, old.product_id, diff);
    }

    await conn.commit();

    res.json({
      message: 'Updated successfully'
    });

  } catch (err) {
    if (conn) await conn.rollback();

    res.status(500).json({
      error: err.message
    });

  } finally {
    if (conn) conn.release();
  }
};

/* ==========================================
   DELETE ENTRY (SOFT + STOCK REVERSE)
========================================== */
exports.deleteDirectEntry = async (req, res) => {

  const id = req.params.id;
  const { deleted_by } = req.body;

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(`
      SELECT product_id, qty
      FROM direct_entry
      WHERE id = ? AND is_deleted = 0
    `, [id]);

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({
        error: 'Not found'
      });
    }

    const row = rows[0];

    /* SOFT DELETE */
    await conn.query(`
      UPDATE direct_entry
      SET is_deleted = 1,
          deleted_by = ?,
          deleted_at = NOW()
      WHERE id = ?
    `, [deleted_by || null, id]);

    /* REVERSE STOCK */
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
      message: 'Deleted successfully'
    });

  } catch (err) {
    if (conn) await conn.rollback();

    res.status(500).json({
      error: err.message
    });

  } finally {
    if (conn) conn.release();
  }
};