const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');

router.post('/login', loginLimiter, controller.login);

router.get(
  '/admin',
  verifyAccessToken,
  allowRoles('ADMIN'),
  (req, res) => res.json({ message: 'Admin only' })
);

module.exports = router;
