const express = require("express");
const router = express.Router();

const productsummeryController = require("../controllers/productsummery.controller");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const { allowRoles } = require("../middlewares/role.middleware");

// List products
router.get(
  "/all-product/:productId",
  verifyAccessToken,
  productsummeryController.getProductSummary,
);

router.get(
  "/department-stock/:productId",
  verifyAccessToken,
  productsummeryController.getProductDepartmentStock,
);
router.get(
  "/all-products-stock",
  verifyAccessToken,
  allowRoles("ADMIN"),
  productsummeryController.getAllProductStock,
);
module.exports = router;
