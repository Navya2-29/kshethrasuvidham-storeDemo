const router = require("express").Router();
const purchaseCtrl = require("../controllers/purchase.controller");
const { verifyAccessToken } = require('../middlewares/auth.middleware');


const orderController = require('../controllers/order.controller');

// NEXT ORDER NUMBER (preview only)
router.get('/next-number', verifyAccessToken, orderController.getNextOrderNo);

// GET BY ORDER NUMBER (used by Purchase)
router.get('/by-number/:orderNo', verifyAccessToken, orderController.getOrderByNumber);

// CREATE
router.post('/', verifyAccessToken, orderController.createOrder);

// GET ALL
router.get('/', verifyAccessToken, orderController.getOrders);

// GET ONE
router.get('/:id', verifyAccessToken, orderController.getOrderById);

// UPDATE
router.put('/:id', verifyAccessToken, orderController.updateOrder);

// DELETE
router.delete('/:id', verifyAccessToken, orderController.deleteOrder);

module.exports = router;