const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-node-test-run';

const SavedArticle = require('../models/SavedArticle.model');
const summariesRoutes = require('../routes/summaries.routes');

function buildApp() {
    const app = express();
    app.set('trust proxy', 2);
    app.use(express.json());
    app.use('/api/summaries', summariesRoutes);
    return app;
}

function startServer(app) {
    return new Promise((resolve) => {
        const server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

function baseUrl(server) {
    const { port } = server.address();
    return `http://127.0.0.1:${port}`;
}

function tokenFor(userId) {
    return jwt.sign({ user: { id: userId } }, process.env.JWT_SECRET, { expiresIn: '5h' });
}

// SavedArticle.prototype.save and SavedArticle.find are the only two
// Mongoose calls in summaries.controller.js; both need a live database
// connection in production. Neither is available in this environment,
// so both are stubbed against an in-memory array, per user id.
function installFakeSavedArticleStore() {
    const byUser = new Map();
    const originalSave = SavedArticle.prototype.save;
    const originalFind = SavedArticle.find;

    SavedArticle.prototype.save = async function () {
        const list = byUser.get(String(this.user)) || [];
        list.push(this);
        byUser.set(String(this.user), list);
        return this;
    };

    SavedArticle.find = (filter) => {
        const userId = String(filter.user);
        return {
            sort: async () => (byUser.get(userId) || []).slice(),
        };
    };

    return {
        restore: () => {
            SavedArticle.prototype.save = originalSave;
            SavedArticle.find = originalFind;
        },
    };
}

test('summaries: authenticated access, independent per-user budgets', async (t) => {
    const fake = installFakeSavedArticleStore();
    const app = buildApp();
    const server = await startServer(app);
    const url = baseUrl(server);

    t.after(() => {
        server.close();
        fake.restore();
    });

    const userAId = new mongoose.Types.ObjectId().toString();
    const userBId = new mongoose.Types.ObjectId().toString();
    const tokenA = tokenFor(userAId);
    const tokenB = tokenFor(userBId);

    await t.test('normal authenticated save + list works', async () => {
        const saveRes = await fetch(`${url}/api/summaries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
            body: JSON.stringify({
                title: 'Test article',
                source: 'Test source',
                url: 'https://example.com/article-1',
                summary: 'A short summary.',
            }),
        });
        assert.equal(saveRes.status, 201);

        const listRes = await fetch(`${url}/api/summaries`, {
            headers: { Authorization: `Bearer ${tokenA}` },
        });
        assert.equal(listRes.status, 200);
        const list = await listRes.json();
        assert.equal(list.length, 1);
        assert.equal(list[0].title, 'Test article');
    });

    await t.test('no token -> 401, unaffected by rate limiting', async () => {
        const res = await fetch(`${url}/api/summaries`);
        assert.equal(res.status, 401);
    });

    await t.test('POST /api/summaries: 60 requests allowed, 61st is rate-limited (429)', async () => {
        let last;
        for (let i = 0; i < 61; i++) {
            last = await fetch(`${url}/api/summaries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
                body: JSON.stringify({
                    title: `Article ${i}`,
                    source: 'Test source',
                    url: `https://example.com/article-flood-${i}`,
                    summary: 'Flood test.',
                }),
            });
        }
        assert.equal(last.status, 429);
    });

    await t.test('GET /api/summaries: 60 requests allowed, 61st is rate-limited (429)', async () => {
        let last;
        for (let i = 0; i < 61; i++) {
            last = await fetch(`${url}/api/summaries`, {
                headers: { Authorization: `Bearer ${tokenB}` },
            });
        }
        assert.equal(last.status, 429, 'POST and GET must share one 60/15min budget per user, so this 61st combined request is limited');
    });

    await t.test('a third, previously-unused user still has a full independent budget', async () => {
        const userCId = new mongoose.Types.ObjectId().toString();
        const tokenC = tokenFor(userCId);
        const res = await fetch(`${url}/api/summaries`, {
            headers: { Authorization: `Bearer ${tokenC}` },
        });
        assert.notEqual(res.status, 429, 'a fresh user id must not inherit another user\'s exhausted budget');
        assert.equal(res.status, 200);
    });
});

test('rate limiter reset behavior (generic mechanism check, short window)', async (t) => {
    // The production limiters use a 15-minute window, which cannot practically
    // be waited out in a test. This test validates, using the exact same
    // express-rate-limit configuration shape with a short window instead,
    // that a limiter genuinely resets once its window elapses -- i.e. that
    // the reset behavior we are relying on in production actually exists
    // and is not a fixed permanent block.
    const app = express();
    const shortLimiter = rateLimit({
        windowMs: 200,
        limit: 1,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests. Please try again later.' },
    });
    app.get('/probe', shortLimiter, (req, res) => res.status(200).json({ ok: true }));

    const server = await new Promise((resolve) => {
        const s = http.createServer(app);
        s.listen(0, '127.0.0.1', () => resolve(s));
    });
    t.after(() => server.close());
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}`;

    const first = await fetch(`${url}/probe`);
    assert.equal(first.status, 200);

    const second = await fetch(`${url}/probe`);
    assert.equal(second.status, 429);

    await new Promise((r) => setTimeout(r, 300));

    const afterWindow = await fetch(`${url}/probe`);
    assert.equal(afterWindow.status, 200, 'limiter must allow requests again once its window has elapsed');
});
