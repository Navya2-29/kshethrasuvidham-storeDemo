const express = require('express');
const router = express.Router();
const controller = require('../controllers/salesreport.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

router.get('/', verifyAccessToken, controller.getSalesReport);
router.post('/', verifyAccessToken, controller.getSalesReport);
router.get('/salesreport', verifyAccessToken, controller.getSalesReport);
router.post('/salesreport', verifyAccessToken, controller.getSalesReport);
router.get('/sales-report', verifyAccessToken, controller.getSalesReport);
router.post('/sales-report', verifyAccessToken, controller.getSalesReport);
router.get('/item-wise', verifyAccessToken, controller.getItemWiseSalesReport);
router.post('/item-wise', verifyAccessToken, controller.getItemWiseSalesReport);
router.get('/itemwisesalesreport', verifyAccessToken, controller.getItemWiseSalesReport);
router.post('/itemwisesalesreport', verifyAccessToken, controller.getItemWiseSalesReport);

module.exports = router;
