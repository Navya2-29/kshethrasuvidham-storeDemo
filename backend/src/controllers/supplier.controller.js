const db = require("../config/db.config");

// GET all suppliers
const getAllSuppliers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id,
        supplier_code,
        supplier_name,
        contact_person,
        mobile_number,
        office_number, 
        email,
        website,
        address,
        gst_number
      FROM suppliers 
      WHERE is_active = 1 
      ORDER BY id DESC
    `);

    res.json(  
      rows
    );

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
// CREATE new supplier
const createSupplier = async (req, res) => {
  console.log(req.body)
  try {
    const {
      supplier_code,
      supplier_name,
      contact_person,
      mobile_number,
      office_number,
      address,
      email,
      website,
      gst_number,
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO suppliers 
      (supplier_code, supplier_name, contact_person, mobile_number,
       office_number, address, email, website, gst_number, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        supplier_code,
        supplier_name,
        contact_person || null,
        mobile_number || null,
        office_number || null,
        address || null,
        email || null,
        website || null,
        gst_number?.trim() || null,
      ]
    );

    res.status(201).json({
      message: "Supplier created successfully",
      id: result.insertId,
    });

  } catch (err) {
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      if (err.sqlMessage.includes("uq_supplier_code")) {
        return res.status(400).json({ message: "Supplier code already exists" });
      }
      if (err.sqlMessage.includes("uq_supplier_name")) {
        return res.status(400).json({ message: "Supplier name already exists" });
      }
      if (err.sqlMessage.includes("uq_mobile_number")) {
        return res.status(400).json({ message: "Mobile number already exists" });
      }
      if (err.sqlMessage.includes("uq_gst_number")) {
        return res.status(400).json({ message: "GST number already exists" });
      }
    }

    res.status(500).json({ message: "Internal server error" });
  }
};
// UPDATE supplier
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      supplier_code,
      supplier_name,
      contact_person,
      mobile_number,
      office_number,
      address,
      email,
      website,
      gst_number,
    } = req.body;

    await db.query(
      `UPDATE suppliers SET
        supplier_code=?,
        supplier_name=?,
        contact_person=?,
        mobile_number=?,
        office_number=?,
        address=?,
        email=?,
        website=?,
        gst_number=?
      WHERE id=?`,
      [
        supplier_code,
        supplier_name,
        contact_person || null,
        mobile_number || null,
        office_number || null,
        address || null,
        email || null,
        website || null,
        gst_number?.trim() || null,
        id,
      ]
    );

    res.json({ message: "Supplier updated successfully" });

  } catch (err) {
    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
      if (err.sqlMessage.includes('uq_supplier_code')) {
        return res.status(400).json({ message: 'Supplier code already exists' });
      }
      if (err.sqlMessage.includes('uq_supplier_name')) {
        return res.status(400).json({ message: 'Supplier name already exists' });
      }
      if (err.sqlMessage.includes('uq_mobile_number')) {
        return res.status(400).json({ message: 'Mobile number already exists' });
      }
      if (err.sqlMessage.includes('uq_gst_number')) {
        return res.status(400).json({ message: 'GST number already exists' });
      }
    }

    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE supplier
const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "UPDATE suppliers SET is_active = 0 WHERE id=?",
      [id]
    );

    res.json({ message: "Supplier deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
