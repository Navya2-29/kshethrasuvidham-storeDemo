// Backward compatibility delegate to purchasereport.controller.js
const purchaseReportController = require('./purchasereport.controller');

exports.getProductWiseReport = purchaseReportController.getProductWiseReport;
exports.getProductWisePurchaseReport = purchaseReportController.getProductWisePurchaseReport;
exports.getPurchaseReport = purchaseReportController.getPurchaseReport;
exports.getPurchaseReturnReport = purchaseReportController.getPurchaseReturnReport;
