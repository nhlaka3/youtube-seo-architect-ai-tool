const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting PayPal Purchase Test...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--disable-web-security']
    });
    const page = await browser.newPage();

    try {
        console.log('Navigating to dashboard...');
        await page.goto('http://localhost:5173/dashboard.html?plan=agency', { waitUntil: 'networkidle2' });

        // Wait for the PayPal modal to appear
        console.log('Waiting for Upgrade Modal...');
        await page.waitForSelector('#upgrade-modal.active', { timeout: 10000 });
        
        console.log('Waiting for PayPal iframe...');
        await page.waitForTimeout(5000); // Give PayPal SDK time to render
        
        // Find the PayPal button iframe
        const frameElement = await page.$('iframe[title*="PayPal"]');
        if (!frameElement) {
            throw new Error('PayPal iframe not found');
        }
        const frame = await frameElement.contentFrame();
        
        console.log('Clicking PayPal button...');
        await frame.waitForSelector('.paypal-button');
        
        // Listen for new popup window
        const targetPromise = new Promise(resolve => browser.once('targetcreated', resolve));
        await frame.click('.paypal-button');
        
        const popupTarget = await targetPromise;
        const popup = await popupTarget.page();
        
        console.log('Popup opened. Waiting for login form...');
        await popup.waitForSelector('#email', { timeout: 15000 });
        
        console.log('Entering email...');
        await popup.type('#email', 'sb-anck350442062@personal.example.com');
        await popup.click('#btnNext');
        
        console.log('Entering password...');
        await popup.waitForSelector('#password', { visible: true });
        await popup.type('#password', 'I/Bk=f%2');
        await popup.click('#btnLogin');
        
        console.log('Waiting for payment confirmation page...');
        await popup.waitForSelector('#payment-submit-btn', { timeout: 20000 });
        
        console.log('Submitting payment...');
        await popup.click('#payment-submit-btn');
        
        console.log('Waiting for popup to close and return to main page...');
        await page.waitForTimeout(5000); // Wait for the flow to finish
        
        console.log('Purchase Test Completed Successfully!');
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Uncomment to keep browser open for debugging
        // await browser.close();
    }
})();
