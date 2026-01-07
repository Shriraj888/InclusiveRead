// Gemini Service - Renamed to handle OpenRouter API (Gemma 27B)

const OPENROUTER_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAME = 'google/gemma-3-27b-it:free';

/**
 * Helper to call OpenRouter API
 */
async function callOpenRouter(messages, apiKey) {
    try {
        const response = await fetch(OPENROUTER_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://github.com/InclusiveRead', // Best practice for OpenRouter
                'X-Title': 'InclusiveRead Extension'
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API validation error:', errorData);
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (error) {
        console.error('OpenRouter API error:', error);
        throw error;
    }
}

/**
 * Analyze page intent and identify primary action
 */
async function analyzePageIntent(domStructure, apiKey) {
    const prompt = `You are an accessibility AI analyzing a webpage to help neurodivergent users.

Given this page structure:
${JSON.stringify(domStructure.slice(0, 50), null, 2)}

Tasks:
1. Identify the PRIMARY user action on this page (e.g., "Register", "Pay Bill", "Submit Form", "Login")
2. Return the XPath of the most important interactive element for that action
3. List any secondary important actions

Respond ONLY with valid JSON in this exact format:
{
  "primaryAction": "description of main action",
  "primaryElement": "xpath of element",
  "secondaryActions": ["action1", "action2"],
  "pageType": "form|information|navigation|transaction"
}`;

    try {
        const text = await callOpenRouter([{ role: 'user', content: prompt }], apiKey);

        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

        return result;
    } catch (error) {
        console.error('Analysis failed:', error);
        return null;
    }
}

/**
 * Detect and simplify jargon
 */
async function detectJargon(pageText, apiKey) {
    const prompt = `You are simplifying legal/government jargon for neurodivergent users with cognitive processing differences.

Page text sample:
${pageText.slice(0, 2000)}

Tasks:
1. Identify complex legal/bureaucratic terms that would confuse users
2. Provide simple, plain-English alternatives
3. Focus on actionable language

Respond ONLY with valid JSON array:
[
  {
    "jargon": "original complex term",
    "simple": "easy alternative",
    "explanation": "brief context"
  }
]

Limit to top 10 most important terms.`;

    try {
        const text = await callOpenRouter([{ role: 'user', content: prompt }], apiKey);

        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const result = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

        return result;
    } catch (error) {
        console.error('Jargon detection failed:', error);
        return [];
    }
}

/**
 * Test API key validity
 */
async function testApiKey(apiKey) {
    try {
        await callOpenRouter([{ role: 'user', content: 'Say hello' }], apiKey);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Export for background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        analyzePageIntent,
        detectJargon,
        testApiKey
    };
}
