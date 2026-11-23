const express = require('express');
const router = express.Router();

const productController = require('../controllers/product.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// List products
router.get(
  '/',
  verifyAccessToken,
  productController.getAllProducts
);

// productbycode
router.get('/by-code/:code',verifyAccessToken,productController.productByCode);

// Full report (active + inactive) for PDF/Excel bulk export
router.get('/report', verifyAccessToken, productController.getProductsReport);

// Add product (Admin only)
router.post(
  '/',
  verifyAccessToken,
   allowRoles('ADMIN'),
  productController.createProduct
);

// Update product
router.put(
  '/:id',
  verifyAccessToken,
   allowRoles('ADMIN'),
  productController.updateProduct
);

// Delete product
router.delete(
  '/:id',
  verifyAccessToken,
   allowRoles('ADMIN'),
  productController.deleteProduct
);

module.exports = router;
