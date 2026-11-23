const db = require('../config/db.config');
const saveBase64Image = require('../utils/saveImage');


// GET SETTINGS (EDIT FORM)
exports.getSettings = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM client_settings WHERE id = 1'
    );

    if (!rows.length) {
      return res.json(null);
    }

    res.json(rows[0]);

  } catch (err) {

    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// save settings
exports.saveSettings = async (req, res) => {
  try {
    const data = req.body || {};



    let logoPath = null;

    // ✅ SAFE CHECK (prevents crash)
    if (
      typeof data.logo === 'string' &&
      data.logo.startsWith('data:image')
    ) {
      logoPath = saveBase64Image(data.logo);
    } else {
      logoPath = data.logo || null;
    }

    const [existing] = await db.query(
      'SELECT id FROM client_settings WHERE id = 1'
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE client_settings SET
          client_name=?,
          address=?,
          email=?,
          phone=?,
          logo=?,
          installation_date=?,
          expiry_date=?,
          notify_before_days=?,
          notification=?,
          printer=?,
          department_count=?,
          is_bookstore=?,
          version_no=?,
          status=IF(expiry_date < CURDATE(),'EXPIRED','ACTIVE')
        WHERE id=1`,
        [
          data.client_name || '',
          data.address || '',
          data.email || '',
          data.phone || '',
          logoPath,
          data.installation_date || null,
          data.expiry_date || null,
          data.notify_before_days || 0,
          data.notification || '',
          data.printer || '',
          data.department_count || 1,
          data.is_bookstore ? 1 : 0,
          data.version_no || ''
        ]
      );
    } else {
      await db.query(
        `INSERT INTO client_settings (
          id, client_name, address, email, phone, logo,
          installation_date, expiry_date, notify_before_days,
          notification, printer, department_count, is_bookstore, version_no, status
        ) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?, 'ACTIVE')`,
        [
          data.client_name || '',
          data.address || '',
          data.email || '',
          data.phone || '',
          logoPath,
          data.installation_date || null,
          data.expiry_date || null,
          data.notify_before_days || 0,
          data.notification || '',
          data.printer || '',
          data.department_count || 1,
          data.is_bookstore ? 1 : 0,
          data.version_no || ''
        ]
      );
    }

    res.json({
      message: 'Saved successfully',
      logo: logoPath
    });

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};