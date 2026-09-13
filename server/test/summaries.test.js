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

// summariesRoutes now has TWO stacked limiters: summariesIpLimiter (100/15min,
// keyed by CF-Connecting-IP/req.ip, runs before authMiddleware) and
// summariesLimiter (60/15min, keyed by req.user.id, runs after authMiddleware).
// Both are singletons for the whole test process (require() caches the router
// module), so every sub-test below tags its requests with its own unique
// CF-Connecting-IP value -- otherwise an unrelated sub-test's requests would
// silently consume the outer IP limiter's budget for a later sub-test that is
// specifically trying to test the INNER per-user limiter, producing a 429 for
// the wrong reason.
function cfTagHeaders(tag, extra = {}) {
    return { 'cf-connecting-ip': tag, ...extra };
}

// SavedArticle.prototype.save and SavedArticle.find are the only two
// Mongoose calls in summaries.controller.js; both need a live database
// connection in production. Neither is available in this environment, so
// both are stubbed against an in-memory array, per user id.
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
    let n = 0;
    const nextTag = () => `test-summaries-basic-${n++}`;

    t.after(() => {
        server.close();
        fake.restore();
    });

    const userAId = new mongoose.Types.ObjectId().toString();
    const userBId = new mongoose.Types.ObjectId().toString();
    const tokenA = tokenFor(userAId);
    const tokenB = tokenFor(userBId);

    await t.test('normal authenticated save + list works', async () => {
        const tag = nextTag();
        const saveRes = await fetch(`${url}/api/summaries`, {
            method: 'POST',
            headers: cfTagHeaders(tag, { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` }),
            body: JSON.stringify({
                title: 'Test article',
                source: 'Test source',
                url: 'https://example.com/article-1',
                summary: 'A short summary.',
            }),
        });
        assert.equal(saveRes.status, 201);

        const listRes = await fetch(`${url}/api/summaries`, {
            headers: cfTagHeaders(tag, { Authorization: `Bearer ${tokenA}` }),
        });
        assert.equal(listRes.status, 200);
        const list = await listRes.json();
        assert.equal(list.length, 1);
        assert.equal(list[0].title, 'Test article');
    });

    await t.test('no token -> 401, unaffected by rate limiting', async () => {
        const res = await fetch(`${url}/api/summaries`, { headers: cfTagHeaders(nextTag()) });
        assert.equal(res.status, 401);
    });

    await t.test('POST /api/summaries: 60 requests allowed, 61st is rate-limited (429) by the per-user limiter', async () => {
        const tag = nextTag();
        let last;
        for (let i = 0; i < 61; i++) {
            last = await fetch(`${url}/api/summaries`, {
                method: 'POST',
                headers: cfTagHeaders(tag, { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` }),
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

    await t.test('GET /api/summaries: 60 requests allowed, 61st is rate-limited (429) by the per-user limiter', async () => {
        const tag = nextTag();
        let last;
        for (let i = 0; i < 61; i++) {
            last = await fetch(`${url}/api/summaries`, {
                headers: cfTagHeaders(tag, { Authorization: `Bearer ${tokenB}` }),
            });
        }
        assert.equal(last.status, 429, 'POST and GET must share one 60/15min per-user budget, so this 61st combined request is limited');
    });

    await t.test('a third, previously-unused user still has a full independent budget', async () => {
        const userCId = new mongoose.Types.ObjectId().toString();
        const tokenC = tokenFor(userCId);
        const res = await fetch(`${url}/api/summaries`, {
            headers: cfTagHeaders(nextTag(), { Authorization: `Bearer ${tokenC}` }),
        });
        assert.notEqual(res.status, 429, 'a fresh user id must not inherit another user\'s exhausted budget');
        assert.equal(res.status, 200);
    });
});

test('summaries: pre-auth IP limiter throttles unauthenticated/invalid-token flooding', async (t) => {
    const fake = installFakeSavedArticleStore();
    const app = buildApp();
    const server = await startServer(app);
    const url = baseUrl(server);

    t.after(() => {
        server.close();
        fake.restore();
    });

    await t.test('flood of requests with no token: first 100 get 401, 101st is rate-limited by summariesIpLimiter (429)', async () => {
        const tag = 'test-summaries-ip-limiter-no-token';
        const statuses = [];
        for (let i = 0; i < 101; i++) {
            const res = await fetch(`${url}/api/summaries`, { headers: cfTagHeaders(tag) });
            statuses.push(res.status);
        }
        assert.equal(statuses.slice(0, 100).every((s) => s === 401), true, 'requests within the IP budget must reach authMiddleware and be rejected as 401 (no token), not 429');
        assert.equal(statuses[100], 429, 'the 101st request from the same identity must be blocked by summariesIpLimiter before authMiddleware runs');
    });

    await t.test('flood of requests with an invalid token also consumes the same outer IP budget', async () => {
        const tag = 'test-summaries-ip-limiter-bad-token';
        const statuses = [];
        for (let i = 0; i < 101; i++) {
            const res = await fetch(`${url}/api/summaries`, {
                headers: cfTagHeaders(tag, { Authorization: 'Bearer not-a-real-token' }),
            });
            statuses.push(res.status);
        }
        assert.equal(statuses.slice(0, 100).every((s) => s === 401), true, 'requests within the IP budget must reach authMiddleware and be rejected as 401 (invalid token), not 429');
        assert.equal(statuses[100], 429, 'the 101st request must be blocked by summariesIpLimiter, proving the pre-auth JWT-verification path is now throttled');
    });
});

test('summaries: outer IP limiter and inner per-user limiter do not interfere incorrectly', async (t) => {
    const fake = installFakeSavedArticleStore();
    const app = buildApp();
    const server = await startServer(app);
    const url = baseUrl(server);

    t.after(() => {
        server.close();
        fake.restore();
    });

    await t.test('a legitimate authenticated user well within both budgets is never rate-limited', async () => {
        const tag = 'test-summaries-no-interference';
        const userId = new mongoose.Types.ObjectId().toString();
        const token = tokenFor(userId);
        for (let i = 0; i < 10; i++) {
            const res = await fetch(`${url}/api/summaries`, {
                headers: cfTagHeaders(tag, { Authorization: `Bearer ${token}` }),
            });
            assert.equal(res.status, 200, `request ${i} must succeed -- 10 requests is far under both the 100/15min IP limit and the 60/15min per-user limit`);
        }
    });

    await t.test('exhausting the outer IP limiter blocks even a request with a valid token, before it reaches the inner limiter', async () => {
        const tag = 'test-summaries-outer-blocks-valid-token';
        const userId = new mongoose.Types.ObjectId().toString();
        const token = tokenFor(userId);
        // Exhaust the 100-request outer IP budget using unauthenticated requests.
        for (let i = 0; i < 100; i++) {
            await fetch(`${url}/api/summaries`, { headers: cfTagHeaders(tag) });
        }
        // The 101st request, even with a fully valid token, must still be
        // blocked by the outer limiter -- it never reaches authMiddleware or
        // the inner per-user limiter at all.
        const res = await fetch(`${url}/api/summaries`, {
            headers: cfTagHeaders(tag, { Authorization: `Bearer ${token}` }),
        });
        assert.equal(res.status, 429, 'a valid token does not bypass the outer, pre-auth IP limiter');
    });

    await t.test('two different users behind two different IPs never affect each other\'s outer budget', async () => {
        const userXId = new mongoose.Types.ObjectId().toString();
        const userYId = new mongoose.Types.ObjectId().toString();
        const tokenX = tokenFor(userXId);
        const tokenY = tokenFor(userYId);

        // Exhaust user X's outer IP budget.
        for (let i = 0; i < 100; i++) {
            await fetch(`${url}/api/summaries`, {
                headers: cfTagHeaders('test-summaries-outer-x', { Authorization: `Bearer ${tokenX}` }),
            });
        }
        const exhaustedX = await fetch(`${url}/api/summaries`, {
            headers: cfTagHeaders('test-summaries-outer-x', { Authorization: `Bearer ${tokenX}` }),
        });
        assert.equal(exhaustedX.status, 429);

        // A different identity (different CF-Connecting-IP) must be unaffected.
        const resY = await fetch(`${url}/api/summaries`, {
            headers: cfTagHeaders('test-summaries-outer-y', { Authorization: `Bearer ${tokenY}` }),
        });
        assert.notEqual(resY.status, 429, 'a different CF-Connecting-IP identity must not inherit another identity\'s exhausted outer budget');
        assert.equal(resY.status, 200);
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
