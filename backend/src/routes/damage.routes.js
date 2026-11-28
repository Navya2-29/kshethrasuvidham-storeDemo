const express = require("express");
const router = express.Router();
const damageCtrl = require("../controllers/damage.controller");
const { verifyAccessToken } = require("../middlewares/auth.middleware");

router.get("/", verifyAccessToken, damageCtrl.getAllDamageRecords);
router.post("/", verifyAccessToken, damageCtrl.createDamageRecord);
router.delete("/:id", verifyAccessToken, damageCtrl.deleteDamageRecord);

module.exports = router;
