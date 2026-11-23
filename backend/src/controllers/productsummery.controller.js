const db = require("../config/db.config");
const { getSoleDepartmentId } = require("../utils/stockSync.util");

exports.getProductSummary = async (req, res) => {
  const productId = req.params.productId;
  const financialYear = req.query.financialYear || "2025-26";

  try {
    const [productRows] = await db.query(
      `
  SELECT 
    id,
    product_name,
    product_code,
    unit
  FROM products
  WHERE id = ?
`,
      [productId],
    );

    const product = productRows[0];
    // 1. OPENING STOCK
    const [openingRows] = await db.query(
      `
      SELECT COALESCE(SUM(qty),0) AS opening_qty
      FROM opening_stock
      WHERE product_id = ?
        AND financial_year = ?
        AND is_deleted = 0
    `,
      [productId, financialYear],
    );

    const opening = Number(openingRows[0].opening_qty || 0);

    // 2. PURCHASE STOCK (qty + free_qty)
    const [purchaseRows] = await db.query(
      `
      SELECT 
        COALESCE(SUM(qty),0) AS qty,
        COALESCE(SUM(free_qty),0) AS free_qty
      FROM purchase_items
      WHERE product_id = ?
    `,
      [productId],
    );

    const totalPurchase =
      Number(purchaseRows[0].qty || 0) + Number(purchaseRows[0].free_qty || 0);

    // 3. DIRECT ENTRY
    const [directRows] = await db.query(
      `
      SELECT COALESCE(SUM(qty),0) AS total_direct
      FROM direct_entry
      WHERE product_id = ?
        AND is_deleted = 0
    `,
      [productId],
    );

    const totalDirect = Number(directRows[0].total_direct || 0);

    // 4. SALES
    const [salesRows] = await db.query(
      `
      SELECT COALESCE(SUM(qty),0) AS total_sales
      FROM sales_items
      WHERE product_id = ?
    `,
      [productId],
    );

    const totalSales = Number(salesRows[0].total_sales || 0);

    // 5. STOCK SNAPSHOT
    // In single-department stores, MAIN_STORE is only ever a mirror of the
    // sole department (see stockSync.util.js) - it's never reduced by sales,
    // so summing it together with the department would double-count real
    // stock. There, the department row alone is authoritative.
    const soleDeptId = await getSoleDepartmentId(db);

    const [stockRows] = await db.query(
      soleDeptId
        ? `
      SELECT
        COALESCE(SUM(qty),0) AS qty,
        COALESCE(SUM(free_qty),0) AS free_qty,
        COALESCE(SUM(damaged_qty),0) AS damaged_qty
      FROM stock
      WHERE product_id = ? AND location_type = 'DEPARTMENT' AND location_id = ?
    `
        : `
      SELECT
        COALESCE(SUM(qty),0) AS qty,
        COALESCE(SUM(free_qty),0) AS free_qty,
        COALESCE(SUM(damaged_qty),0) AS damaged_qty
      FROM stock
      WHERE product_id = ?
    `,
      soleDeptId ? [productId, soleDeptId] : [productId],
    );

    const stockQty = Number(stockRows[0].qty || 0);
    const stockFree = Number(stockRows[0].free_qty || 0);
    const damagedQty = Number(stockRows[0].damaged_qty || 0);

    const availableStock = stockQty + stockFree;

    // 6. FINAL CALCULATION
    const qtyInHand = opening + totalPurchase + totalDirect + -totalSales;

    // 7. RESPONSE (FRONTEND FRIENDLY)
    res.json({
      success: true,
      data: {
        productId,

        productName: product?.product_name || "",
        unit: product?.unit || "",
                   productCode:product?.product_code,
        openingStock: opening,

        purchase: {
          totalQty: Number(purchaseRows[0].qty || 0),
          freeQty: Number(purchaseRows[0].free_qty || 0),
          total: totalPurchase,
        },

        directEntry: totalDirect,

        sales: totalSales,

        stock: {
          qty: stockQty,
          freeQty: stockFree,
          damagedQty,
          availableStock,
        },

        qtyInHand,
      },
    });
  } catch (err) {
    console.error("Product Summary Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch product summary",
      error: err.message,
    });
  }
};

exports.getProductDepartmentStock = async (req, res) => {
  const productId = req.params.productId;

  try {
    const [rows] = await db.query(
      `
      SELECT 
        d.dept_name,
        COALESCE(s.qty, 0) AS qty
      FROM departments d
      LEFT JOIN stock s 
        ON s.location_id = d.id 
        AND s.product_id = ?
        AND s.location_type = 'DEPARTMENT'
    `,
      [productId],
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.getAllProductStock = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.product_name,
        c.category_name,
        COALESCE(s.qty,0) as qty
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock s ON s.product_id = p.id
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
};
