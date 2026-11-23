const db = require('../config/db.config');

// GET ALL AUTHORS
exports.getAllAuthors = async (req, res) => {
  try {
    const [result] = await db.query(
      'SELECT * FROM authors WHERE is_active=1 ORDER BY id DESC'
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// CREATE AUTHOR
exports.createAuthor = async (req, res) => {
  try {
    const author_name = (req.body.author_name || '').trim();

    if (!author_name) {
      return res.status(400).json({ message: 'Author name is required' });
    }

    const [result] = await db.query(
      'INSERT INTO authors (author_name, is_active) VALUES (?, 1)',
      [author_name]
    );

    res.status(201).json({ id: result.insertId, message: 'Author created successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Author name already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// UPDATE AUTHOR
exports.updateAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    const author_name = (req.body.author_name || '').trim();

    if (!author_name) {
      return res.status(400).json({ message: 'Author name is required' });
    }

    const [result] = await db.query(
      'UPDATE authors SET author_name=? WHERE id=? AND is_active=1',
      [author_name, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Author not found' });
    }

    res.json({ message: 'Author updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Author name already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE AUTHOR (soft delete)
exports.deleteAuthor = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      'UPDATE authors SET is_active=0 WHERE id=? AND is_active=1',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Author not found' });
    }

    res.json({ message: 'Author deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
