const mongoose = require('mongoose');

const SavedArticleSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    source: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    summary: { type: String, required: true },
    savedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SavedArticle', SavedArticleSchema);
