const express = require('express');
const { saveSummary, getSummaries } = require('../controllers/summaries.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

router.post('/', authMiddleware, saveSummary);
router.get('/', authMiddleware, getSummaries);

module.exports = router;
