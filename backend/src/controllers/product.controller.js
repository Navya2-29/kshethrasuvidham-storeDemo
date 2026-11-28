const db = require("../config/db.config");
const { getSoleDepartmentId } = require("../utils/stockSync.util");

// Ensure is_price_editable column exists in products table
(async () => {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM products LIKE 'is_price_editable'");
    if (!cols || cols.length === 0) {
      await db.query("ALTER TABLE products ADD COLUMN is_price_editable TINYINT(1) NOT NULL DEFAULT 0");
      console.log("Added column is_price_editable to products table");
    }
  } catch (err) {
    // Database connection or table not yet initialized
  }
})();

async function isBookstore() {
  const [[row]] = await db.query(
    "SELECT is_bookstore FROM client_settings WHERE id = 1"
  );
  return !!(row && row.is_bookstore);
}

function toIdArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

// Validates and normalizes the product payload. Returns { errors, values }.
function validateProductInput(body, bookstore) {
  const errors = [];

  const product_name = (body.product_name || "").trim();
  const product_nameml = (body.product_nameml || "").trim();
  const unit = (body.unit || "").trim();
  const sale_item = (body.sale_item || "").trim();
  const category = Number(body.category);

  const cost_price = Number(body.cost_price);
  const mrp = Number(body.mrp);
  const selling_price = Number(body.selling_price);

  const gst_percent =
    body.gst_percent === undefined || body.gst_percent === ""
      ? 0
      : Number(body.gst_percent);
  const min_qty =
    body.min_qty === undefined || body.min_qty === "" ? 0 : Number(body.min_qty);
  const max_qty =
    body.max_qty === undefined || body.max_qty === "" ? 0 : Number(body.max_qty);

  const is_price_editable =
    body.is_price_editable === 1 ||
    body.is_price_editable === true ||
    body.is_price_editable === "1" ||
    body.is_price_editable === "Y"
      ? 1
      : 0;

  const author_ids = toIdArray(body.author_ids);
  const publisher_ids = toIdArray(body.publisher_ids);

  if (!product_name) errors.push("Product name is required");
  if (!product_nameml) errors.push("Product name (regional) is required");
  if (!unit) errors.push("Unit is required");
  if (!category) errors.push("Category is required");
  if (!sale_item) errors.push("Sale item is required");

  if (body.cost_price === undefined || body.cost_price === "" || isNaN(cost_price)) {
    errors.push("Cost amount is required and must be a number");
  }
  if (body.mrp === undefined || body.mrp === "" || isNaN(mrp)) {
    errors.push("MRP is required and must be a number");
  }
  if (body.selling_price === undefined || body.selling_price === "" || isNaN(selling_price)) {
    errors.push("Selling price is required and must be a number");
  }

  if (isNaN(gst_percent) || gst_percent < 0 || gst_percent > 100) {
    errors.push("GST % must be a number between 0 and 100");
  }
  if (isNaN(min_qty) || min_qty < 0) {
    errors.push("Minimum quantity must be a non-negative number");
  }
  if (isNaN(max_qty) || max_qty < 0) {
    errors.push("Maximum quantity must be a non-negative number");
  }
  if (max_qty > 0 && min_qty > max_qty) {
    errors.push("Minimum quantity cannot be greater than maximum quantity");
  }

  if (!isNaN(cost_price) && !isNaN(mrp) && !isNaN(selling_price)) {
    if (!(cost_price < selling_price && selling_price < mrp)) {
      errors.push("Prices must satisfy Cost Price < Selling Price < MRP");
    }
  }

  if (bookstore) {
    if (!author_ids.length) errors.push("At least one author is required for Book Store products");
    if (!publisher_ids.length) errors.push("At least one publisher is required for Book Store products");
  }

  return {
    errors,
    values: {
      product_name,
      product_nameml,
      unit,
      category,
      sale_item,
      is_price_editable,
      cost_price,
      mrp,
      selling_price,
      gst_percent,
      min_qty,
      max_qty,
      author_ids,
      publisher_ids,
      hsn_code: (body.hsn_code || "").trim() || null,
    },
  };
}

function mapDupEntryError(err) {
  if (err.code !== "ER_DUP_ENTRY") return null;
  if (err.sqlMessage.includes("product_code")) return "Product code already exists";
  // Check the more specific key name first - "uq_product_nameml" contains
  // "uq_product_name" as a substring, so order matters here.
  if (err.sqlMessage.includes("uq_product_nameml")) return "Regional name already exists";
  if (err.sqlMessage.includes("uq_product_name")) return "Product name already exists";
  if (err.sqlMessage.includes("uq_hsn_code")) return "HSN code already exists";
  if (err.sqlMessage.includes("uq_product_full")) {
    return "Same product already exists for this category, author and publisher";
  }
  return "Duplicate value";
}

// Shared: fetch products (optionally including inactive) with their
// authors/publishers batched in, to avoid N+1 queries.
async function fetchProducts({ activeOnly }) {
  // In single-department stores, every MAIN_STORE stock change is mirrored
  // into that sole department (see stockSync.util.js) but never reduced by
  // sales - so MAIN_STORE alone would show a stale, ever-growing number.
  // The department's row is the one sales actually keep accurate there.
  const soleDeptId = await getSoleDepartmentId(db);
  const stockLocationType = soleDeptId ? "DEPARTMENT" : "MAIN_STORE";
  const stockLocationId = soleDeptId ? soleDeptId : 0;

  const [rows] = await db.query(
    `
      SELECT p.id,
       p.product_code,
       p.product_name,
       p.product_nameml,
       p.unit,
       c.category_name AS category,
       c.id AS cid,
       a.author_name,
       a.id AS author_id,
       pub.publisher_name,
       pub.id AS publisher_id,
       p.min_qty,
       p.max_qty,
       p.cost_price,
       p.mrp,
       p.selling_price,
       p.gst_percent,
       p.sale_item,
       COALESCE(p.is_price_editable, 0) AS is_price_editable,
       p.hsn_code,
       p.is_active,
       p.created_by,
       u.username AS created_by_name,
       p.created_at,
       p.updated_at,
       COALESCE(s.qty, 0) + COALESCE(s.free_qty, 0) - COALESCE(s.damaged_qty, 0) AS current_stock
FROM products p
JOIN categories c ON p.category_id = c.id
LEFT JOIN authors a ON p.author_id = a.id
LEFT JOIN publishers pub ON p.publisher_id = pub.id
LEFT JOIN users u ON p.created_by = u.id
LEFT JOIN stock s ON s.product_id = p.id AND s.location_type = ? AND s.location_id = ?
${activeOnly ? "WHERE p.is_active = 1" : ""}
ORDER BY p.product_code ASC
`,
    [stockLocationType, stockLocationId]
  );

  const ids = rows.map((r) => r.id);
  const authorsByProduct = {};
  const publishersByProduct = {};

  if (ids.length) {
    const [authorRows] = await db.query(
      `SELECT pa.product_id, a.id, a.author_name
       FROM product_authors pa
       JOIN authors a ON a.id = pa.author_id
       WHERE pa.product_id IN (?)`,
      [ids]
    );
    authorRows.forEach((r) => {
      (authorsByProduct[r.product_id] ??= []).push({ id: r.id, author_name: r.author_name });
    });

    const [publisherRows] = await db.query(
      `SELECT pp.product_id, p.id, p.publisher_name
       FROM product_publishers pp
       JOIN publishers p ON p.id = pp.publisher_id
       WHERE pp.product_id IN (?)`,
      [ids]
    );
    publisherRows.forEach((r) => {
      (publishersByProduct[r.product_id] ??= []).push({ id: r.id, publisher_name: r.publisher_name });
    });
  }

  return rows.map((r) => ({
    ...r,
    authors: authorsByProduct[r.id] || [],
    publishers: publishersByProduct[r.id] || [],
  }));
}

// GET all products (active only - used by the Product Master screen)
exports.getAllProducts = async (req, res) => {
  try {
    const result = await fetchProducts({ activeOnly: true });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET full product report (active + inactive, full details) - used by the
// PDF/Excel bulk export.
exports.getProductsReport = async (req, res) => {
  try {
    const result = await fetchProducts({ activeOnly: false });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// CREATE product
exports.createProduct = async (req, res) => {
  try {
    const bookstore = await isBookstore();
    const product_code = (req.body.product_code || "").trim();
    const { errors, values } = validateProductInput(req.body, bookstore);

    if (!product_code) errors.unshift("Product code is required");

    if (errors.length) {
      return res.status(400).json({ message: errors.join(" | "), errors });
    }

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      const primaryAuthorId = values.author_ids[0] || null;
      const primaryPublisherId = values.publisher_ids[0] || null;

      const [result] = await conn.query(
        `INSERT INTO products (
          product_code, product_name, product_nameml, unit, category_id,
          author_id, publisher_id, min_qty, max_qty, cost_price, selling_price,
          mrp, gst_percent, sale_item, is_price_editable, hsn_code, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product_code,
          values.product_name,
          values.product_nameml,
          values.unit,
          values.category,
          primaryAuthorId,
          primaryPublisherId,
          values.min_qty,
          values.max_qty,
          values.cost_price,
          values.selling_price,
          values.mrp,
          values.gst_percent,
          values.sale_item,
          values.is_price_editable,
          values.hsn_code,
          req.user?.id || null,
        ]
      );

      const productId = result.insertId;

      for (const authorId of values.author_ids) {
        await conn.query(
          "INSERT IGNORE INTO product_authors (product_id, author_id) VALUES (?, ?)",
          [productId, authorId]
        );
      }
      for (const publisherId of values.publisher_ids) {
        await conn.query(
          "INSERT IGNORE INTO product_publishers (product_id, publisher_id) VALUES (?, ?)",
          [productId, publisherId]
        );
      }

      await conn.commit();

      return res.status(201).json({
        id: productId,
        message: "Product created successfully",
      });
    } catch (err) {
      await conn.rollback();
      console.error("CREATE PRODUCT ERROR:", err);

      const dupMessage = mapDupEntryError(err);
      if (dupMessage) return res.status(400).json({ message: dupMessage });

      return res.status(500).json({ message: "Server error" });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("CREATE PRODUCT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const bookstore = await isBookstore();
    const { errors, values } = validateProductInput(req.body, bookstore);

    if (errors.length) {
      return res.status(400).json({ message: errors.join(" | "), errors });
    }

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      const primaryAuthorId = values.author_ids[0] || null;
      const primaryPublisherId = values.publisher_ids[0] || null;

      const [result] = await conn.query(
        `UPDATE products SET
          product_name=?,
          product_nameml=?,
          unit=?,
          category_id=?,
          author_id=?,
          publisher_id=?,
          min_qty=?,
          max_qty=?,
          cost_price=?,
          selling_price=?,
          mrp=?,
          gst_percent=?,
          sale_item=?,
          is_price_editable=?,
          hsn_code=?
        WHERE id=? AND is_active=1`,
        [
          values.product_name,
          values.product_nameml,
          values.unit,
          values.category,
          primaryAuthorId,
          primaryPublisherId,
          values.min_qty,
          values.max_qty,
          values.cost_price,
          values.selling_price,
          values.mrp,
          values.gst_percent,
          values.sale_item,
          values.is_price_editable,
          values.hsn_code,
          id,
        ]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ message: "Product not found" });
      }

      await conn.query("DELETE FROM product_authors WHERE product_id=?", [id]);
      await conn.query("DELETE FROM product_publishers WHERE product_id=?", [id]);

      for (const authorId of values.author_ids) {
        await conn.query(
          "INSERT IGNORE INTO product_authors (product_id, author_id) VALUES (?, ?)",
          [id, authorId]
        );
      }
      for (const publisherId of values.publisher_ids) {
        await conn.query(
          "INSERT IGNORE INTO product_publishers (product_id, publisher_id) VALUES (?, ?)",
          [id, publisherId]
        );
      }

      await conn.commit();

      return res.json({ message: "Product updated successfully" });
    } catch (err) {
      await conn.rollback();
      console.error("UPDATE PRODUCT ERROR:", err);

      const dupMessage = mapDupEntryError(err);
      if (dupMessage) return res.status(400).json({ message: dupMessage });

      return res.status(500).json({ message: "Server error" });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("UPDATE PRODUCT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE product (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "UPDATE products SET is_active = 0 WHERE id=? AND is_active=1",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.productByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const [rows] = await db.query(
      `SELECT
         p.id,
         p.product_code,
         p.product_name,
         p.unit,
         p.category_id,
         c.category_name,
         p.min_qty,
         p.max_qty,
         p.cost_price,
         p.selling_price,
         p.mrp
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.product_code = ?
       AND p.is_active = 1`,
      [code],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(rows[0]); // full product details including category_name
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
