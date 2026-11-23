const db = require("../config/db.config");

exports.getProductWiseReport = async (req, res) => {
  try {
    const { product_id, from_date, to_date } = req.body;

    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: "From date and To date are required",
      });
    }

    let query = `
      SELECT 
        ph.invoice_no,
        ph.invoice_date,
        s.company_name AS supplier_name,
        pi.qty,
        pi.unit,
        pi.cost_price,
        pi.amount
      FROM purchase_items pi
      JOIN purchase_header ph ON pi.purchase_id = ph.id
      JOIN suppliers s ON ph.supplier_id = s.id
      WHERE ph.invoice_date BETWEEN ? AND ?
    `;

    let params = [from_date, to_date];

    if (product_id) {
      query += ` AND pi.product_id = ?`;
      params.push(product_id);
    }

    query += ` ORDER BY ph.invoice_date ASC`;

    const [rows] = await db.query(query, params);

    const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const formattedTotal = Number(total.toFixed(2));
    res.json({
      success: true,
      data: rows,
      total: formattedTotal,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
