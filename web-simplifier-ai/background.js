// Background Service Worker for Web Simplifier AI

// Model configuration
// NOTE: With STRICT_SINGLE_API_REQUEST enabled, we will NOT fall back to other models.
// The model should match what your AI Studio key/project has access to.
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

function sanitizeModelId(model) {
  if (!model || typeof model !== 'string') return DEFAULT_GEMINI_MODEL;
  const trimmed = model.trim();
  if (!trimmed) return DEFAULT_GEMINI_MODEL;
  // Model IDs are typically like: gemini-2.0-flash, gemini-2.0-flash-lite, gemini-1.5-flash
  if (!/^[a-z0-9._-]+$/i.test(trimmed)) {
    throw new Error('Invalid model id. Use a value like "gemini-2.0-flash".');
  }
  return trimmed;
}

function getAPIUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// Free-tier protections
const MIN_API_CALL_INTERVAL_MS = 12000; // hard cooldown to reduce 429s (free-tier safe)
const LAST_API_CALL_AT_STORAGE_KEY = 'lastApiCallAt';
let lastApiCallAt = 0;

// Strict global serialization: ensures only one Gemini request executes at a time
// (prevents race conditions and duplicate calls from UI events)
let apiQueue = Promise.resolve();

// Dedupe identical in-flight requests (prevents double calls from double-clicks)
const inFlightRequests = new Map();

// Tiny in-memory cache (extra safety if content script cache misses)
const MEMORY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const memoryCache = new Map();

function stableHash(str) {
  // Simple non-crypto hash; enough for dedupe/cache keys
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'callGemini') {
    handleGeminiRequest(message.content, message.title, message.apiKey, message.model)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
});

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function enqueueGeminiApiCall(taskFn) {
  const task = apiQueue.then(taskFn);
  // Keep the queue alive even if the task fails.
  apiQueue = task.catch(() => undefined);
  return task;
}

// Call Gemini API (single request; no retries)
async function handleGeminiRequest(content, title, apiKey, model) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  // Validate and sanitize content
  if (!content || typeof content !== 'string') {
    throw new Error('Invalid content provided');
  }
  
  // Remove any problematic characters that might cause 400 errors
  const sanitizedContent = content
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
  
  if (sanitizedContent.length < 50) {
    throw new Error('Content too short to summarize (minimum 50 characters)');
  }
  
  // More aggressive truncation to save API quota (reduced from 30k to 15k)
  const maxLength = 15000;
  const truncatedContent = sanitizedContent.length > maxLength 
    ? sanitizedContent.substring(0, maxLength) + '\n\n[Content truncated to save API quota...]'
    : sanitizedContent;
  
  const selectedModel = sanitizeModelId(model);

  const prompt = createPrompt(truncatedContent, title);
  const requestKey = stableHash(`${selectedModel}|${title || ''}|${prompt}`);

  // Memory cache hit
  const cached = memoryCache.get(requestKey);
  if (cached && (Date.now() - cached.timestamp) < MEMORY_CACHE_TTL_MS) {
    return cached.text;
  }

  // In-flight dedupe
  const existing = inFlightRequests.get(requestKey);
  if (existing) {
    return existing;
  }
  
  const apiUrl = getAPIUrl(selectedModel);
  
  // Wrap the whole request in a single promise so we can dedupe.
  const promise = enqueueGeminiApiCall(async () => {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      // Hard cooldown (last line of defense) - persisted across service worker restarts.
      // Read from storage immediately before the API call to avoid races.
      const stored = await chrome.storage.local.get(LAST_API_CALL_AT_STORAGE_KEY);
      const storedLast = Number(stored?.[LAST_API_CALL_AT_STORAGE_KEY]) || 0;
      const effectiveLast = Math.max(storedLast, lastApiCallAt);

      const now = Date.now();
      const waitMs = MIN_API_CALL_INTERVAL_MS - (now - effectiveLast);
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      // Update storage immediately before calling fetch to prevent concurrent bypass.
      const callAt = Date.now();
      lastApiCallAt = callAt;
      await chrome.storage.local.set({ [LAST_API_CALL_AT_STORAGE_KEY]: callAt });

      response = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
            topP: 0.95,
            topK: 40
          }
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `API error: ${response.status}`;
    
    // Handle 404 - Model not found / not accessible
    if (response.status === 404) {
      throw new Error(
        'Model not available for this API key/project. ' +
        'Open the extension Settings and set a model your key can access (e.g., "gemini-2.0-flash"), ' +
        'or use a key/project that has access.'
      );
    }
    
    // Handle 400 - Bad Request (invalid key, invalid payload, or quota)
    if (response.status === 400) {
      console.error('400 Error details:', errorData);
      throw new Error('Invalid request. Please verify your API key and try again.');
    }
    
    // Provide user-friendly error messages
    if (response.status === 429) {
      throw new Error('Too many requests. Please wait 1-2 minutes and try again.');
    }

    if (response.status === 403) {
      throw new Error('API access denied. Please verify your API key permissions.');
    }
    
    throw new Error(errorMessage);
    }

    const data = await response.json().catch(() => null);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Invalid response from Gemini API');
    }

    memoryCache.set(requestKey, { text, timestamp: Date.now() });
    return text;
  });

  inFlightRequests.set(requestKey, promise);
  try {
    return await promise;
  } finally {
    inFlightRequests.delete(requestKey);
  }
}

// Create optimized prompt (shorter to reduce tokens)
function createPrompt(content, title) {
  return `Summarize this webpage: "${title || 'Unknown'}"

Provide:

**Summary** (2 sentences)

**Key Points** (4-5 bullets)

**Highlights** (2-3 insights)

Content:
${content}

Use simple language and markdown formatting.`;
}

// Handle extension icon click (alternative to popup)
chrome.action.onClicked.addListener((tab) => {
  // This only fires if there's no default_popup
  // Since we have a popup, this won't trigger, but keeping for reference
});

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Web Simplifier AI installed!');
    // Could open onboarding page here
  } else if (details.reason === 'update') {
    console.log('Web Simplifier AI updated to version', chrome.runtime.getManifest().version);
  }
});
