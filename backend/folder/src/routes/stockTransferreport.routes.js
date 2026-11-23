const express = require('express');
const router = express.Router();
const controller = require('../controllers/stocktransferreport.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

router.get('/stock-transfer-report/:id', verifyAccessToken,controller.getAvailableStockByProduct);

module.exports = router;