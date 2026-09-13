const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { saveSummary, getSummaries } = require('../controllers/summaries.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

const clientIpKeyGenerator = (req) => {
    const cfIp = req.headers['cf-connecting-ip'];
    return cfIp ? ipKeyGenerator(cfIp) : ipKeyGenerator(req.ip);
};

// Runs before authMiddleware so that unauthenticated/invalid-token requests
// (which never reach summariesLimiter below) are still throttled -- the JWT
// verification work in authMiddleware is itself a target for volumetric abuse
// regardless of whether the token is valid.
const summariesIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    keyGenerator: clientIpKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

const summariesLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    keyGenerator: (req) => req.user.id,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

router.post('/', summariesIpLimiter, authMiddleware, summariesLimiter, saveSummary);
router.get('/', summariesIpLimiter, authMiddleware, summariesLimiter, getSummaries);

module.exports = router;
