const router = require('express').Router();
const passport = require('../config/passport');
const c = require('../controllers/authController');
const { asyncH } = require('../utils/helpers');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, asyncH(c.register));
router.post('/login', authLimiter, asyncH(c.login));
router.post('/verify', authLimiter, asyncH(c.verify));
router.post('/resend', authLimiter, asyncH(c.resend));
router.post('/forgot', authLimiter, asyncH(c.forgot));
router.post('/reset', authLimiter, asyncH(c.reset));
router.post('/secure', authLimiter, asyncH(c.secure));
router.post('/logout', c.logout);
router.get('/me', asyncH(c.me));

['google', 'github'].forEach(p => {
  const ready = () => passport._strategy(p);
  router.get(`/${p}`, (req, res, next) => ready() ? passport.authenticate(p, { session: false, scope: p === 'google' ? ['profile', 'email'] : ['user:email'] })(req, res, next) : res.redirect('/login?error=' + p + '_not_configured'));
  router.get(`/${p}/callback`, (req, res, next) => ready() ? passport.authenticate(p, { session: false, failureRedirect: '/login?error=oauth_failed' })(req, res, next) : res.redirect('/login'),
    (req, res, next) => req.user.banned ? res.redirect('/login?error=banned') : next(), c.oauthDone);
});
module.exports = router;
