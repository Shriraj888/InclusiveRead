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
 * Detect and simplify jargon - Enhanced version
 */
async function detectJargon(pageText, apiKey, options = {}) {
    const { category = 'all', contextHints = [] } = options;
    
    // Pre-process text to extract meaningful content
    const cleanText = pageText
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s.,;:'"()-]/g, '')
        .trim();
    
    const prompt = `You are an expert accessibility assistant helping neurodivergent users understand complex terminology.

CONTEXT: Analyze this webpage content and identify terms that may be difficult to understand.

PAGE CONTENT:
"""
${cleanText.slice(0, 4000)}
"""

YOUR TASK:
1. Identify complex terms in these categories:
   - LEGAL: contracts, agreements, liability, terms of service
   - FINANCIAL: fees, payments, billing, transactions
   - TECHNICAL: software, digital, computing terms
   - MEDICAL: health, conditions, treatments
   - GOVERNMENT: regulations, policies, bureaucratic language
   - ACADEMIC: formal, scholarly language

2. For each term provide:
   - The exact term as it appears (preserve case)
   - A simple 2-4 word alternative
   - A brief explanation (max 15 words)
   - Category (legal/financial/technical/medical/government/academic)
   - Difficulty level (1-3, where 3 is most complex)

3. PRIORITIZE:
   - Terms related to user actions or decisions
   - Terms that could cause confusion or anxiety
   - Terms with legal or financial implications
   - Acronyms and abbreviations

RESPOND with valid JSON array only (no markdown):
[
  {
    "jargon": "exact term",
    "simple": "easy alternative",
    "explanation": "brief context in plain English",
    "category": "legal|financial|technical|medical|government|academic",
    "difficulty": 1-3
  }
]

Return up to 15 terms, sorted by importance. If no complex terms found, return empty array [].`;

    try {
        const text = await callOpenRouter([{ role: 'user', content: prompt }], apiKey);

        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) {
            console.warn('No valid JSON array in jargon response');
            return [];
        }
        
        let result = JSON.parse(jsonMatch[0]);
        
        // Validate and clean results
        result = result.filter(item => 
            item.jargon && 
            item.simple && 
            item.jargon.length >= 3 &&
            item.jargon.length <= 50
        ).map(item => ({
            jargon: item.jargon.trim(),
            simple: item.simple.trim(),
            explanation: (item.explanation || '').trim(),
            category: item.category || 'general',
            difficulty: Math.min(3, Math.max(1, item.difficulty || 2))
        }));

        // Sort by difficulty (most complex first)
        result.sort((a, b) => b.difficulty - a.difficulty);

        return result;
    } catch (error) {
        console.error('Jargon detection failed:', error);
        return [];
    }
}

/**
 * Simplify text into plain, easy-to-understand English
 */
async function simplifyText(text, apiKey) {
    const cleanText = text
        .replace(/\s+/g, ' ')
        .trim();
    
    const prompt = `You are a plain language expert helping neurodivergent users understand complex text.

ORIGINAL TEXT:
"""
${cleanText.slice(0, 3000)}
"""

YOUR TASK:
Rewrite this text in SIMPLE, PLAIN ENGLISH that is easy to understand.

RULES:
1. Use short sentences (max 15 words each)
2. Use common, everyday words
3. Avoid jargon, technical terms, and formal language
4. Break down complex ideas into simple steps
5. Use active voice ("We will send" not "It will be sent")
6. Explain any necessary technical terms in parentheses
7. Keep the same meaning and all important information
8. Use bullet points for lists when helpful
9. Write at a 6th-grade reading level

RESPOND with valid JSON only (no markdown):
{
  "simplified": "the rewritten text in plain English",
  "readingLevel": "estimated grade level (e.g., '6th grade')",
  "keyChanges": ["brief list of main simplifications made"]
}`;

    try {
        const response = await callOpenRouter([{ role: 'user', content: prompt }], apiKey);
        
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('No valid JSON in simplify response');
            return null;
        }
        
        const result = JSON.parse(jsonMatch[0]);
        
        if (!result.simplified) {
            return null;
        }
        
        return {
            simplified: result.simplified.trim(),
            readingLevel: result.readingLevel || 'Unknown',
            keyChanges: result.keyChanges || []
        };
    } catch (error) {
        console.error('Text simplification failed:', error);
        return null;
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
        detectJargon,
        simplifyText,
        testApiKey
    };
}
