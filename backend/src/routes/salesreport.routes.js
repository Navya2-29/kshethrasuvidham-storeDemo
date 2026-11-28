const express = require('express');
const router = express.Router();
const controller = require('../controllers/salesreport.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

router.post('/sales-report', verifyAccessToken, controller.getSalesReport);
router.post('/item-wise', verifyAccessToken, controller.getItemWiseSalesReport);

// GET routes for convenience
router.get('/sales-report', verifyAccessToken, (req, res) => {
  req.body = req.query;
  controller.getSalesReport(req, res);
});
router.get('/item-wise', verifyAccessToken, (req, res) => {
  req.body = req.query;
  controller.getItemWiseSalesReport(req, res);
});

module.exports = router;
