const puppeteer = require('puppeteer');

async function testFrontend() {
    let browser;
    
    try {
        browser = await puppeteer.launch({
            headless: false, // Set to true for headless mode
            args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        });
        
        const page = await browser.newPage();
        
        // Listen for console messages
        page.on('console', msg => {
            console.log(`[BROWSER ${msg.type()}]: ${msg.text()}`);
        });
        
        // Listen for page errors
        page.on('pageerror', error => {
            console.error(`[PAGE ERROR]: ${error.message}`);
        });
        
        // Navigate to the frontend
        console.log('Navigating to http://localhost:3000...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
        
        // Wait a moment for the page to load completely
        await page.waitForTimeout(3000);
        
        // Check if the Albums tab is visible and active
        const albumsTab = await page.$('#nav-albums');
        if (albumsTab) {
            console.log('✅ Albums tab found');
            const isActive = await page.evaluate(el => el.classList.contains('nav-tab-active'), albumsTab);
            console.log(`Albums tab active: ${isActive}`);
        } else {
            console.log('❌ Albums tab not found');
        }
        
        // Check if albums-list element exists
        const albumsList = await page.$('#albums-list');
        if (albumsList) {
            console.log('✅ Albums list element found');
            
            // Get the content of the albums list
            const content = await page.evaluate(el => el.innerHTML, albumsList);
            console.log('Albums list content length:', content.length);
            
            if (content.trim().length > 0) {
                console.log('Albums list has content');
                
                // Count folder and album items
                const folderCount = await page.$$eval('.folder-tree-item', items => items.length);
                const albumCount = await page.$$eval('.album-tree-item', items => items.length);
                
                console.log(`Found ${folderCount} folders and ${albumCount} albums`);
            } else {
                console.log('❌ Albums list is empty');
            }
        } else {
            console.log('❌ Albums list element not found');
        }
        
        // Check for specific error patterns in the console
        const logs = await page.evaluate(() => {
            return window.console.history || [];
        });
        
        // Take a screenshot for debugging
        await page.screenshot({ path: '/Users/shelbyklein/apps/targetvision/frontend_test_screenshot.png', fullPage: true });
        console.log('Screenshot saved as frontend_test_screenshot.png');
        
        // Check network requests
        const responses = [];
        page.on('response', response => {
            if (response.url().includes('smugmug') || response.url().includes('nodes')) {
                responses.push({
                    url: response.url(),
                    status: response.status(),
                    headers: response.headers()
                });
            }
        });
        
        // Wait a bit more to catch any async operations
        await page.waitForTimeout(5000);
        
        if (responses.length > 0) {
            console.log('Network responses captured:');
            responses.forEach(resp => {
                console.log(`  ${resp.status}: ${resp.url}`);
            });
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

testFrontend();