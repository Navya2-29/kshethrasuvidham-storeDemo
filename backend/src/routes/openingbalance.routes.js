const express = require('express');
const router = express.Router();
const controller = require('../controllers/openingbalance.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

router.post('/create',verifyAccessToken, controller.createOpening);
router.get('/list',verifyAccessToken, controller.getOpenings);



// List Opening
router.get(
  "/list",
  verifyAccessToken,
  controller.getOpenings
);



// Update Opening
router.put(
  "/update/:id",
  verifyAccessToken,
  controller.updateOpening
);

// Delete Opening (Soft Delete)
router.delete(
  "/delete/:id",
  verifyAccessToken,
  controller.deleteOpening
);

module.exports = router;
