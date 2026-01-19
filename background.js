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
            return await testApiKeyHandler(request.apiKey, request.provider);

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
async function testApiKeyHandler(apiKey, provider) {
    try {
        const result = await testApiKey(apiKey, provider);
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
            ttsWordHighlight: true,

            apiProvider: 'gemini'  // Default to Gemini for new installs
        });

        // Open welcome page - redirect to installation guide
        chrome.tabs.create({
            url: 'https://inclusive-read.vercel.app/#installation'
        });
    }

    // Migration for existing users on update
    if (details.reason === 'update') {
        chrome.storage.local.get(['apiKey', 'geminiKey'], (localResult) => {
            chrome.storage.sync.get(['apiProvider'], (syncResult) => {
                const hasOpenRouterKey = !!localResult.apiKey;
                const hasGeminiKey = !!localResult.geminiKey;

                // If user has Gemini key but not OpenRouter, or no keys at all, default to Gemini
                if (!hasOpenRouterKey) {
                    chrome.storage.sync.set({ apiProvider: 'gemini' });
                    console.log('InclusiveRead: Migrated to Gemini provider');
                }
            });
        });
    }
});
