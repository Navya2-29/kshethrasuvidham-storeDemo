const express = require('express');
const router = express.Router();
const clientSettingsController = require('../controllers/settings.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
// GET (load form) - intentionally public: the login screen reads this
// (client name/logo/license status) before a token exists.
router.get('/settings', clientSettingsController.getSettings);

// Save settings - Admin only
router.post('/settings', verifyAccessToken, allowRoles('ADMIN'), clientSettingsController.saveSettings);


module.exports = router;