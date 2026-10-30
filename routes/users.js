const router = require('express').Router();
const u = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { asyncH } = require('../utils/helpers');

router.get('/meta', u.meta);
router.get('/leaderboard', asyncH(u.leaderboard));
router.get('/search', requireAuth, asyncH(u.search));
router.get('/me/notifications', requireAuth, asyncH(u.notifications));
router.post('/me/notifications/read', requireAuth, asyncH(u.readNotifications));
router.patch('/me', requireAuth, asyncH(u.updateMe));
router.post('/me/avatar', requireAuth, upload.single('avatar'), asyncH(u.uploadAvatar));
router.post('/me/password', requireAuth, asyncH(u.changePassword));
router.get('/:username', asyncH(u.profile));
router.get('/:username/posts', asyncH(u.posts));
router.get('/:username/:kind(followers|following)', asyncH(u.connections));
router.post('/:username/follow', requireAuth, asyncH(u.follow));
module.exports = router;
