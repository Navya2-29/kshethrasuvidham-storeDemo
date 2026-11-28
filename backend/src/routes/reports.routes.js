const express = require('express');
const router = express.Router();
const { verifyAccessToken } = require('../middlewares/auth.middleware');

const purchaseReportController = require('../controllers/purchasereport.controller');
const salesReportController = require('../controllers/salesreport.controller');
const stockReportController = require('../controllers/reportAllstock.controller');
const stockTransferReportController = require('../controllers/stocktransferreport.controller');

// =========================================================================
// 1. Purchase Report: /api/report/purchasereport & /api/report/purchase-report
// =========================================================================
router.get('/purchasereport', verifyAccessToken, purchaseReportController.getPurchaseReport);
router.post('/purchasereport', verifyAccessToken, purchaseReportController.getPurchaseReport);
router.get('/purchase-report', verifyAccessToken, purchaseReportController.getPurchaseReport);
router.post('/purchase-report', verifyAccessToken, purchaseReportController.getPurchaseReport);

// =========================================================================
// 2. Sales Report: /api/report/salesreport & /api/report/sales-report
// =========================================================================
router.get('/salesreport', verifyAccessToken, salesReportController.getSalesReport);
router.post('/salesreport', verifyAccessToken, salesReportController.getSalesReport);
router.get('/sales-report', verifyAccessToken, salesReportController.getSalesReport);
router.post('/sales-report', verifyAccessToken, salesReportController.getSalesReport);

// =========================================================================
// 3. Purchase Return Report: /api/report/purchasereturnreport & /api/report/purchase-return-report
// =========================================================================
router.get('/purchasereturnreport', verifyAccessToken, purchaseReportController.getPurchaseReturnReport);
router.post('/purchasereturnreport', verifyAccessToken, purchaseReportController.getPurchaseReturnReport);
router.get('/purchase-return-report', verifyAccessToken, purchaseReportController.getPurchaseReturnReport);
router.post('/purchase-return-report', verifyAccessToken, purchaseReportController.getPurchaseReturnReport);

// =========================================================================
// 4. Item-Wise Sales Report: /api/report/itemwisesalesreport & /api/report/item-wise-sales-report
// =========================================================================
router.get('/itemwisesalesreport', verifyAccessToken, salesReportController.getItemWiseSalesReport);
router.post('/itemwisesalesreport', verifyAccessToken, salesReportController.getItemWiseSalesReport);
router.get('/item-wise-sales-report', verifyAccessToken, salesReportController.getItemWiseSalesReport);
router.post('/item-wise-sales-report', verifyAccessToken, salesReportController.getItemWiseSalesReport);

// =========================================================================
// 5. Product-Wise Purchase Report: /api/report/productwisepurchasereport
// =========================================================================
router.get('/productwisepurchasereport', verifyAccessToken, purchaseReportController.getProductWisePurchaseReport);
router.post('/productwisepurchasereport', verifyAccessToken, purchaseReportController.getProductWisePurchaseReport);
router.get('/product-wise-purchase-report', verifyAccessToken, purchaseReportController.getProductWisePurchaseReport);
router.post('/product-wise-purchase-report', verifyAccessToken, purchaseReportController.getProductWisePurchaseReport);

// =========================================================================
// 6. Stock Report: /api/report/stockreport & /api/report/stock-report
// =========================================================================
router.get('/stockreport', verifyAccessToken, stockReportController.getStockReport);
router.get('/stock-report', verifyAccessToken, stockReportController.getStockReport);

// =========================================================================
// 7. Stock Transfer Report by Product: /api/report/stocktransferreport/:id
// =========================================================================
router.get('/stocktransferreport/:id', verifyAccessToken, stockTransferReportController.getAvailableStockByProduct);
router.get('/stock-transfer-report/:id', verifyAccessToken, stockTransferReportController.getAvailableStockByProduct);

// Backward compatibility convenience aliases
router.post('/item-wise', verifyAccessToken, salesReportController.getItemWiseSalesReport);
router.get('/item-wise', verifyAccessToken, salesReportController.getItemWiseSalesReport);
router.post('/product-wise', verifyAccessToken, purchaseReportController.getProductWisePurchaseReport);
router.get('/product-wise', verifyAccessToken, purchaseReportController.getProductWisePurchaseReport);

module.exports = router;
