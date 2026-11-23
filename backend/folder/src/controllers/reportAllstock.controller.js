const db = require("../config/db.config");

exports.getStockReport = async (req, res) => {
  try {

    const [rows] = await db.query(`
      SELECT 
          p.id,
          p.product_code,
          p.product_name,
          p.unit,
          c.category_name,
          IFNULL(sm.qty, 0) as qty
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock_main sm ON sm.product_id = p.id
      WHERE p.is_active = 1
      ORDER BY p.product_name
    `);

    res.json(rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};