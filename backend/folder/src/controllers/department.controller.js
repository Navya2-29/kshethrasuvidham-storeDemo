const db = require('../config/db.config');

// GET all departments
exports.getAllDepartments = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, dept_code, dept_name,dept_nameml
       FROM departments
       WHERE is_active = 1
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// CREATE department
exports.createDepartment = async (req, res) => {
  try {
    const { dept_code, dept_name,dept_nameml } = req.body;

    if (!dept_code || !dept_name || !dept_nameml) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const [result] = await db.query(
      `INSERT INTO departments (dept_code, dept_name,dept_nameml)
       VALUES (?, ?, ?)`,
      [dept_code, dept_name, dept_nameml]
    );

    res.status(201).json({
      id: result.insertId,
      dept_code,
      dept_name,
      dept_nameml,
      
    });
  } catch (err) {
    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {

      if (err.sqlMessage.includes('dept_code')) {
        return res.status(400).json({
          message: 'Department code already exists'
        });
      }

      if (err.sqlMessage.includes('uq_dept_name')) {
        return res.status(400).json({
          message: 'Department name already exists'
        });
      }
      if (err.sqlMessage.includes('uq_dept_nameml')) {
        return res.status(400).json({
          message: 'Department name(ml) already exists'
        });
      }
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// UPDATE department
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const {  dept_name,dept_nameml} = req.body;
 if (!dept_name || !dept_nameml) {
      return res.status(400).json({ message: 'Required fields missing' });
    }
    await db.query(
      `UPDATE departments
       SET  dept_name=?,dept_nameml=?
       WHERE id=?`,
      [ dept_name,dept_nameml, id]
    );
    

    res.json({ message: 'Department updated successfully' });
  } catch (err) {
    console.error(err);
    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
  if (err.sqlMessage.includes('dept_code')) {
    return res.status(400).json({ message: 'Department code already exists' });
  }

      if (err.sqlMessage.includes('uq_dept_name')) {
        return res.status(400).json({
          message: 'Department name already exists'
        });
      }
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE department (Soft delete)
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

   await db.query("UPDATE departments SET is_active = 0 WHERE id=?", [id]);

    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
