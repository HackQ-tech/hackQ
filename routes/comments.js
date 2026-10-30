const router = require('express').Router();
const c = require('../controllers/commentController');
const { requireAuth } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
router.delete('/:id', requireAuth, asyncH(c.remove));
router.post('/:id/react', requireAuth, asyncH(c.react));
module.exports = router;
