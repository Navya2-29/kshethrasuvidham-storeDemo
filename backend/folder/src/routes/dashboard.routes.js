const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboard.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

// Dashboard API
router.get('/', verifyAccessToken, dashboardController.getDashboard);

module.exports = router;