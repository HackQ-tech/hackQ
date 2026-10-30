const router = require('express').Router();
const a = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');

router.use(requireAuth);
// Moderators + admins: review queue and comment monitoring
router.get('/stats', requireRole('admin', 'moderator'), asyncH(a.stats));
router.get('/posts', requireRole('admin', 'moderator'), asyncH(a.posts));
router.post('/posts/:id/approve', requireRole('admin', 'moderator'), asyncH(a.approve));
router.post('/posts/:id/reject', requireRole('admin', 'moderator'), asyncH(a.reject));
router.get('/comments', requireRole('admin', 'moderator'), asyncH(a.comments));
// Admins only: user management
router.get('/users', requireRole('admin'), asyncH(a.users));
router.patch('/users/:id', requireRole('admin'), asyncH(a.updateUser));
module.exports = router;
