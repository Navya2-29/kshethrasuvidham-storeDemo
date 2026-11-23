const express = require('express');
const router = express.Router();
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

const publisherController = require('../controllers/publisher.controller');

// GET
router.get('/',verifyAccessToken, publisherController.getAllPublishers);

// CREATE
router.post('/',verifyAccessToken, allowRoles('ADMIN'), publisherController.createPublisher);

// UPDATE
router.put('/:id',verifyAccessToken, allowRoles('ADMIN'), publisherController.updatePublisher);

// DELETE
router.delete('/:id',verifyAccessToken, allowRoles('ADMIN'), publisherController.deletePublisher);

module.exports = router;