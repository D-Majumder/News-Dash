const SavedArticle = require('../models/SavedArticle.model');

exports.saveSummary = async (req, res) => {
    const { title, source, url, summary } = req.body;
    try {
        const newSummary = new SavedArticle({
            user: req.user.id,
            title,
            source,
            url,
            summary
        });
        const saved = await newSummary.save();
        res.status(201).json(saved);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'This article has already been saved.' });
        }
        res.status(500).json({ error: 'Server error while saving summary.' });
    }
};

exports.getSummaries = async (req, res) => {
    try {
        const summaries = await SavedArticle.find({ user: req.user.id }).sort({ savedAt: -1 });
        res.json(summaries);
    } catch (err) {
        res.status(500).json({ error: 'Server error while fetching summaries.' });
    }
};