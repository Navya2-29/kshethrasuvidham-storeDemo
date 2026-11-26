const db = require('../config/db.config');
const { getSoleDepartmentId } = require('../utils/stockSync.util');

exports.getDashboard = async (req, res) => {
  try {

    const [[sales]] = await db.query(`
      SELECT COALESCE(SUM(bill_amount),0) totalSales
      FROM sales_header
      WHERE status='ACTIVE'
    `);

    const [[purchase]] = await db.query(`
      SELECT COALESCE(SUM(bill_amount),0) totalPurchase
      FROM purchase_header
      WHERE is_deleted = 0
    `);

    const [[todaySales]] = await db.query(`
      SELECT COALESCE(SUM(bill_amount),0) total
      FROM sales_header
      WHERE receipt_date = CURDATE()
      AND status='ACTIVE'
    `);

    const [[todayPurchase]] = await db.query(`
      SELECT COALESCE(SUM(bill_amount),0) total
      FROM purchase_header
      WHERE receipt_date = CURDATE()
      AND is_deleted = 0
    `);

    const [[orders]] = await db.query(`
      SELECT COUNT(*) totalOrders
      FROM sales_header
      WHERE status='ACTIVE'
    `);

    const [[purchaseBills]] = await db.query(`
      SELECT COUNT(*) totalPurchaseBills
      FROM purchase_header
      WHERE is_deleted = 0
    `);

    const [[products]] = await db.query(`
      SELECT COUNT(*) totalProducts
      FROM products
      WHERE is_active = 1
    `);

    const [[suppliers]] = await db.query(`
      SELECT COUNT(*) totalSuppliers
      FROM suppliers
      WHERE is_active = 1
    `);

    // Single-department stores mirror every MAIN_STORE change into the sole
    // department but never reduce MAIN_STORE for sales, so it's a stale,
    // ever-growing number there - the department row is the accurate one.
    const soleDeptId = await getSoleDepartmentId(db);

    const [[stock]] = await db.query(
      soleDeptId
        ? `SELECT COALESCE(SUM(qty + free_qty - damaged_qty),0) totalStock
           FROM stock WHERE location_type='DEPARTMENT' AND location_id = ?`
        : `SELECT COALESCE(SUM(qty + free_qty - damaged_qty),0) totalStock
           FROM stock WHERE location_type='MAIN_STORE'`,
      soleDeptId ? [soleDeptId] : []
    );

    const [[profit]] = await db.query(`
      SELECT COALESCE(SUM((si.selling_price - si.cost_price) * si.qty),0) profit
      FROM sales_items si
      JOIN sales_header sh ON sh.id = si.sales_id
      WHERE sh.status='ACTIVE'
    `);

    const [topProducts] = await db.query(`
      SELECT 
        p.product_name,
        SUM(si.qty) qty,
        SUM(si.amount) amount
      FROM sales_items si
      JOIN products p ON p.id = si.product_id
      GROUP BY si.product_id
      ORDER BY qty DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        totalSales: Number(sales.totalSales),
        totalPurchase: Number(purchase.totalPurchase),
        revenue: Number(sales.totalSales) - Number(purchase.totalPurchase),

        todaySales: Number(todaySales.total),
        todayPurchase: Number(todayPurchase.total),

        totalOrders: Number(orders.totalOrders),
        totalBills: Number(orders.totalOrders),
        totalPurchaseBills: Number(purchaseBills.totalPurchaseBills),

        totalProducts: Number(products.totalProducts),
        totalSuppliers: Number(suppliers.totalSuppliers),

        totalStock: Number(stock.totalStock),
        profit: Number(profit.profit),

        topProducts
      }
    });

  } catch (err) {
    console.error('Dashboard Error:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};