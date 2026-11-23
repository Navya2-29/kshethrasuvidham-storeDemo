const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
// List all suppliers - any logged-in user
router.get('/', verifyAccessToken, supplierController.getAllSuppliers);

// Add new supplier - Admin only
router.post(
  '/',
  verifyAccessToken,
   allowRoles('ADMIN'),
  supplierController.createSupplier
);

// Update supplier - Admin only
router.put(
  '/:id',
  verifyAccessToken,
   allowRoles('ADMIN'),
  supplierController.updateSupplier
);

// Delete supplier - Admin only
router.delete(
  '/:id',
  verifyAccessToken,
   allowRoles('ADMIN'),
  supplierController.deleteSupplier
);

module.exports = router;
