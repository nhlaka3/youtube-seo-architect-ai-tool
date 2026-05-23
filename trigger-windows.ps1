// trigger-automation.js - Run directly on Windows with Node.js
const { spawn } = require('child_process');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';

const demoScript = `
[Segment: 1] In the year 2026, AI is no longer a tool, but a partner.
[Segment: 2] From neural links to autonomous cities, the line between man and machine is blurring.
[Segment: 3] Evolution is accelerating. Are we ready for what comes next?
[Segment: 4] The future is not just digital; it is biological integration at scale.
[Segment: 5] Join us as we explore the edge of tomorrow.
`;

function makeRequest(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, SERVER_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function triggerAutomation() {
    console.log('[Demo] Starting automation...');

    try {
        console.log('[Demo] 1/3 Launching Auto Flow Browser...');
        const launchRes = await makeRequest('POST', '/api/autoflow/launch');
        console.log('[Demo] Launch result:', launchRes);
        
        if (!launchRes.success) {
            console.log('[Demo] Browser launch failed. Please ensure Chrome is running with debugging:');
            console.log('   "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9223');
            return;
        }

        await new Promise(r => setTimeout(r, 3000));

        console.log('[Demo] 2/3 Starting video generation...');
        const generateRes = await makeRequest('POST', '/api/autoflow/generate', { 
            script: demoScript, 
            sceneCount: 5 
        });
        console.log('[Demo] Generation result:', generateRes);

        console.log('[Demo] 3/3 Checking final status...');
        const statusRes = await makeRequest('GET', '/api/autoflow/status');
        console.log('[Final Status]', statusRes);

        console.log('[Demo] Automation complete!');
    } catch (e) {
        console.error('[Demo Error]:', e.message);
    }
}

triggerAutomation();
