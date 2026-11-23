const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/category.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// GET all categories
router.get(
  '/',
  verifyAccessToken,
  allowRoles('ADMIN'),   // change roles if needed
  categoryController.getAllCategories
);

// CREATE category
router.post(
  '/',
  verifyAccessToken,
  allowRoles('ADMIN'),
  categoryController.createCategory
);

// UPDATE category
router.put(
  '/:id',
  verifyAccessToken,
  allowRoles('ADMIN'),
  categoryController.updateCategory
);

// DELETE category (soft delete)
router.delete(
  '/:id',
  verifyAccessToken,
 allowRoles('ADMIN'),
  categoryController.deleteCategory
);

module.exports = router;
