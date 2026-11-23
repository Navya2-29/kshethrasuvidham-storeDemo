const router = require("express").Router();
const purchaseCtrl = require("../controllers/purchase.controller");
const { verifyAccessToken } = require('../middlewares/auth.middleware');

// router.get("/next-number", purchaseCtrl.getNextPurchaseNo);
router.post('/',verifyAccessToken, purchaseCtrl.createPurchase);
router.get("/allpurchase", verifyAccessToken, purchaseCtrl.getAllPurchases);
router.post('/update/:id', verifyAccessToken, purchaseCtrl.updatePurchase);
router.post('/cancel/:id', verifyAccessToken, purchaseCtrl.cancelPurchase);
router.get('/:id', verifyAccessToken, purchaseCtrl.getPurchaseById);
module.exports = router;
