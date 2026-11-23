const express = require('express');
const router = express.Router();
const controller = require('../controllers/directEntry.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

router.post('/create',verifyAccessToken, controller.createDirectEntry);
router.get('/list',verifyAccessToken, controller.getDirectEntries);

router.put('/update/:id', verifyAccessToken, controller.updateDirectEntry);
router.delete('/delete/:id', verifyAccessToken, controller.deleteDirectEntry);
module.exports = router;