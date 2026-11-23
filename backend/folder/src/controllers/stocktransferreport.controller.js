const db = require("../config/db.config");
const { getSoleDepartmentId } = require("../utils/stockSync.util");

exports.getAvailableStockByProduct = async (req, res) => {
 const product_id = req.params.id;

  if (!product_id) {
    return res.status(400).json({
      success: false,
      message: "Product ID is required"
    });
  }

  try {
    // Every transaction writes to the single unified `stock` table
    // (location_type discriminates MAIN_STORE vs DEPARTMENT) - `stock_main`/
    // `stock_department` used previously here are stale tables nothing
    // populates, which made this report always return empty data.
    //
    // In single-department stores, MAIN_STORE is only ever a mirror of the
    // sole department (see stockSync.util.js) and is never reduced by sales,
    // so it's excluded there to avoid double-counting - the department row
    // alone is authoritative.
    const soleDeptId = await getSoleDepartmentId(db);

    // 🔹 Main Store Stock
    const [mainStock] = soleDeptId
      ? [[]]
      : await db.query(
          `
      SELECT
        p.product_code,
        p.product_name,
        c.category_name,
        'Main Store' AS department_name,
        (s.qty + s.free_qty) AS quantity
      FROM stock s
      JOIN products p ON p.id = s.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.product_id = ?
      AND s.location_type = 'MAIN_STORE'
      AND s.location_id = 0
      AND (s.qty + s.free_qty) > 0
      `,
          [product_id]
        );

    // 🔹 Department Stock
    const [deptStock] = await db.query(
      `
      SELECT
        p.product_code,
        p.product_name,
        c.category_name,
        d.dept_name AS department_name,
        s.qty AS quantity
      FROM stock s
      JOIN products p ON p.id = s.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      JOIN departments d ON d.id = s.location_id
      WHERE s.product_id = ?
      AND s.location_type = 'DEPARTMENT'
      AND s.qty > 0
      ${soleDeptId ? "AND s.location_id = ?" : ""}
      `,
      soleDeptId ? [product_id, soleDeptId] : [product_id]
    );

    const result = [...mainStock, ...deptStock];

    // 🔹 Calculate total stock
    const totalStock = result.reduce(
      (sum, row) => sum + Number(row.quantity),
      0
    );

    res.json({
      success: true,
      count: result.length,
      total_stock: totalStock,
      data: result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};