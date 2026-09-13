const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { saveSummary, getSummaries } = require('../controllers/summaries.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

const summariesLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    keyGenerator: (req) => req.user.id,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

router.post('/', authMiddleware, summariesLimiter, saveSummary);
router.get('/', authMiddleware, summariesLimiter, getSummaries);

module.exports = router;
