const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-node-test-run';

const User = require('../models/User.model');
const authRoutes = require('../routes/auth.routes');

function buildApp() {
    const app = express();
    app.set('trust proxy', 2);
    app.use(express.json());
    app.use('/api/auth', authRoutes);
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

// Every top-level test() block below tags its requests with its own unique
// CF-Connecting-IP value. This is not optional decoration: express-rate-limit's
// signupLimiter/loginLimiter middleware instances (imported once via
// require('../routes/auth.routes'), which Node caches as singletons for the
// whole test process) share their in-memory counters across every test() block
// in this file. Without a distinct key per block, an unrelated block's requests
// (e.g. validation checks) would silently consume budget from a later block's
// dedicated rate-limit test, producing false failures. Only the block that
// deliberately tests "no CF-Connecting-IP header -> falls back to req.ip"
// omits this header, by design.
function cfHeaders(tag, extra = {}) {
    return { 'Content-Type': 'application/json', 'cf-connecting-ip': tag, ...extra };
}

// In-memory fake store standing in for MongoDB, since no live database is
// available in this environment. Only User.findOne (a query) and
// User.prototype.save (a write) touch the database in the real controller;
// both are stubbed here. bcrypt hashing/compare and JWT signing/verification
// are left completely real.
function installFakeUserStore() {
    const store = new Map();
    const originalFindOne = User.findOne;
    const originalSave = User.prototype.save;

    User.findOne = async (filter) => {
        const eq = filter?.username?.$eq;
        assert.equal(typeof eq, 'string', 'findOne must only ever receive a string via $eq');
        return store.get(eq) || null;
    };

    User.prototype.save = async function () {
        store.set(this.username, this);
        return this;
    };

    return {
        restore: () => {
            User.findOne = originalFindOne;
            User.prototype.save = originalSave;
        },
        store,
    };
}

test('auth: signup + injection + validation', async (t) => {
    const fake = installFakeUserStore();
    const app = buildApp();
    const server = await startServer(app);
    const url = baseUrl(server);
    // Each sub-test below gets its own CF-Connecting-IP tag: the rate limiter
    // counts every request regardless of outcome (400 or 200), and this block
    // alone issues more than 5 requests, so a shared tag would self-trigger
    // signupLimiter partway through -- unrelated to the validation behavior
    // actually under test here.
    let n = 0;
    const nextTag = () => `test-block-signup-validation-${n++}`;

    t.after(() => {
        server.close();
        fake.restore();
    });

    await t.test('MongoDB operator object as signup username is rejected with 400', async () => {
        const res = await fetch(`${url}/api/auth/signup`, {
            method: 'POST',
            headers: cfHeaders(nextTag()),
            body: JSON.stringify({ username: { $ne: null }, password: 'whatever' }),
        });
        assert.equal(res.status, 400);
        assert.equal(fake.store.size, 0, 'no user should have been created from an object payload');
    });

    for (const badUsername of [['a'], 123, true, null]) {
        await t.test(`malformed signup username (${JSON.stringify(badUsername)}) -> 400`, async () => {
            const res = await fetch(`${url}/api/auth/signup`, {
                method: 'POST',
                headers: cfHeaders(nextTag()),
                body: JSON.stringify({ username: badUsername, password: 'whatever' }),
            });
            assert.equal(res.status, 400);
        });
    }

    await t.test('malformed signup password -> 400', async () => {
        const res = await fetch(`${url}/api/auth/signup`, {
            method: 'POST',
            headers: cfHeaders(nextTag()),
            body: JSON.stringify({ username: 'someone-new', password: { $ne: null } }),
        });
        assert.equal(res.status, 400);
    });

    await t.test('normal signup succeeds and returns a token', async () => {
        const res = await fetch(`${url}/api/auth/signup`, {
            method: 'POST',
            headers: cfHeaders(nextTag()),
            body: JSON.stringify({ username: 'alice', password: 'correct-horse-battery-staple' }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(typeof body.token, 'string');
    });
});

test('auth: login + injection + validation + credential correctness', async (t) => {
    const fake = installFakeUserStore();
    const app = buildApp();
    const server = await startServer(app);
    const url = baseUrl(server);
    // Same reasoning as the signup validation block above: each sub-test gets
    // its own tag so the shared loginLimiter/signupLimiter counters (which
    // count every request regardless of its eventual 400/200 outcome) don't
    // interfere between unrelated validation checks within this one block.
    let n = 0;
    const nextTag = () => `test-block-login-validation-${n++}`;

    t.after(() => {
        server.close();
        fake.restore();
    });

    // Seed one real user via the actual signup endpoint, so bcrypt hashing is
    // exercised exactly as it would be in production.
    await fetch(`${url}/api/auth/signup`, {
        method: 'POST',
        headers: cfHeaders(nextTag()),
        body: JSON.stringify({ username: 'bob', password: 'super-secret-pw' }),
    });

    await t.test('MongoDB operator object as login username is rejected with 400', async () => {
        const res = await fetch(`${url}/api/auth/login`, {
            method: 'POST',
            headers: cfHeaders(nextTag()),
            body: JSON.stringify({ username: { $gt: '' }, password: 'anything' }),
        });
        assert.equal(res.status, 400);
    });

    for (const badUsername of [['a'], 123, true, null]) {
        await t.test(`malformed login username (${JSON.stringify(badUsername)}) -> 400`, async () => {
            const res = await fetch(`${url}/api/auth/login`, {
                method: 'POST',
                headers: cfHeaders(nextTag()),
                body: JSON.stringify({ username: badUsername, password: 'anything' }),
            });
            assert.equal(res.status, 400);
        });
    }

    await t.test('malformed login password -> 400', async () => {
        const res = await fetch(`${url}/api/auth/login`, {
            method: 'POST',
            headers: cfHeaders(nextTag()),
            body: JSON.stringify({ username: 'bob', password: { $ne: null } }),
        });
        assert.equal(res.status, 400);
    });

    await t.test('nonexistent user -> 400 Invalid credentials', async () => {
        const res = await fetch(`${url}/api/auth/login`, {
            method: 'POST',
            headers: cfHeaders(nextTag()),
            body: JSON.stringify({ username: 'nobody-registered', password: 'irrelevant' }),
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error, 'Invalid credentials.');
    });

    await t.test('wrong password -> 400 Invalid credentials', async () => {
        const res = await fetch(`${url}/api/auth/login`, {
            method: 'POST',
            headers: cfHeaders(nextTag()),
            body: JSON.stringify({ username: 'bob', password: 'not-the-right-password' }),
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error, 'Invalid credentials.');
    });

    await t.test('correct credentials -> 200 with token', async () => {
        const res = await fetch(`${url}/api/auth/login`, {
            method: 'POST',
            headers: cfHeaders(nextTag()),
            body: JSON.stringify({ username: 'bob', password: 'super-secret-pw' }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(typeof body.token, 'string');
    });
});

test('auth: signup and login rate limiting have independent budgets', async (t) => {
    const fake = installFakeUserStore();
    const app = buildApp();
    const server = await startServer(app);
    const url = baseUrl(server);
    const TAG = 'test-block-independent-budgets';

    t.after(() => {
        server.close();
        fake.restore();
    });

    await t.test('signup: 5 requests allowed, 6th is rate-limited (429)', async () => {
        const statuses = [];
        for (let i = 0; i < 6; i++) {
            const res = await fetch(`${url}/api/auth/signup`, {
                method: 'POST',
                headers: cfHeaders(TAG),
                body: JSON.stringify({ username: `signup-flood-${i}`, password: 'password123' }),
            });
            statuses.push(res.status);
        }
        assert.equal(statuses.slice(0, 5).every((s) => s !== 429), true, 'first 5 signup requests must not be rate-limited');
        assert.equal(statuses[5], 429, '6th signup request must be rate-limited');
    });

    await t.test('login budget is independent of the exhausted signup budget (same client identity)', async () => {
        // Same TAG (same CF-Connecting-IP identity) as the exhausted signup
        // budget above -- this is the point of the test: one client having
        // exhausted its signup budget must not affect its own login budget,
        // because they are separate limiter instances.
        const bcrypt = require('bcryptjs');
        const hashed = await bcrypt.hash('another-pass', await bcrypt.genSalt(10));
        fake.store.set('carol', new User({ username: 'carol', password: hashed }));

        const res = await fetch(`${url}/api/auth/login`, {
            method: 'POST',
            headers: cfHeaders(TAG),
            body: JSON.stringify({ username: 'carol', password: 'another-pass' }),
        });
        assert.notEqual(res.status, 429, 'login must not be rate-limited just because signup budget is exhausted for the same client');
        assert.equal(res.status, 200);
    });

    await t.test('login: continuing to the same client\'s 6th login request is rate-limited (429)', async () => {
        const statuses = [];
        for (let i = 0; i < 5; i++) {
            const res = await fetch(`${url}/api/auth/login`, {
                method: 'POST',
                headers: cfHeaders(TAG),
                body: JSON.stringify({ username: 'carol', password: 'wrong-on-purpose' }),
            });
            statuses.push(res.status);
        }
        // 1 successful login already happened for this TAG above, so this
        // loop's 5th request is this client's 6th login request overall.
        assert.equal(statuses[4], 429, 'this client\'s 6th login request (1 prior + 5 here) must be rate-limited');
    });
});

test('auth: CF-Connecting-IP key precedence and req.ip fallback', async (t) => {
    const fake = installFakeUserStore();
    const app = buildApp();
    const server = await startServer(app);
    const url = baseUrl(server);

    t.after(() => {
        server.close();
        fake.restore();
    });

    await t.test('two different CF-Connecting-IP values get independent budgets despite identical req.ip', async () => {
        for (let i = 0; i < 5; i++) {
            await fetch(`${url}/api/auth/signup`, {
                method: 'POST',
                headers: cfHeaders('test-block-cf-precedence-a'),
                body: JSON.stringify({ username: `cf-a-${i}`, password: 'password123' }),
            });
        }
        const exhausted = await fetch(`${url}/api/auth/signup`, {
            method: 'POST',
            headers: cfHeaders('test-block-cf-precedence-a'),
            body: JSON.stringify({ username: 'cf-a-overflow', password: 'password123' }),
        });
        assert.equal(exhausted.status, 429, 'CF-Connecting-IP "a" budget should be exhausted');

        // A different CF-Connecting-IP, same underlying req.ip (both are
        // 127.0.0.1 in this in-process test), must still be allowed -- this
        // proves the rate-limit key comes from the header, not from req.ip.
        const otherIp = await fetch(`${url}/api/auth/signup`, {
            method: 'POST',
            headers: cfHeaders('test-block-cf-precedence-b'),
            body: JSON.stringify({ username: 'cf-b-1', password: 'password123' }),
        });
        assert.notEqual(otherIp.status, 429, 'a different CF-Connecting-IP must not be affected by the other identity\'s exhausted budget');
    });
});

test('auth: fallback to req.ip when CF-Connecting-IP header is absent', async (t) => {
    const fake = installFakeUserStore();
    const app = buildApp();
    const server = await startServer(app);
    const url = baseUrl(server);

    t.after(() => {
        server.close();
        fake.restore();
    });

    await t.test('no CF-Connecting-IP header: 5 allowed, 6th rate-limited via req.ip fallback', async () => {
        const statuses = [];
        for (let i = 0; i < 6; i++) {
            const res = await fetch(`${url}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: `no-cf-header-${i}`, password: 'password123' }),
            });
            statuses.push(res.status);
        }
        assert.equal(statuses[5], 429, 'fallback to req.ip must still enforce the limit when no CF-Connecting-IP header is present');
    });
});
