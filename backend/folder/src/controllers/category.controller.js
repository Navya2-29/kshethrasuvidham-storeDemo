const db = require('../config/db.config');

// GET ALL
exports.getAllCategories = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, category_code, category_name, category_nameml
      FROM categories
      WHERE is_active = 1
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// CREATE
exports.createCategory = async (req, res) => {
  try {
    const { category_code, category_name, category_nameml } = req.body;

    if (!category_code || !category_name || !category_nameml) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const [result] = await db.query(
      `INSERT INTO categories (category_code, category_name, category_nameml)
       VALUES (?, ?, ?)`,
      [category_code, category_name, category_nameml]
    );

    res.status(201).json({
      id: result.insertId,
      category_code,
      category_name,
      category_nameml,
    });

  } catch (err) {
    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
      if (err.sqlMessage.includes('uq_category_code')) {
        return res.status(400).json({ message: 'Category code already exists' });
      }
      if (err.sqlMessage.includes('uq_category_name')) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
    }

    res.status(500).json({ message: 'Internal server error' });
  }
};

// UPDATE
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_code, category_name, category_nameml } = req.body;
if (!category_code || !category_name || !category_nameml) {
      return res.status(400).json({ message: 'Required fields missing' });
    }
    await db.query(
      `UPDATE categories
       SET category_code=?, category_name=?, category_nameml=?
       WHERE id=?`,
      [category_code, category_name, category_nameml, id]
    );

    res.json({ message: 'Category updated successfully' });

  } catch (err) {
    console.error(err);
     if (err.code === 'ER_DUP_ENTRY') {
      if (err.sqlMessage.includes('uq_category_code')) {
        return res.status(400).json({ message: 'Category code already exists' });
      }
      if (err.sqlMessage.includes('uq_category_name')) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

// SOFT DELETE
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
 await db.query("UPDATE categories SET is_active = 0 WHERE id=?", [id]);
   

    res.json({ message: 'Category deleted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
