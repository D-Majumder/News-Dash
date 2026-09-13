const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { signup, login } = require('../controllers/auth.controller');
const router = express.Router();

const clientIpKeyGenerator = (req) => {
    const cfIp = req.headers['cf-connecting-ip'];
    return cfIp ? ipKeyGenerator(cfIp) : ipKeyGenerator(req.ip);
};

const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: clientIpKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: clientIpKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

router.post('/signup', signupLimiter, signup);
router.post('/login', loginLimiter, login);

module.exports = router;
