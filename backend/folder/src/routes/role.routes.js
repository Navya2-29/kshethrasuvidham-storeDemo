const router = require('express').Router();

const controller =
require('../controllers/role.controller');

const {
  verifyAccessToken
} = require('../middlewares/auth.middleware');

router.get(
  '/',
  verifyAccessToken,
  controller.getRoles
);

module.exports = router;