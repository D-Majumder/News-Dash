const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./db');
const authRoutes = require('./routes/auth.routes');
const summaryRoutes = require('./routes/summaries.routes');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors());
app.use(express.json());

const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GNEWS_API_KEY || !GEMINI_API_KEY) {
    console.error("FATAL ERROR: GNEWS_API_KEY or GEMINI_API_KEY is not defined in the .env file.");
    process.exit(1);
}

// Helper function to format articles from GNews to a consistent format
const formatArticles = (articles) => {
    return articles.map(article => ({
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url,
        urlToImage: article.image, // Map 'image' to 'urlToImage'
        publishedAt: article.publishedAt,
        source: {
            name: article.source.name,
            url: article.source.url
        },
        author: article.author || null
    }));
};

// Main endpoint for fetching news (handles categories and search)
app.get('/api/news', async (req, res) => {
    const { category, q } = req.query;
    let url;

    if (q) {
        // Handle search query
        console.log(`Searching for: ${q}`);
        url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&country=in&apikey=${GNEWS_API_KEY}`;
    } else if (category && category !== 'trending') {
        // Handle category query
        console.log(`Fetching news for category: ${category}`);
        url = `https://gnews.io/api/v4/top-headlines?category=${category}&lang=en&country=in&apikey=${GNEWS_API_KEY}`;
    } else {
        // Handle trending (top headlines)
        console.log('Fetching trending news');
        url = `https://gnews.io/api/v4/top-headlines?lang=en&country=in&apikey=${GNEWS_API_KEY}`;
    }

    try {
        const response = await axios.get(url);
        const formatted = formatArticles(response.data.articles);
        res.json({ articles: formatted });
    } catch (error) {
        const errorMessage = error.response?.data?.errors?.[0] || 'Failed to fetch news articles from GNews.';
        res.status(500).json({ error: errorMessage });
    }
});

app.post('/api/summarize', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    try {
        const response = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        const summary = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!summary) return res.status(500).json({ error: "Could not extract summary from AI response." });
        res.json({ summary });
    } catch (error) {
        const errorMessage = error.response?.data?.error?.message || 'An unknown error occurred with the AI service.';
        res.status(500).json({ error: errorMessage });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/summaries', summaryRoutes);

app.listen(PORT, () => {
    console.log(`Synapse News server is running on http://localhost:${PORT}`);
});
