const db = require("../config/db.config");

// ================= GET ALL =================
exports.getAllPublishers = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM publishers WHERE is_active = 1 ORDER BY id DESC'
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= CREATE =================
exports.createPublisher = async (req, res) => {
  try {
    const publisher_name = (req.body.publisher_name || '').trim();

    if (!publisher_name) {
      return res.status(400).json({ message: 'Publisher name is required' });
    }

    const [result] = await db.query(
      'INSERT INTO publishers (publisher_name, is_active) VALUES (?, 1)',
      [publisher_name]
    );

    res.status(201).json({ id: result.insertId, message: 'Publisher created successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Publisher name already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= UPDATE =================
exports.updatePublisher = async (req, res) => {
  try {
    const { id } = req.params;
    const publisher_name = (req.body.publisher_name || '').trim();

    if (!publisher_name) {
      return res.status(400).json({ message: 'Publisher name is required' });
    }

    const [result] = await db.query(
      'UPDATE publishers SET publisher_name=? WHERE id=? AND is_active=1',
      [publisher_name, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Publisher not found' });
    }

    res.json({ message: 'Publisher updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Publisher name already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= DELETE (SOFT DELETE) =================
exports.deletePublisher = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      'UPDATE publishers SET is_active=0 WHERE id=? AND is_active=1',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Publisher not found' });
    }

    res.json({ message: 'Publisher deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
