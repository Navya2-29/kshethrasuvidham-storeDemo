const express = require('express');
const router = express.Router();
const reportController = require('../controllers/puchasereport.contoller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

router.post(
  '/product-wise',verifyAccessToken,
  reportController.getProductWiseReport
);

module.exports = router;
