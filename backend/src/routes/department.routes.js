const express = require('express');
const router = express.Router();

const departmentController = require('../controllers/department.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// List departments
router.get(
  '/',
  verifyAccessToken,
  departmentController.getAllDepartments
);

// Create department (Admin)
router.post(
  '/',
  verifyAccessToken,
   allowRoles('ADMIN'),
  departmentController.createDepartment
);

// Update department (Admin)
router.put(
  '/:id',
  verifyAccessToken,
   allowRoles('ADMIN'),
  departmentController.updateDepartment
);

// Delete department (Admin)
router.delete(
  '/:id',
  verifyAccessToken,
   allowRoles('ADMIN'),
  departmentController.deleteDepartment
);

module.exports = router;
