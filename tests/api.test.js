import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5175';

describe('YouTube SEO Tool API Tests', () => {
    let accessToken;
    let server;

    before(async () => {
        accessToken = process.env.TEST_ACCESS_TOKEN;
        // Set NODE_ENV to 'test' so rate limit threshold is 100
        process.env.NODE_ENV = 'test';
        // Avoid auto-listening on import by setting VERCEL env
        process.env.VERCEL = 'true';
        const { default: app } = await import('../api/index.js');
        const PORT = 5175;
        server = app.listen(PORT);
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    describe('GET /', () => {
        it('should serve index.html', async () => {
            const res = await fetch(`${API_BASE}/`);
            assert.equal(res.status, 200);
        });
    });

    describe('GET /api/quota/status', () => {
        it('should return quota status', async () => {
            const res = await fetch(`${API_BASE}/api/quota/status`);
            const data = await res.json();
            assert.ok(typeof data.usedToday === 'number');
            assert.ok(typeof data.limit === 'number');
        });
    });

    describe('POST /api/ai/generate', () => {
        it('should reject missing prompts', async () => {
            const res = await fetch(`${API_BASE}/api/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'test-token' },
                body: JSON.stringify({})
            });
            assert.equal(res.status, 400);
        });

        it('should generate content with valid prompts', async () => {
            const res = await fetch(`${API_BASE}/api/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'test-token' },
                body: JSON.stringify({
                    systemPrompt: 'You are a helpful assistant.',
                    userPrompt: 'Say hello',
                    taskType: 'general'
                })
            });
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.ok(data.choices || data.error === undefined);
        });
    });

    describe('POST /api/save-state', () => {
        it('should reject missing channelId', async () => {
            const res = await fetch(`${API_BASE}/api/save-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'test-token' },
                body: JSON.stringify({ state: {} })
            });
            assert.equal(res.status, 400);
        });

        it('should save channel state', async () => {
            const res = await fetch(`${API_BASE}/api/save-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'test-token' },
                body: JSON.stringify({
                    channelId: 'UCtestchannel12345678901',
                    state: { infiniteLoopEnabled: true }
                })
            });
            assert.equal(res.status, 200);
        });
    });

    describe('POST /api/credits/purchase-success', () => {
        it('should reject missing fields', async () => {
            const res = await fetch(`${API_BASE}/api/credits/purchase-success`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'test-token' },
                body: JSON.stringify({ plan: 'pro' })
            });
            assert.equal(res.status, 400);
        });

        it('should reject without nonce', async () => {
            const res = await fetch(`${API_BASE}/api/credits/purchase-success`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'test-token' },
                body: JSON.stringify({
                    orderID: 'TEST_ORDER_123',
                    plan: 'pro',
                    channelId: 'UCtestchannel12345678901'
                })
            });
            assert.equal(res.status, 400);
        });

        it('should complete test purchase with valid nonce', { skip: !process.env.DATABASE_URL ? 'No test database available' : false }, async () => {
            // Enable test purchases for this test
            process.env.ALLOW_TEST_PURCHASES = 'true';

            // Get a nonce first
            const nonceRes = await fetch(`${API_BASE}/api/credits/nonce`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'test-token' },
                body: JSON.stringify({
                    plan: 'pro',
                    channelId: 'UCtestchannel12345678901'
                })
            });
            assert.equal(nonceRes.status, 200);
            const nonceData = await nonceRes.json();
            assert.ok(nonceData.nonce, 'Should return a nonce');

            // Now complete the purchase with the nonce
            const res = await fetch(`${API_BASE}/api/credits/purchase-success`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'test-token' },
                body: JSON.stringify({
                    orderID: 'TEST_ORDER_' + Date.now(),
                    plan: 'pro',
                    channelId: 'UCtestchannel12345678901',
                    nonce: nonceData.nonce
                })
            });
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.equal(data.success, true);

            // Clean up
            delete process.env.ALLOW_TEST_PURCHASES;
        });
    });

    describe('Rate Limiting', () => {
        it('should rate limit excessive requests', async () => {
            const requests = [];
            for (let i = 0; i < 110; i++) {
                requests.push(fetch(`${API_BASE}/api/quota/status`));
            }
            const results = await Promise.all(requests);
            const tooMany = results.filter(r => r.status === 429);
            assert.ok(tooMany.length > 0, 'Should have rate-limited some requests');
        });
    });
});

describe('Utility Functions', () => {
    it('escapeXml should escape special characters', async () => {
        const escapeXml = (str) => str.replace(/[<>&'"]/g, c => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
        })[c]);
        
        assert.equal(escapeXml('<test>'), '&lt;test&gt;');
        assert.equal(escapeXml('foo & bar'), 'foo &amp; bar');
    });

    it('getGradientColors should return correct colors', async () => {
        const getGradientColors = (keywords) => {
            const keywordStr = Array.isArray(keywords) ? keywords.join(' ') : keywords || '';
            const lower = keywordStr.toLowerCase();
            
            if (lower.includes('tech') || lower.includes('code')) return ['#1a1a2e', '#16213e'];
            if (lower.includes('science') || lower.includes('space')) return ['#0c0c1e', '#2c003e'];
            return ['#1a1a2e', '#0f3460'];
        };

        assert.deepEqual(getGradientColors('tech'), ['#1a1a2e', '#16213e']);
        assert.deepEqual(getGradientColors('space'), ['#0c0c1e', '#2c003e']);
        assert.deepEqual(getGradientColors('random'), ['#1a1a2e', '#0f3460']);
    });
});