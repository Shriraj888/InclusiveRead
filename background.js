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

        case 'detectJargon':
            return await detectJargonHandler(request.pageText, request.apiKey, request.abortSignal);

        case 'simplifyText':
            return await simplifyTextHandler(request.text, request.apiKey, request.abortSignal);

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
 * Detect jargon
 */
async function detectJargonHandler(pageText, apiKey, abortSignal) {
    try {
        // Check if already aborted
        if (abortSignal) {
            return { success: false, error: 'Request aborted', aborted: true };
        }

        const result = await detectJargon(pageText, apiKey);
        return { success: true, data: result };
    } catch (error) {
        if (error.name === 'AbortError') {
            return { success: false, error: 'Request aborted', aborted: true };
        }
        return { success: false, error: error.message };
    }
}

/**
 * Simplify text into plain English
 */
async function simplifyTextHandler(text, apiKey, abortSignal) {
    try {
        // Check if already aborted
        if (abortSignal) {
            return { success: false, error: 'Request aborted', aborted: true };
        }

        const result = await simplifyText(text, apiKey);
        return { success: true, data: result };
    } catch (error) {
        if (error.name === 'AbortError') {
            return { success: false, error: 'Request aborted', aborted: true };
        }
        return { success: false, error: error.message };
    }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('InclusiveRead installed successfully!');

        // Set default settings
        chrome.storage.sync.set({
            jargonEnabled: false,
            sensoryEnabled: false,
            dyslexiaEnabled: false,
            dyslexiaFont: 'opendyslexic',
            letterSpacing: 1,
            lineHeight: 1.6,
            wordSpacing: 3,
            overlayColor: 'none',

            bionicReading: false,
            ttsEnabled: false,
            ttsSpeed: 1,
            ttsPauseOnPunctuation: true,
            ttsWordHighlight: true
        });

        // Open welcome page or settings
        chrome.tabs.create({
            url: 'https://openrouter.ai/keys'
        });
    }
});
