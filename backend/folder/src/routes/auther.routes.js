const express = require('express');
const router = express.Router();

const authorController = require('../controllers/author.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');



// Routes
router.get('/', verifyAccessToken, authorController.getAllAuthors);
router.post('/', verifyAccessToken, allowRoles('ADMIN'), authorController.createAuthor);
router.put('/:id', verifyAccessToken, allowRoles('ADMIN'), authorController.updateAuthor);
router.delete('/:id', verifyAccessToken, allowRoles('ADMIN'), authorController.deleteAuthor);

module.exports = router;