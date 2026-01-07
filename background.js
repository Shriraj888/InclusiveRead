// Background Service Worker - Handles API calls and message routing

// Import Gemini service (note: in Manifest V3, we use importScripts)
importScripts('gemini-service.js');

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle async operations
    handleMessage(request, sender).then(sendResponse);
    return true; // Keep channel open for async response
});

async function handleMessage(request, sender) {
    switch (request.action) {
        case 'testApiKey':
            return await testApiKeyHandler(request.apiKey);

        case 'analyzePageIntent':
            return await analyzePageIntentHandler(request.domStructure, request.apiKey);

        case 'detectJargon':
            return await detectJargonHandler(request.pageText, request.apiKey);

        default:
            return { success: false, error: 'Unknown action' };
    }
}

/**
 * Test API key validity
 */
async function testApiKeyHandler(apiKey) {
    try {
        const result = await testApiKey(apiKey);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Analyze page intent
 */
async function analyzePageIntentHandler(domStructure, apiKey) {
    try {
        const result = await analyzePageIntent(domStructure, apiKey);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Detect jargon
 */
async function detectJargonHandler(pageText, apiKey) {
    try {
        const result = await detectJargon(pageText, apiKey);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('InclusiveRead installed successfully!');

        // Set default settings
        chrome.storage.sync.set({
            spotlightEnabled: false,
            jargonEnabled: false,
            sensoryEnabled: false,
            spotlightIntensity: 70
        });

        // Open welcome page or settings
        chrome.tabs.create({
            url: 'https://openrouter.ai/keys'
        });
    }
});
