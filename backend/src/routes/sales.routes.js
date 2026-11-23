const express = require('express');
const router = express.Router();
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const controller = require('../controllers/sales.controller');
router.post('/',verifyAccessToken, controller.createSale);
router.get('/products/:deptId', verifyAccessToken, controller.getProductsByDepartment);
router.get('/saleproduct',verifyAccessToken, controller.getSalesProducts)
router.get('/next-invoice',verifyAccessToken, controller.getNextInvoiceNo);
router.get('/stock/department/:deptId',verifyAccessToken, controller.getDepartmentStock);
module.exports = router;