const express = require('express');
const router = express.Router();

const stockController = require('../controllers/stockTransfer.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

router.get('/:productId', verifyAccessToken, stockController.getProductStock);
router.post('/transfer', verifyAccessToken, stockController.transferStock);
module.exports = router;