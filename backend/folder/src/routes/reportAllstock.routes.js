const express = require('express');
const router = express.Router();
const stockController = require('../controllers/reportAllstock.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

router.get('/stock-report',verifyAccessToken, stockController.getStockReport);

module.exports = router;