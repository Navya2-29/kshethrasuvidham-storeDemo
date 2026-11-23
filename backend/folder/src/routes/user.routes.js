const router = require("express").Router();
const controller = require("../controllers/user.controller");
const {
  verifyAccessToken
} = require("../middlewares/auth.middleware");

router.get(
  "/",
  verifyAccessToken,
  controller.getAllUsers
);

router.get(
  "/:id",
  verifyAccessToken,
  controller.getUserById
);

router.post(
  "/",
  verifyAccessToken,
  controller.createUser
);

router.put(
  "/:id",
  verifyAccessToken,
  controller.updateUser
);

router.delete(
  "/status/:id",
  verifyAccessToken,
  controller.deleteUser
);
router.post(
  "/change-password/:id",
  verifyAccessToken,
  controller.changePassword
);

module.exports = router;