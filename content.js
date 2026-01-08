// Content Script - Main page manipulation logic

// State
let state = {
    jargonEnabled: false,
    sensoryEnabled: false,
    dyslexiaEnabled: false,
    ttsEnabled: false,
    apiKey: null,
    jargonMap: [],
    animatedElements: [],
    selectionDecoderActive: false,
    dyslexiaSettings: {
        font: 'opendyslexic',
        letterSpacing: 1,
        lineHeight: 1.6,
        wordSpacing: 3,
        overlayColor: 'none',
        syllableHighlight: false,
        bionicReading: false
    },
    ttsSettings: {
        speed: 1,
        pauseOnPunctuation: true,
        wordHighlight: true
    },
    ttsState: {
        isPlaying: false,
        isPaused: false,
        currentUtterance: null,
        currentWordIndex: 0,
        textContent: '',
        words: []
    }
};

// Initialize
init();

async function init() {
    // Load settings
    const settings = await chrome.storage.sync.get([
        'jargonEnabled',
        'sensoryEnabled',
        'dyslexiaEnabled',
        'dyslexiaFont',
        'letterSpacing',
        'lineHeight',
        'wordSpacing',
        'overlayColor',
        'syllableHighlight',
        'bionicReading',
        'ttsEnabled',
        'ttsSpeed',
        'ttsPauseOnPunctuation',
        'ttsWordHighlight',
        'apiKey'
    ]);

    Object.assign(state, settings);

    // Update dyslexia settings if present
    if (settings.dyslexiaFont !== undefined) {
        state.dyslexiaSettings = {
            font: settings.dyslexiaFont || 'opendyslexic',
            letterSpacing: settings.letterSpacing || 1,
            lineHeight: settings.lineHeight || 1.6,
            wordSpacing: settings.wordSpacing || 3,
            overlayColor: settings.overlayColor || 'none',
            syllableHighlight: settings.syllableHighlight || false,
            bionicReading: settings.bionicReading || false
        };
    }

    // Update TTS settings if present
    if (settings.ttsSpeed !== undefined) {
        state.ttsSettings = {
            speed: settings.ttsSpeed || 1,
            pauseOnPunctuation: settings.ttsPauseOnPunctuation !== false,
            wordHighlight: settings.ttsWordHighlight !== false
        };
    }

    // Auto-enable features based on saved state
    if (state.jargonEnabled) {
        // Don't auto-run jargon decoder, just keep state
    }

    if (state.sensoryEnabled) {
        activateSensoryShield();
    }

    if (state.dyslexiaEnabled) {
        activateDyslexiaMode(state.dyslexiaSettings);
    }

    if (state.ttsEnabled) {
        activateTTSMode(state.ttsSettings);
    }

    // Apply enabled features
    if (state.jargonEnabled) {
        await activateJargonDecoder();
    }

    if (state.sensoryEnabled) {
        activateSensoryShield();
    }

    // Initialize selection decoder (always available)
    initSelectionDecoder();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request)
        .then(sendResponse)
        .catch(error => {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        });
    return true; // Indicates async response
});

/**
 * Handle messages from popup
 */
async function handleMessage(request) {
    const { action } = request;

    switch (action) {
        // Jargon Decoder
        case 'toggleJargon':
            state.jargonEnabled = request.enabled;
            if (request.enabled) {
                await activateJargonDecoder();
            } else {
                deactivateJargonDecoder();
            }
            return { success: true };

        // Sensory Shield
        case 'toggleSensory':
            state.sensoryEnabled = request.enabled;
            if (request.enabled) {
                activateSensoryShield();
            } else {
                deactivateSensoryShield();
            }
            return { success: true };

        // Dyslexia Reading Mode
        case 'toggleDyslexia':
            state.dyslexiaEnabled = request.enabled;
            if (request.enabled) {
                activateDyslexiaMode(request.settings);
            } else {
                deactivateDyslexiaMode();
            }
            return { success: true };

        case 'updateDyslexia':
            if (state.dyslexiaEnabled) {
                updateDyslexiaSettings(request.settings);
            }
            return { success: true };

        // Text-to-Speech
        case 'toggleTTS':
            state.ttsEnabled = request.enabled;
            if (request.enabled) {
                activateTTSMode(request.settings);
            } else {
                deactivateTTSMode();
            }
            return { success: true };

        case 'updateTTS':
            if (state.ttsEnabled) {
                updateTTSSettings(request.settings);
            }
            return { success: true };

        case 'ttsPlay':
            playTTS();
            return { success: true };

        case 'ttsPause':
            pauseTTS();
            return { success: true };

        case 'ttsStop':
            stopTTS();
            return { success: true };

        default:
            console.warn('Unknown action:', action);
            return { success: false, error: 'Unknown action' };
    }
}

/**
 * Selection-based Jargon Decoder
 * Shows a floating button when text is selected to decode only that portion
 */
function initSelectionDecoder() {
    // Create floating toolbar container
    const selectionToolbar = document.createElement('div');
    selectionToolbar.className = 'ir-selection-toolbar';
    selectionToolbar.style.display = 'none';

    // Decode button
    const decodeButton = document.createElement('div');
    decodeButton.className = 'ir-selection-decode-btn ir-toolbar-btn';
    decodeButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            <path d="M8 7h6"/>
            <path d="M8 11h8"/>
        </svg>
        <span>Decode</span>
    `;

    // Simplify button
    const simplifyButton = document.createElement('div');
    simplifyButton.className = 'ir-selection-simplify-btn ir-toolbar-btn';
    simplifyButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
        </svg>
        <span>Simplify</span>
    `;

    selectionToolbar.appendChild(decodeButton);
    selectionToolbar.appendChild(simplifyButton);
    document.body.appendChild(selectionToolbar);

    // Inject styles for selection decoder
    injectSelectionDecoderStyles();

    let currentSelection = null;
    let selectionRange = null;

    // Handle text selection
    document.addEventListener('mouseup', (e) => {
        // Don't show if clicking on the toolbar itself
        if (e.target.closest('.ir-selection-toolbar')) return;

        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText.length >= 10 && selectedText.length <= 5000) {
                currentSelection = selectedText;
                selectionRange = selection.getRangeAt(0).cloneRange();

                // Position toolbar near selection
                const rect = selection.getRangeAt(0).getBoundingClientRect();
                const toolbarWidth = 220;
                const toolbarHeight = 44;

                let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
                let top = rect.top - toolbarHeight - 12 + window.scrollY;

                // Keep within viewport
                left = Math.max(10, Math.min(left, window.innerWidth - toolbarWidth - 10));
                if (top < window.scrollY + 10) {
                    top = rect.bottom + 12 + window.scrollY;
                }

                selectionToolbar.style.left = `${left}px`;
                selectionToolbar.style.top = `${top}px`;
                selectionToolbar.style.display = 'flex';
                selectionToolbar.classList.add('ir-visible');
            } else {
                hideToolbar();
            }
        }, 10);
    });

    // Hide toolbar when clicking elsewhere
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.ir-selection-toolbar')) {
            hideToolbar();
        }
    });

    // Handle scroll - reposition or hide toolbar
    document.addEventListener('scroll', () => {
        if (selectionToolbar.classList.contains('ir-visible') && selectionRange) {
            const rect = selectionRange.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
                hideToolbar();
            }
        }
    }, { passive: true });

    // Decode button click handler
    decodeButton.addEventListener('click', async () => {
        if (currentSelection && selectionRange) {
            hideToolbar();
            await decodeSelectedText(currentSelection, selectionRange);
        }
    });

    // Simplify button click handler
    simplifyButton.addEventListener('click', async () => {
        if (currentSelection && selectionRange) {
            hideToolbar();
            await simplifySelectedText(currentSelection, selectionRange);
        }
    });

    function hideToolbar() {
        selectionToolbar.classList.remove('ir-visible');
        setTimeout(() => {
            if (!selectionToolbar.classList.contains('ir-visible')) {
                selectionToolbar.style.display = 'none';
            }
        }, 200);
    }
}

/**
 * Decode only the selected text
 */
async function decodeSelectedText(selectedText, range) {
    // Show mini loader
    showProgressLoader('Decoding selection...', 'jargon');
    updateProgress(10);

    // Get API key
    const { apiKey } = await chrome.storage.sync.get('apiKey');
    if (!apiKey) {
        hideProgressLoader();
        showNotification('Please configure your API key first', 'error');
        return;
    }
    updateProgress(20);

    try {
        updateProgressText('Analyzing selected text...');
        updateProgress(40);

        // Send to AI for analysis
        const response = await chrome.runtime.sendMessage({
            action: 'detectJargon',
            pageText: selectedText,
            apiKey
        });

        updateProgress(70);

        if (!response.success || !response.data || response.data.length === 0) {
            hideProgressLoader();
            showNotification('No complex terms found in selection', 'info');
            return;
        }

        updateProgressText('Applying simplifications...');
        updateProgress(85);

        // Apply replacements only within the selection range
        applyJargonToSelection(response.data, range);

        updateProgress(100);
        hideProgressLoader();

        // Show result popup
        showSelectionDecodedPopup(response.data, range);

    } catch (error) {
        console.error('Selection decode error:', error);
        hideProgressLoader();
        showNotification('Error decoding selection', 'error');
    }
}

/**
 * Simplify selected text into plain English
 */
async function simplifySelectedText(selectedText, range) {
    // Show loader
    showProgressLoader('Simplifying text...', 'jargon');
    updateProgress(10);

    // Get API key
    const { apiKey } = await chrome.storage.sync.get('apiKey');
    if (!apiKey) {
        hideProgressLoader();
        showNotification('Please configure your API key first', 'error');
        return;
    }
    updateProgress(20);

    try {
        updateProgressText('Rewriting in plain English...');
        updateProgress(40);

        // Send to AI for simplification
        const response = await chrome.runtime.sendMessage({
            action: 'simplifyText',
            text: selectedText,
            apiKey
        });

        updateProgress(80);

        if (!response.success || !response.data || !response.data.simplified) {
            hideProgressLoader();
            showNotification('Could not simplify this text', 'info');
            return;
        }

        updateProgressText('Done!');
        updateProgress(100);
        hideProgressLoader();

        // Show simplified text popup
        showSimplifiedTextPopup(selectedText, response.data, range);

    } catch (error) {
        console.error('Text simplification error:', error);
        hideProgressLoader();
        showNotification('Error simplifying text', 'error');
    }
}

/**
 * Show popup with simplified text
 */
function showSimplifiedTextPopup(originalText, data, range) {
    // Remove existing popup
    document.querySelector('.ir-simplify-popup')?.remove();

    const rect = range.getBoundingClientRect();

    const popup = document.createElement('div');
    popup.className = 'ir-simplify-popup';
    popup.innerHTML = `
        <div class="ir-simplify-popup-header">
            <span class="ir-simplify-popup-title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Simplified Version
            </span>
            <div class="ir-simplify-popup-actions">
                <button class="ir-simplify-copy" title="Copy simplified text">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                </button>
                <button class="ir-simplify-popup-close">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="ir-simplify-popup-content">
            <div class="ir-simplify-text">${escapeHtml(data.simplified)}</div>
            <div class="ir-simplify-meta">
                <span class="ir-simplify-level">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    Reading level: ${escapeHtml(data.readingLevel)}
                </span>
            </div>
            ${data.keyChanges && data.keyChanges.length > 0 ? `
                <div class="ir-simplify-changes">
                    <div class="ir-simplify-changes-title">Key simplifications:</div>
                    <ul>
                        ${data.keyChanges.map(change => `<li>${escapeHtml(change)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
        <div class="ir-simplify-popup-footer">
            <button class="ir-simplify-replace">Replace on page</button>
        </div>
    `;

    // Position popup
    let left = rect.left + (rect.width / 2) - 180;
    let top = rect.bottom + 15 + window.scrollY;

    left = Math.max(10, Math.min(left, window.innerWidth - 370));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    document.body.appendChild(popup);

    // Animation
    requestAnimationFrame(() => {
        popup.classList.add('ir-visible');
    });

    // Close button
    popup.querySelector('.ir-simplify-popup-close').addEventListener('click', () => {
        popup.classList.remove('ir-visible');
        setTimeout(() => popup.remove(), 200);
    });

    // Copy button
    popup.querySelector('.ir-simplify-copy').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(data.simplified);
            showNotification('Copied to clipboard!', 'success');
        } catch (err) {
            showNotification('Failed to copy', 'error');
        }
    });

    // Replace button
    popup.querySelector('.ir-simplify-replace').addEventListener('click', () => {
        replaceSelectionWithSimplified(range, data.simplified);
        popup.classList.remove('ir-visible');
        setTimeout(() => popup.remove(), 200);
        showNotification('Text replaced on page', 'success');
    });

    // Auto-close after 30 seconds
    setTimeout(() => {
        if (document.body.contains(popup)) {
            popup.classList.remove('ir-visible');
            setTimeout(() => popup.remove(), 200);
        }
    }, 30000);
}

/**
 * Replace selected text with simplified version
 */
function replaceSelectionWithSimplified(range, simplifiedText) {
    const container = range.commonAncestorContainer;
    const rootElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    if (!rootElement) return;

    // Create wrapper with simplified text
    const wrapper = document.createElement('span');
    wrapper.className = 'ir-simplified-text';
    wrapper.innerHTML = escapeHtml(simplifiedText);
    wrapper.title = 'This text was simplified by InclusiveRead';

    // Replace the selection
    range.deleteContents();
    range.insertNode(wrapper);

    // Inject styles
    injectSimplifiedTextStyles();
}

/**
 * Inject styles for simplified text
 */
function injectSimplifiedTextStyles() {
    const css = `
    .ir-simplified-text {
        background: rgba(34, 197, 94, 0.1);
        border-left: 2px solid #22c55e;
        padding: 2px 6px;
        border-radius: 4px;
        transition: background 0.2s;
    }
    
    .ir-simplified-text:hover {
        background: rgba(34, 197, 94, 0.15);
    }
    `;

    injectCSS(css, 'ir-simplified-text-styles');
}

/**
 * Apply jargon replacements only to selected range
 */
function applyJargonToSelection(jargonList, range) {
    // Get the container element of the selection
    const container = range.commonAncestorContainer;
    const rootElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    if (!rootElement) return;

    // Apply each jargon term
    jargonList.forEach(({ jargon, simple, explanation, category, difficulty }) => {
        const regex = new RegExp(`\\b${escapeRegex(jargon)}\\b`, 'gi');
        const safeSimple = escapeHtml(simple);
        const safeExplanation = escapeHtml(explanation || '');
        const safeCategory = escapeHtml(category || 'general');

        const walker = document.createTreeWalker(
            rootElement,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: node => {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_SKIP;

                    const tagName = parent.tagName.toLowerCase();
                    if (['script', 'style', 'noscript'].includes(tagName)) {
                        return NodeFilter.FILTER_SKIP;
                    }

                    if (parent.classList.contains('ir-jargon-wrapper') ||
                        parent.classList.contains('ir-jargon')) {
                        return NodeFilter.FILTER_SKIP;
                    }

                    if (node.textContent?.match(regex)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        const nodesToReplace = [];
        let node;
        while (node = walker.nextNode()) {
            nodesToReplace.push(node);
        }

        nodesToReplace.forEach(textNode => {
            const parent = textNode.parentElement;
            if (!parent) return;

            const html = textNode.textContent.replace(regex, (match) => {
                return `<span class="ir-jargon ir-jargon-selection ir-jargon-${safeCategory} ir-difficulty-${difficulty || 2}" 
                              data-simple="${safeSimple}" 
                              data-explanation="${safeExplanation}"
                              data-category="${safeCategory}"
                              data-original="${escapeHtml(match)}">${match}</span>`;
            });

            const wrapper = document.createElement('span');
            wrapper.className = 'ir-jargon-wrapper ir-selection-wrapper';
            wrapper.innerHTML = html;
            textNode.replaceWith(wrapper);
        });
    });

    // Inject styles if not already present
    injectJargonStyles();
}

/**
 * Show a popup with all decoded terms from selection
 */
function showSelectionDecodedPopup(jargonList, range) {
    // Remove existing popup
    document.querySelector('.ir-selection-popup')?.remove();

    const rect = range.getBoundingClientRect();

    const popup = document.createElement('div');
    popup.className = 'ir-selection-popup';
    popup.innerHTML = `
        <div class="ir-selection-popup-header">
            <span class="ir-selection-popup-title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Decoded ${jargonList.length} term${jargonList.length > 1 ? 's' : ''}
            </span>
            <button class="ir-selection-popup-close">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div class="ir-selection-popup-content">
            ${jargonList.map(item => `
                <div class="ir-selection-popup-item">
                    <div class="ir-selection-popup-term">
                        <span class="ir-term-original">${escapeHtml(item.jargon)}</span>
                        <span class="ir-term-arrow">→</span>
                        <span class="ir-term-simple">${escapeHtml(item.simple)}</span>
                    </div>
                    ${item.explanation ? `<div class="ir-selection-popup-explanation">${escapeHtml(item.explanation)}</div>` : ''}
                </div>
            `).join('')}
        </div>
        <div class="ir-selection-popup-footer">
            <button class="ir-selection-popup-clear">Clear highlights</button>
        </div>
    `;

    // Position popup
    let left = rect.left + (rect.width / 2) - 160;
    let top = rect.bottom + 15 + window.scrollY;

    left = Math.max(10, Math.min(left, window.innerWidth - 330));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    document.body.appendChild(popup);

    // Animation
    requestAnimationFrame(() => {
        popup.classList.add('ir-visible');
    });

    // Close button
    popup.querySelector('.ir-selection-popup-close').addEventListener('click', () => {
        popup.classList.remove('ir-visible');
        setTimeout(() => popup.remove(), 200);
    });

    // Clear highlights button
    popup.querySelector('.ir-selection-popup-clear').addEventListener('click', () => {
        document.querySelectorAll('.ir-selection-wrapper').forEach(wrapper => {
            wrapper.replaceWith(wrapper.textContent);
        });
        popup.classList.remove('ir-visible');
        setTimeout(() => popup.remove(), 200);
        showNotification('Selection highlights cleared', 'info');
    });

    // Auto-close after 15 seconds
    setTimeout(() => {
        if (document.body.contains(popup)) {
            popup.classList.remove('ir-visible');
            setTimeout(() => popup.remove(), 200);
        }
    }, 15000);
}

/**
 * Inject styles for selection decoder
 */
function injectSelectionDecoderStyles() {
    const css = `
    /* Selection Toolbar Container */
    .ir-selection-toolbar {
        position: absolute;
        display: none;
        align-items: center;
        gap: 6px;
        padding: 6px;
        background: #0a0a0a;
        border: 1px solid #333;
        border-radius: 12px;
        z-index: 10000000;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        opacity: 0;
        transform: translateY(5px);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
    }
    
    .ir-selection-toolbar.ir-visible {
        opacity: 1;
        transform: translateY(0);
    }
    
    /* Toolbar Buttons */
    .ir-toolbar-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        color: #a1a1a1;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    
    .ir-toolbar-btn:hover {
        background: #1a1a1a;
        border-color: #333;
        color: #fafafa;
    }
    
    .ir-toolbar-btn svg {
        width: 16px;
        height: 16px;
    }
    
    .ir-selection-decode-btn:hover {
        color: #60a5fa;
    }
    
    .ir-selection-simplify-btn:hover {
        color: #22c55e;
    }
    
    /* Selection-specific jargon highlighting */
    .ir-jargon-selection {
        animation: ir-selection-highlight 0.5s ease-out;
    }
    
    @keyframes ir-selection-highlight {
        0% { background: rgba(255, 255, 255, 0.3); }
        100% { background: rgba(255, 255, 255, 0.06); }
    }
    
    /* Selection Decoded Popup */
    .ir-selection-popup {
        position: absolute;
        width: 320px;
        background: #0a0a0a;
        border: 1px solid #262626;
        border-radius: 14px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
        z-index: 10000001;
        overflow: hidden;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .ir-selection-popup.ir-visible {
        opacity: 1;
        transform: translateY(0);
    }
    
    .ir-selection-popup-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: #111;
        border-bottom: 1px solid #262626;
    }
    
    .ir-selection-popup-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #22c55e;
    }
    
    .ir-selection-popup-title svg {
        width: 18px;
        height: 18px;
    }
    
    .ir-selection-popup-close {
        width: 28px;
        height: 28px;
        background: transparent;
        border: 1px solid #333;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    
    .ir-selection-popup-close:hover {
        background: #1a1a1a;
    }
    
    .ir-selection-popup-close svg {
        width: 14px;
        height: 14px;
        color: #737373;
    }
    
    .ir-selection-popup-content {
        padding: 12px;
        max-height: 250px;
        overflow-y: auto;
    }
    
    .ir-selection-popup-item {
        padding: 10px 12px;
        background: #111;
        border: 1px solid #1a1a1a;
        border-radius: 8px;
        margin-bottom: 8px;
    }
    
    .ir-selection-popup-item:last-child {
        margin-bottom: 0;
    }
    
    .ir-selection-popup-term {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
    }
    
    .ir-term-original {
        color: #a1a1a1;
        text-decoration: line-through;
        text-decoration-color: #ef4444;
    }
    
    .ir-term-arrow {
        color: #444;
        font-size: 12px;
    }
    
    .ir-term-simple {
        color: #22c55e;
        font-weight: 600;
    }
    
    .ir-selection-popup-explanation {
        margin-top: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: #737373;
        line-height: 1.5;
    }
    
    .ir-selection-popup-footer {
        padding: 12px 16px;
        border-top: 1px solid #262626;
        background: #0a0a0a;
    }
    
    .ir-selection-popup-clear {
        width: 100%;
        padding: 10px;
        background: transparent;
        border: 1px solid #333;
        border-radius: 8px;
        color: #a1a1a1;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .ir-selection-popup-clear:hover {
        background: #1a1a1a;
        color: #fafafa;
        border-color: #444;
    }
    
    /* Popup scrollbar */
    .ir-selection-popup-content::-webkit-scrollbar {
        width: 5px;
    }
    
    .ir-selection-popup-content::-webkit-scrollbar-track {
        background: #111;
    }
    
    .ir-selection-popup-content::-webkit-scrollbar-thumb {
        background: #333;
        border-radius: 3px;
    }
    
    /* Simplify Popup */
    .ir-simplify-popup {
        position: absolute;
        width: 360px;
        background: #0a0a0a;
        border: 1px solid #262626;
        border-radius: 14px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
        z-index: 10000001;
        overflow: hidden;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .ir-simplify-popup.ir-visible {
        opacity: 1;
        transform: translateY(0);
    }
    
    .ir-simplify-popup-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: #111;
        border-bottom: 1px solid #262626;
    }
    
    .ir-simplify-popup-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #22c55e;
    }
    
    .ir-simplify-popup-title svg {
        width: 18px;
        height: 18px;
    }
    
    .ir-simplify-popup-actions {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .ir-simplify-copy,
    .ir-simplify-popup-close {
        width: 28px;
        height: 28px;
        background: transparent;
        border: 1px solid #333;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    
    .ir-simplify-copy:hover,
    .ir-simplify-popup-close:hover {
        background: #1a1a1a;
    }
    
    .ir-simplify-copy svg,
    .ir-simplify-popup-close svg {
        width: 14px;
        height: 14px;
        color: #737373;
    }
    
    .ir-simplify-popup-content {
        padding: 16px;
        max-height: 300px;
        overflow-y: auto;
    }
    
    .ir-simplify-text {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: #e5e5e5;
        white-space: pre-wrap;
    }
    
    .ir-simplify-meta {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid #262626;
    }
    
    .ir-simplify-level {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: #737373;
    }
    
    .ir-simplify-level svg {
        width: 14px;
        height: 14px;
    }
    
    .ir-simplify-changes {
        margin-top: 12px;
        padding: 10px 12px;
        background: #111;
        border: 1px solid #1a1a1a;
        border-radius: 8px;
    }
    
    .ir-simplify-changes-title {
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 600;
        color: #737373;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
    }
    
    .ir-simplify-changes ul {
        margin: 0;
        padding-left: 16px;
    }
    
    .ir-simplify-changes li {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: #a1a1a1;
        line-height: 1.6;
        margin-bottom: 4px;
    }
    
    .ir-simplify-changes li:last-child {
        margin-bottom: 0;
    }
    
    .ir-simplify-popup-footer {
        padding: 12px 16px;
        border-top: 1px solid #262626;
        background: #0a0a0a;
    }
    
    .ir-simplify-replace {
        width: 100%;
        padding: 10px 16px;
        background: #22c55e;
        border: none;
        border-radius: 8px;
        color: #0a0a0a;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .ir-simplify-replace:hover {
        background: #16a34a;
        transform: translateY(-1px);
    }
    
    /* Simplify popup scrollbar */
    .ir-simplify-popup-content::-webkit-scrollbar {
        width: 5px;
    }
    
    .ir-simplify-popup-content::-webkit-scrollbar-track {
        background: #111;
    }
    
    .ir-simplify-popup-content::-webkit-scrollbar-thumb {
        background: #333;
        border-radius: 3px;
    }
    `;

    injectCSS(css, 'ir-selection-decoder-styles');
}

async function handleMessage(request) {
    switch (request.action) {
        case 'toggleJargon':
            state.jargonEnabled = request.enabled;
            if (request.enabled) {
                await activateJargonDecoder();
            } else {
                deactivateJargonDecoder();
            }
            break;

        case 'toggleSensory':
            state.sensoryEnabled = request.enabled;
            if (request.enabled) {
                activateSensoryShield();
            } else {
                deactivateSensoryShield();
            }
            break;

        case 'toggleDyslexia':
            state.dyslexiaEnabled = request.enabled;
            if (request.enabled) {
                activateDyslexiaMode(request.settings);
            } else {
                deactivateDyslexiaMode();
            }
            break;

        case 'updateDyslexia':
            if (state.dyslexiaEnabled) {
                updateDyslexiaSettings(request.settings);
            }
            break;

        case 'toggleTTS':
            state.ttsEnabled = request.enabled;
            if (request.enabled) {
                activateTTSMode(request.settings);
            } else {
                deactivateTTSMode();
            }
            break;

        case 'updateTTS':
            if (state.ttsEnabled) {
                updateTTSSettings(request.settings);
            }
            break;

        case 'ttsPlay':
            playTTS();
            break;

        case 'ttsPause':
            pauseTTS();
            break;

        case 'ttsStop':
            stopTTS();
            break;
    }

    return { success: true };
}

/**
 * FEATURE 1: Jargon Decoder (Enhanced)
 * Replaces complex terms with simple explanations
 * Features: Smart text extraction, caching, category-based styling, glossary panel
 */

// Jargon cache to avoid re-processing
const jargonCache = new Map();

async function activateJargonDecoder() {
    // Show loader
    showProgressLoader('Initializing Jargon Decoder...', 'jargon');
    updateProgress(5);

    // Get API key
    const { apiKey } = await chrome.storage.sync.get('apiKey');
    if (!apiKey) {
        console.warn('InclusiveRead: No API key configured');
        hideProgressLoader();
        showNotification('Please configure your API key first', 'error');
        return;
    }
    updateProgress(10);

    try {
        // Smart text extraction - focus on main content
        updateProgressText('Extracting main content...');
        updateProgress(15);

        const extractedContent = extractMainContent();

        if (!extractedContent.text || extractedContent.text.length < 50) {
            hideProgressLoader();
            showNotification('Not enough content to analyze', 'info');
            return;
        }

        updateProgress(25);
        updateProgressText('Detecting page context...');

        // Detect page context for better analysis
        const pageContext = detectPageContext();

        updateProgress(35);
        updateProgressText('Analyzing terminology...');

        // Check cache first
        const cacheKey = hashString(extractedContent.text.slice(0, 1000));
        if (jargonCache.has(cacheKey)) {
            updateProgress(80);
            updateProgressText('Using cached results...');
            const cachedData = jargonCache.get(cacheKey);
            applyJargonReplacements(cachedData);
            updateProgress(100);
            hideProgressLoader();
            showNotification(`Decoded ${cachedData.length} terms (cached)`, 'success');
            return;
        }

        // Send to AI for analysis
        const response = await chrome.runtime.sendMessage({
            action: 'detectJargon',
            pageText: extractedContent.text,
            context: pageContext,
            apiKey
        });

        updateProgress(70);

        if (!response.success || !response.data || response.data.length === 0) {
            hideProgressLoader();
            showNotification('No complex terms found', 'info');
            return;
        }

        // Cache the results
        jargonCache.set(cacheKey, response.data);

        updateProgressText('Applying simplifications...');
        updateProgress(80);

        // Apply with progressive enhancement
        await applyJargonReplacementsProgressive(response.data);

        state.jargonMap = response.data;

        updateProgress(95);

        // Create glossary panel
        createGlossaryPanel(response.data);

        updateProgress(100);
        hideProgressLoader();

        const termCount = response.data.length;
        const categories = [...new Set(response.data.map(t => t.category))];
        showNotification(`Decoded ${termCount} terms across ${categories.length} categories`, 'success');

    } catch (error) {
        console.error('InclusiveRead: Jargon decoder error:', error);
        hideProgressLoader();
        showNotification('Error analyzing page content', 'error');
    }
}

/**
 * Extract main content, avoiding navigation, ads, footers
 */
function extractMainContent() {
    // Try to find main content area
    const mainSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.main-content',
        '.content',
        '.post-content',
        '.article-content',
        '#content',
        '#main'
    ];

    let mainElement = null;
    for (const selector of mainSelectors) {
        mainElement = document.querySelector(selector);
        if (mainElement && mainElement.innerText.length > 200) break;
    }

    // Fallback to body but exclude common noise
    const excludeSelectors = [
        'nav', 'header', 'footer', 'aside',
        '.nav', '.navigation', '.menu', '.sidebar',
        '.advertisement', '.ad', '.cookie',
        '.social', '.share', '.comments',
        'script', 'style', 'noscript'
    ];

    const contentRoot = mainElement || document.body;
    const clone = contentRoot.cloneNode(true);

    // Remove noise elements
    excludeSelectors.forEach(selector => {
        clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    const text = clone.innerText
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000); // Increased limit for better analysis

    return {
        text,
        element: contentRoot,
        length: text.length
    };
}

/**
 * Detect page context for smarter jargon detection
 */
function detectPageContext() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';

    const contexts = [];

    // URL-based detection
    const urlPatterns = {
        legal: /legal|terms|privacy|policy|agreement|contract|disclaimer/,
        financial: /bank|payment|checkout|billing|invoice|finance|money|loan/,
        medical: /health|medical|doctor|patient|hospital|clinic|pharma/,
        government: /gov|government|federal|state|municipal|regulation/,
        technical: /docs|documentation|api|developer|technical|software/,
        academic: /edu|university|college|academic|research|journal/
    };

    for (const [context, pattern] of Object.entries(urlPatterns)) {
        if (pattern.test(url) || pattern.test(title) || pattern.test(metaDescription)) {
            contexts.push(context);
        }
    }

    return {
        url: window.location.hostname,
        title: document.title,
        detectedContexts: contexts,
        hasForm: document.querySelectorAll('form').length > 0,
        isCheckout: /checkout|payment|cart|basket/i.test(url + title)
    };
}

/**
 * Simple string hash for caching
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

/**
 * Apply jargon replacements progressively (shows terms as they're applied)
 */
async function applyJargonReplacementsProgressive(jargonList) {
    const totalTerms = jargonList.length;
    let processed = 0;

    for (const item of jargonList) {
        applyJargonReplacement(item);
        processed++;

        // Update progress proportionally
        const baseProgress = 80;
        const progressRange = 15;
        const currentProgress = baseProgress + (progressRange * (processed / totalTerms));
        updateProgress(Math.round(currentProgress));

        // Small delay for visual feedback
        if (processed < totalTerms) {
            await new Promise(r => setTimeout(r, 50));
        }
    }

    // Inject final styles
    injectJargonStyles();
}

/**
 * Apply single jargon replacement
 */
function applyJargonReplacement({ jargon, simple, explanation, category, difficulty }) {
    const regex = new RegExp(`\\b${escapeRegex(jargon)}\\b`, 'gi');

    // Escape HTML attributes
    const safeSimple = escapeHtml(simple);
    const safeExplanation = escapeHtml(explanation || '');
    const safeCategory = escapeHtml(category || 'general');

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: node => {
                // Skip already processed, scripts, styles
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_SKIP;

                const tagName = parent.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tagName)) {
                    return NodeFilter.FILTER_SKIP;
                }

                if (parent.classList.contains('ir-jargon-wrapper') ||
                    parent.classList.contains('ir-jargon') ||
                    parent.closest('.ir-glossary-panel')) {
                    return NodeFilter.FILTER_SKIP;
                }

                if (node.textContent?.match(regex)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        }
    );

    const nodesToReplace = [];
    let node;
    while (node = walker.nextNode()) {
        nodesToReplace.push(node);
    }

    nodesToReplace.forEach(textNode => {
        const parent = textNode.parentElement;
        if (!parent) return;

        const html = textNode.textContent.replace(regex, (match) => {
            return `<span class="ir-jargon ir-jargon-${safeCategory} ir-difficulty-${difficulty}" 
                          data-simple="${safeSimple}" 
                          data-explanation="${safeExplanation}"
                          data-category="${safeCategory}"
                          data-original="${escapeHtml(match)}">${match}</span>`;
        });

        const wrapper = document.createElement('span');
        wrapper.className = 'ir-jargon-wrapper';
        wrapper.innerHTML = html;
        textNode.replaceWith(wrapper);
    });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Inject jargon styles with category colors
 */
function injectJargonStyles() {
    const css = `
    /* Jargon Base Styles */
    .ir-jargon {
      background: rgba(255, 255, 255, 0.06);
      border-bottom: 2px dotted currentColor;
      cursor: help;
      position: relative;
      padding: 1px 4px;
      margin: 0 1px;
      border-radius: 3px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
    }
    
    .ir-jargon:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    
    /* Category Colors */
    .ir-jargon-legal { border-color: #f59e0b; color: inherit; }
    .ir-jargon-financial { border-color: #10b981; color: inherit; }
    .ir-jargon-technical { border-color: #3b82f6; color: inherit; }
    .ir-jargon-medical { border-color: #ef4444; color: inherit; }
    .ir-jargon-government { border-color: #8b5cf6; color: inherit; }
    .ir-jargon-academic { border-color: #ec4899; color: inherit; }
    .ir-jargon-general { border-color: #fafafa; color: inherit; }
    
    /* Difficulty indicators */
    .ir-difficulty-1 { border-style: dotted; }
    .ir-difficulty-2 { border-style: dashed; }
    .ir-difficulty-3 { border-style: solid; border-width: 2px; }
    
    /* Tooltip */
    .ir-jargon::after {
      content: attr(data-simple) " — " attr(data-explanation);
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) translateY(0);
      background: #0a0a0a;
      border: 1px solid #333;
      color: #fafafa;
      padding: 12px 16px;
      border-radius: 10px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      font-weight: 400;
      line-height: 1.5;
      max-width: 300px;
      min-width: 150px;
      white-space: normal;
      text-align: left;
      z-index: 1000000;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
    }
    
    .ir-jargon:hover::after {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(-4px);
    }
    
    /* Tooltip Arrow */
    .ir-jargon::before {
      content: "";
      position: absolute;
      bottom: calc(100% + 2px);
      left: 50%;
      transform: translateX(-50%);
      border: 7px solid transparent;
      border-top-color: #333;
      z-index: 1000001;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease, visibility 0.2s;
    }
    
    .ir-jargon:hover::before {
      opacity: 1;
      visibility: visible;
    }
    
    /* Handle edge positioning */
    .ir-jargon[data-tooltip-pos="left"]::after {
      left: 0;
      transform: translateX(0) translateY(0);
    }
    .ir-jargon[data-tooltip-pos="left"]:hover::after {
      transform: translateX(0) translateY(-4px);
    }
    
    .ir-jargon[data-tooltip-pos="right"]::after {
      left: auto;
      right: 0;
      transform: translateX(0) translateY(0);
    }
    .ir-jargon[data-tooltip-pos="right"]:hover::after {
      transform: translateX(0) translateY(-4px);
    }

    /* Glossary Panel Toggle Button */
    .ir-glossary-toggle {
      position: fixed;
      bottom: 24px;
      left: 24px;
      width: 48px;
      height: 48px;
      background: #111;
      border: 1px solid #333;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .ir-glossary-toggle:hover {
      transform: scale(1.1);
      background: #1a1a1a;
    }
    
    .ir-glossary-toggle svg {
      width: 22px;
      height: 22px;
      color: #fafafa;
    }
    
    .ir-glossary-toggle .ir-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #fafafa;
      color: #0a0a0a;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
      font-family: 'Inter', sans-serif;
    }
    
    /* Glossary Panel */
    .ir-glossary-panel {
      position: fixed;
      bottom: 84px;
      left: 24px;
      width: 340px;
      max-height: 450px;
      background: #0a0a0a;
      border: 1px solid #262626;
      border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
      z-index: 999998;
      overflow: hidden;
      display: none;
      animation: ir-panel-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .ir-glossary-panel.active {
      display: block;
    }
    
    @keyframes ir-panel-in {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    
    .ir-glossary-header {
      padding: 16px 20px;
      border-bottom: 1px solid #262626;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .ir-glossary-title {
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 600;
      color: #fafafa;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .ir-glossary-title svg {
      width: 18px;
      height: 18px;
    }
    
    .ir-glossary-close {
      width: 28px;
      height: 28px;
      background: transparent;
      border: 1px solid #333;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    
    .ir-glossary-close:hover {
      background: #1a1a1a;
    }
    
    .ir-glossary-close svg {
      width: 14px;
      height: 14px;
      color: #737373;
    }
    
    .ir-glossary-content {
      padding: 12px;
      max-height: 380px;
      overflow-y: auto;
    }
    
    .ir-glossary-item {
      padding: 12px 14px;
      background: #111;
      border: 1px solid #1a1a1a;
      border-radius: 10px;
      margin-bottom: 8px;
      transition: all 0.2s;
    }
    
    .ir-glossary-item:hover {
      border-color: #333;
      background: #141414;
    }
    
    .ir-glossary-item:last-child {
      margin-bottom: 0;
    }
    
    .ir-glossary-term {
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #fafafa;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .ir-glossary-category {
      font-size: 10px;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .ir-cat-legal { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .ir-cat-financial { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .ir-cat-technical { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
    .ir-cat-medical { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .ir-cat-government { background: rgba(139, 92, 246, 0.2); color: #8b5cf6; }
    .ir-cat-academic { background: rgba(236, 72, 153, 0.2); color: #ec4899; }
    .ir-cat-general { background: rgba(250, 250, 250, 0.1); color: #a1a1a1; }
    
    .ir-glossary-simple {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      color: #22c55e;
      margin-bottom: 4px;
    }
    
    .ir-glossary-explanation {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      color: #737373;
      line-height: 1.5;
    }
    
    /* Scrollbar */
    .ir-glossary-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .ir-glossary-content::-webkit-scrollbar-track {
      background: #111;
    }
    
    .ir-glossary-content::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 3px;
    }
  `;

    injectCSS(css, 'ir-jargon-styles');

    // Fix tooltip positioning for edge cases
    requestAnimationFrame(() => {
        document.querySelectorAll('.ir-jargon').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.left < 150) {
                el.setAttribute('data-tooltip-pos', 'left');
            } else if (rect.right > window.innerWidth - 150) {
                el.setAttribute('data-tooltip-pos', 'right');
            }
        });
    });
}

/**
 * Create glossary panel with all decoded terms
 */
function createGlossaryPanel(jargonList) {
    // Remove existing panel
    document.querySelector('.ir-glossary-toggle')?.remove();
    document.querySelector('.ir-glossary-panel')?.remove();

    if (!jargonList || jargonList.length === 0) return;

    // Create toggle button
    const toggle = document.createElement('button');
    toggle.className = 'ir-glossary-toggle';
    toggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            <path d="M8 7h6"/>
            <path d="M8 11h8"/>
        </svg>
        <span class="ir-badge">${jargonList.length}</span>
    `;
    toggle.title = 'View Glossary';

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'ir-glossary-panel';
    panel.innerHTML = `
        <div class="ir-glossary-header">
            <span class="ir-glossary-title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                </svg>
                Glossary (${jargonList.length} terms)
            </span>
            <button class="ir-glossary-close">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div class="ir-glossary-content">
            ${jargonList.map(item => `
                <div class="ir-glossary-item">
                    <div class="ir-glossary-term">
                        ${escapeHtml(item.jargon)}
                        <span class="ir-glossary-category ir-cat-${item.category || 'general'}">${item.category || 'general'}</span>
                    </div>
                    <div class="ir-glossary-simple">→ ${escapeHtml(item.simple)}</div>
                    ${item.explanation ? `<div class="ir-glossary-explanation">${escapeHtml(item.explanation)}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    // Event listeners
    toggle.addEventListener('click', () => {
        panel.classList.toggle('active');
    });

    panel.querySelector('.ir-glossary-close').addEventListener('click', () => {
        panel.classList.remove('active');
    });
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deactivateJargonDecoder() {
    removeCSS('ir-jargon-styles');

    // Remove all jargon wrappers and restore original text
    document.querySelectorAll('.ir-jargon-wrapper').forEach(wrapper => {
        const text = wrapper.textContent;
        wrapper.replaceWith(text);
    });

    // Remove glossary panel and toggle
    document.querySelector('.ir-glossary-toggle')?.remove();
    document.querySelector('.ir-glossary-panel')?.remove();

    // Clear state
    state.jargonMap = [];
}

/**
 * FEATURE 3: Sensory Shield
 * Freezes distracting animations
 */
function activateSensoryShield() {
    state.animatedElements = detectAnimations();

    const css = `
    /* InclusiveRead Sensory Shield */
    * {
      animation-play-state: paused !important;
      animation: none !important;
    }
    
    video, iframe[src*="youtube"], iframe[src*="vimeo"] {
      filter: grayscale(50%) !important;
      opacity: 0.7 !important;
    }
    
    .ir-frozen::after {
      content: "⏸️";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 48px;
      z-index: 1000;
      pointer-events: none;
    }
  `;

    injectCSS(css, 'ir-sensory-styles');

    // Pause videos
    document.querySelectorAll('video').forEach(video => {
        video.pause();
        video.classList.add('ir-frozen');
    });
}

function deactivateSensoryShield() {
    removeCSS('ir-sensory-styles');
    document.querySelectorAll('.ir-frozen').forEach(el => {
        el.classList.remove('ir-frozen');
    });
}

/**
 * FEATURE 3: Dyslexia-Friendly Reading Mode
 * Applies dyslexia-friendly fonts, spacing, and reading aids
 */

function activateDyslexiaMode(settings) {
    state.dyslexiaSettings = settings;
    applyDyslexiaStyles(settings);
    showNotification('Dyslexia mode activated', 'success');
}

function deactivateDyslexiaMode() {
    removeCSS('ir-dyslexia-styles');
    removeCSS('ir-dyslexia-overlay');
    removeCSS('ir-opendyslexic-font');

    // Remove bionic reading and syllable highlighting
    document.querySelectorAll('.ir-bionic-word, .ir-syllable-word').forEach(el => {
        el.replaceWith(el.textContent);
    });

    showNotification('Dyslexia mode deactivated', 'info');
}

function updateDyslexiaSettings(settings) {
    state.dyslexiaSettings = settings;
    applyDyslexiaStyles(settings);
}

function applyDyslexiaStyles(settings) {
    // Remove old styles
    removeCSS('ir-dyslexia-styles');
    removeCSS('ir-dyslexia-overlay');
    removeCSS('ir-opendyslexic-font');

    // Inject OpenDyslexic font if selected
    if (settings.font === 'opendyslexic') {
        const fontCSS = `
            @font-face {
                font-family: 'OpenDyslexic';
                src: url('https://www.cdnfonts.com/s/19472/OpenDyslexic-Regular.woff') format('woff'),
                     url('https://cdn.jsdelivr.net/gh/antijingoist/opendyslexic@master/compiled/OpenDyslexic-Regular.otf') format('opentype');
                font-weight: 400;
                font-style: normal;
                font-display: swap;
            }
            
            @font-face {
                font-family: 'OpenDyslexic';
                src: url('https://www.cdnfonts.com/s/19472/OpenDyslexic-Bold.woff') format('woff'),
                     url('https://cdn.jsdelivr.net/gh/antijingoist/opendyslexic@master/compiled/OpenDyslexic-Bold.otf') format('opentype');
                font-weight: 700;
                font-style: normal;
                font-display: swap;
            }
        `;
        injectCSS(fontCSS, 'ir-opendyslexic-font');
    }

    // Determine font family
    let fontFamily;
    switch (settings.font) {
        case 'opendyslexic':
            fontFamily = "'OpenDyslexic', sans-serif";
            break;
        case 'comic':
            fontFamily = "'Comic Sans MS', 'Comic Sans', cursive";
            break;
        case 'arial':
        default:
            fontFamily = "Arial, Helvetica, sans-serif";
            break;
    }

    // Build main styles - USE USER SETTINGS but with smart targeting
    const styles = `
        /* Apply dyslexia-friendly font to content areas */
        article, main, .content, [role="main"],
        p, li, td, th, blockquote, figcaption,
        h1, h2, h3, h4, h5, h6,
        div:not([class*="nav"]):not([class*="menu"]):not([class*="toolbar"]):not([class*="button"]) {
            font-family: ${fontFamily} !important;
        }
        
        /* Apply user's spacing settings to text content */
        p, li, td, th, blockquote {
            letter-spacing: ${settings.letterSpacing}px !important;
            line-height: ${settings.lineHeight} !important;
            word-spacing: ${settings.wordSpacing}px !important;
        }
        
        /* Headings: Apply user settings but keep them reasonable */
        h1, h2, h3, h4, h5, h6 {
            letter-spacing: ${settings.letterSpacing * 0.5}px !important;
            line-height: ${Math.min(settings.lineHeight, 1.6)} !important;
        }
        
        /* Exclude UI elements - preserve original styling */
        nav, nav *,
        header:not(article header):not(main header), 
        header:not(article header):not(main header) *,
        footer:not(article footer):not(main footer),
        footer:not(article footer):not(main footer) *,
        button, input, select, textarea,
        [role="navigation"], [role="navigation"] *,
        [role="banner"], [role="banner"] *,
        [class*="nav"]:not(article *):not(main *),
        [class*="menu"]:not(article *):not(main *),
        [class*="toolbar"],
        [class*="button"], [class*="btn"],
        [id*="nav"]:not(article *):not(main *),
        [id*="menu"]:not(article *):not(main *) {
            font-family: inherit !important;
            letter-spacing: inherit !important;
            line-height: inherit !important;
            word-spacing: inherit !important;
        }
        
        /* Prevent layout breaks from word wrapping */
        body {
            overflow-wrap: break-word !important;
            word-wrap: break-word !important;
        }
    `;

    injectCSS(styles, 'ir-dyslexia-styles');

    // Apply overlay color if selected
    if (settings.overlayColor && settings.overlayColor !== 'none') {
        const overlayColors = {
            beige: 'rgba(245, 222, 179, 0.3)',
            blue: 'rgba(173, 216, 230, 0.3)',
            green: 'rgba(144, 238, 144, 0.3)',
            yellow: 'rgba(255, 255, 224, 0.3)'
        };

        const overlayStyle = `
            body::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: ${overlayColors[settings.overlayColor]};
                pointer-events: none;
                z-index: 999999;
            }
        `;

        injectCSS(overlayStyle, 'ir-dyslexia-overlay');
    }

    // Syllable highlighting - DISABLED due to Chrome crashes
    // This feature causes performance issues and crashes on large pages
    // TODO: Implement more efficient algorithm if needed
    if (settings.syllableHighlight) {
        console.warn('Syllable highlighting is temporarily disabled due to performance issues');
        // showNotification('Syllable highlighting is temporarily disabled', 'info');
    }
    removeSyllableHighlighting();

    // Apply bionic reading
    if (settings.bionicReading) {
        applyBionicReading();
    } else {
        removeBionicReading();
    }
}

function applySyllableHighlighting() {
    // Simple syllable detection (alternating colors)
    const textNodes = getTextNodes(document.body);

    textNodes.forEach(node => {
        // Skip if already processed or in special elements
        if (node.parentElement?.classList.contains('ir-syllable-word') ||
            node.parentElement?.closest('.ir-jargon, .ir-selection-toolbar, script, style, code, pre')) {
            return;
        }

        const text = node.textContent;
        const words = text.split(/(\s+)/);

        if (words.length > 1) {
            const span = document.createElement('span');
            span.className = 'ir-syllable-word';

            words.forEach((word, index) => {
                const wordSpan = document.createElement('span');
                wordSpan.textContent = word;

                // Alternate colors for syllables (simplified - just alternating words)
                if (!word.trim()) {
                    wordSpan.textContent = word;
                } else if (index % 2 === 0) {
                    wordSpan.style.color = 'inherit';
                } else {
                    wordSpan.style.opacity = '0.7';
                }

                span.appendChild(wordSpan);
            });

            node.replaceWith(span);
        }
    });
}

function removeSyllableHighlighting() {
    document.querySelectorAll('.ir-syllable-word').forEach(el => {
        el.replaceWith(el.textContent);
    });
}

function applyBionicReading() {
    const textNodes = getTextNodes(document.body);

    textNodes.forEach(node => {
        // Skip if already processed or in special elements
        if (node.parentElement?.classList.contains('ir-bionic-word') ||
            node.parentElement?.closest('.ir-jargon, .ir-selection-toolbar, script, style, code, pre')) {
            return;
        }

        const text = node.textContent;
        const words = text.split(/(\s+)/);

        if (words.length > 1) {
            const span = document.createElement('span');
            span.className = 'ir-bionic-word';

            words.forEach(word => {
                if (!word.trim()) {
                    span.appendChild(document.createTextNode(word));
                } else {
                    const wordSpan = document.createElement('span');
                    const halfLength = Math.ceil(word.length / 2);

                    const boldPart = document.createElement('strong');
                    boldPart.textContent = word.substring(0, halfLength);
                    boldPart.style.fontWeight = '700';

                    wordSpan.appendChild(boldPart);
                    wordSpan.appendChild(document.createTextNode(word.substring(halfLength)));

                    span.appendChild(wordSpan);
                }
            });

            node.replaceWith(span);
        }
    });
}

function removeBionicReading() {
    document.querySelectorAll('.ir-bionic-word').forEach(el => {
        el.replaceWith(el.textContent);
    });
}

// Helper: Get all text nodes in an element
function getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Skip empty text and whitespace-only nodes
                if (!node.textContent.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip script, style, and other non-content elements
                const parent = node.parentElement;
                if (parent?.closest('script, style, noscript, iframe, object, embed')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let node;
    while (node = walker.nextNode()) {
        // Only process text nodes in visible elements with substantial text
        if (node.textContent.trim().length > 2) {
            textNodes.push(node);
        }
    }

    return textNodes;
}

/**
 * FEATURE 4: Text-to-Speech with Visual Tracking
 * Read aloud with word-by-word highlighting and adjustable speed
 */

let ttsEngine = null;

function activateTTSMode(settings) {
    state.ttsSettings = settings;
    initTTSEngine();
    createTTSControls();
    showNotification('Text-to-Speech activated', 'success');
}

function deactivateTTSMode() {
    stopTTS();
    removeTTSControls();
    state.ttsEnabled = false;
    showNotification('Text-to-Speech disabled', 'info');
}

function updateTTSSettings(settings) {
    state.ttsSettings = settings;
    if (state.ttsState.isPlaying && !state.ttsState.isPaused) {
        // Restart with new settings
        const wasPlaying = state.ttsState.isPlaying;
        stopTTS();
        if (wasPlaying) {
            setTimeout(() => playTTS(), 100);
        }
    }
}

function createTTSControls() {
    // Remove existing controls if any
    removeTTSControls();

    const controlPanel = document.createElement('div');
    controlPanel.id = 'ir-tts-controls';
    controlPanel.className = 'ir-tts-controls';
    controlPanel.innerHTML = `
        <div class="ir-tts-control-header">
            <span class="ir-tts-title">Text-to-Speech</span>
            <button class="ir-tts-close" id="ir-tts-close">×</button>
        </div>
        <div class="ir-tts-buttons">
            <button class="ir-tts-btn" id="ir-tts-play" title="Read Page">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
            </button>
            <button class="ir-tts-btn" id="ir-tts-selection" title="Read Selection">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
            </button>
            <button class="ir-tts-btn" id="ir-tts-pause" title="Pause">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                </svg>
            </button>
            <button class="ir-tts-btn" id="ir-tts-stop" title="Stop">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                </svg>
            </button>
        </div>
    `;

    document.body.appendChild(controlPanel);

    // Add event listeners
    document.getElementById('ir-tts-play').addEventListener('click', playTTS);
    document.getElementById('ir-tts-selection').addEventListener('click', playTTSSelection);
    document.getElementById('ir-tts-pause').addEventListener('click', pauseTTS);
    document.getElementById('ir-tts-stop').addEventListener('click', stopTTS);
    document.getElementById('ir-tts-close').addEventListener('click', () => {
        stopTTS();
        removeTTSControls();
    });

    injectTTSControlStyles();
}

function removeTTSControls() {
    const controls = document.getElementById('ir-tts-controls');
    if (controls) {
        controls.remove();
    }
}

function injectTTSControlStyles() {
    const styles = `
        .ir-tts-controls {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 16px;
            z-index: 10000000;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(10px);
            min-width: 220px;
        }
        
        .ir-tts-control-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .ir-tts-title {
            color: #fff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 13px;
            font-weight: 600;
        }
        
        .ir-tts-close {
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.6);
            font-size: 24px;
            line-height: 1;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s;
        }
        
        .ir-tts-close:hover {
            color: #fff;
        }
        
        .ir-tts-buttons {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            justify-content: center;
        }
        
        .ir-tts-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 10px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 44px;
        }
        
        .ir-tts-btn svg {
            width: 20px;
            height: 20px;
            color: #fff;
        }
        
        .ir-tts-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.4);
            transform: translateY(-2px);
        }
        
        .ir-tts-btn:active {
            transform: translateY(0);
        }
        
        .ir-tts-indicator {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: #fff;
            padding: 24px 48px;
            border-radius: 16px;
            font-size: 32px;
            font-weight: 600;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            z-index: 10000001;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
            border: 2px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            display: none;
            align-items: center;
            justify-content: center;
            min-width: 300px;
            text-align: center;
            animation: ir-tts-word-pulse 0.3s ease-out;
        }
        
        @keyframes ir-tts-word-pulse {
            0% {
                transform: translate(-50%, -50%) scale(0.9);
                opacity: 0;
            }
            100% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
        }
    `;

    injectCSS(styles, 'ir-tts-control-styles');
}

function initTTSEngine() {
    if (!window.speechSynthesis) {
        showNotification('Text-to-Speech not supported in this browser', 'error');
        return;
    }
    ttsEngine = window.speechSynthesis;

    // Load voices (some browsers need this)
    if (ttsEngine.getVoices().length === 0) {
        ttsEngine.addEventListener('voiceschanged', () => {
            console.log('TTS voices loaded:', ttsEngine.getVoices().length);
        }, { once: true });
    }
}

function playTTS() {
    if (!state.ttsEnabled || !ttsEngine) {
        showNotification('Please enable Text-to-Speech first', 'error');
        return;
    }

    // If paused, resume
    if (state.ttsState.isPaused) {
        ttsEngine.resume();
        state.ttsState.isPaused = false;
        showNotification('Resuming...', 'info');
        return;
    }

    // If already playing, do nothing
    if (state.ttsState.isPlaying) {
        return;
    }

    // Cancel any existing speech
    ttsEngine.cancel();

    // Extract main content text
    const content = extractReadableContent();

    if (!content || content.length < 10) {
        showNotification('No readable content found on this page', 'error');
        return;
    }

    // Limit text length to avoid errors (max ~32KB)
    const maxLength = 32000;
    let textToRead = content.substring(0, maxLength);

    if (state.ttsSettings.pauseOnPunctuation) {
        // Add slight pauses after punctuation
        textToRead = textToRead
            .replace(/\./g, '. ')
            .replace(/,/g, ', ')
            .replace(/;/g, '; ')
            .replace(/:/g, ': ')
            .replace(/\?/g, '? ')
            .replace(/!/g, '! ');
    }

    state.ttsState.textContent = textToRead;
    state.ttsState.words = textToRead.split(/\s+/).filter(w => w.trim().length > 0);
    state.ttsState.currentWordIndex = 0;

    const utterance = new SpeechSynthesisUtterance(textToRead);

    // Ensure valid rate (0.1 to 10)
    utterance.rate = Math.max(0.1, Math.min(10, state.ttsSettings.speed || 1));
    utterance.pitch = 1;
    utterance.volume = 1;

    // Set language
    utterance.lang = 'en-US';

    // Get available voices and select the best quality voice
    const voices = ttsEngine.getVoices();
    if (voices.length > 0) {
        // Filter for English voices
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));

        let selectedVoice = null;

        // Priority 1: Try to find a high-quality neural/natural voice (Google, Microsoft, etc.)
        // These are usually marked with keywords like "Neural", "Natural", "Premium", "Enhanced"
        const premiumVoice = englishVoices.find(voice =>
            voice.name.toLowerCase().includes('neural') ||
            voice.name.toLowerCase().includes('natural') ||
            voice.name.toLowerCase().includes('premium') ||
            voice.name.toLowerCase().includes('enhanced') ||
            voice.name.toLowerCase().includes('studio') ||
            (voice.name.includes('Google') && voice.lang === 'en-US')
        );

        if (premiumVoice) {
            selectedVoice = premiumVoice;
        } else {
            // Priority 2: Try to find any en-US voice (best match for language)
            const enUSVoice = englishVoices.find(voice => voice.lang === 'en-US');

            if (enUSVoice) {
                selectedVoice = enUSVoice;
            } else {
                // Priority 3: Use any English voice, or first available voice
                selectedVoice = englishVoices[0] || voices[0];
            }
        }

        utterance.voice = selectedVoice;
        console.log('TTS: Using voice:', selectedVoice.name, selectedVoice.lang);
    }

    // Word boundary event for highlighting
    if (state.ttsSettings.wordHighlight) {
        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                highlightCurrentWord(event.charIndex);
            }
        };
    }

    utterance.onstart = () => {
        state.ttsState.isPlaying = true;
        state.ttsState.isPaused = false;
        showNotification('Reading started...', 'info');
    };

    utterance.onend = () => {
        state.ttsState.isPlaying = false;
        state.ttsState.isPaused = false;
        state.ttsState.currentUtterance = null;
        clearTTSHighlight();
        showNotification('Reading complete', 'success');
    };

    utterance.onerror = (event) => {
        console.error('TTS Error:', event.error, event);
        state.ttsState.isPlaying = false;
        state.ttsState.isPaused = false;
        state.ttsState.currentUtterance = null;
        clearTTSHighlight();

        // Show user-friendly error message
        let errorMsg = 'Speech synthesis error';
        if (event.error === 'canceled') {
            errorMsg = 'Speech was stopped';
        } else if (event.error === 'interrupted') {
            errorMsg = 'Speech was interrupted';
        } else if (event.error === 'audio-busy') {
            errorMsg = 'Audio is busy, try again';
        } else if (event.error === 'not-allowed') {
            errorMsg = 'Speech not allowed - check browser permissions';
        }
        showNotification(errorMsg, 'error');
    };

    // Store utterance reference
    state.ttsState.currentUtterance = utterance;

    // Speak with a small delay to ensure everything is ready
    setTimeout(() => {
        if (state.ttsState.currentUtterance === utterance) {
            ttsEngine.speak(utterance);
        }
    }, 100);
}

function playTTSSelection() {
    if (!state.ttsEnabled || !ttsEngine) {
        showNotification('Please enable Text-to-Speech first', 'error');
        return;
    }

    // Get selected text
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText || selectedText.length < 3) {
        showNotification('Please select some text first', 'error');
        return;
    }

    // If already playing, stop first
    if (state.ttsState.isPlaying) {
        stopTTS();
    }

    // Cancel any existing speech
    ttsEngine.cancel();

    // Prepare text
    let textToRead = selectedText;

    if (state.ttsSettings.pauseOnPunctuation) {
        textToRead = textToRead
            .replace(/\./g, '. ')
            .replace(/,/g, ', ')
            .replace(/;/g, '; ')
            .replace(/:/g, ': ')
            .replace(/\?/g, '? ')
            .replace(/!/g, '! ');
    }

    state.ttsState.textContent = textToRead;
    state.ttsState.words = textToRead.split(/\s+/).filter(w => w.trim().length > 0);
    state.ttsState.currentWordIndex = 0;

    const utterance = new SpeechSynthesisUtterance(textToRead);

    // Ensure valid rate (0.1 to 10)
    utterance.rate = Math.max(0.1, Math.min(10, state.ttsSettings.speed || 1));
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = 'en-US';

    // Get available voices and set a voice
    const voices = ttsEngine.getVoices();
    if (voices.length > 0) {
        const englishVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];
        utterance.voice = englishVoice;
    }

    // Word boundary event for highlighting
    if (state.ttsSettings.wordHighlight) {
        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                highlightCurrentWord(event.charIndex);
            }
        };
    }

    utterance.onstart = () => {
        state.ttsState.isPlaying = true;
        state.ttsState.isPaused = false;
        showNotification('Reading selection...', 'info');
    };

    utterance.onend = () => {
        state.ttsState.isPlaying = false;
        state.ttsState.isPaused = false;
        state.ttsState.currentUtterance = null;
        clearTTSHighlight();
        showNotification('Reading complete', 'success');
    };

    utterance.onerror = (event) => {
        console.error('TTS Error:', event.error, event);
        state.ttsState.isPlaying = false;
        state.ttsState.isPaused = false;
        state.ttsState.currentUtterance = null;
        clearTTSHighlight();

        let errorMsg = 'Speech synthesis error';
        if (event.error === 'canceled') {
            errorMsg = 'Speech was stopped';
        } else if (event.error === 'interrupted') {
            errorMsg = 'Speech was interrupted';
        } else if (event.error === 'audio-busy') {
            errorMsg = 'Audio is busy, try again';
        } else if (event.error === 'not-allowed') {
            errorMsg = 'Speech not allowed - check browser permissions';
        }
        showNotification(errorMsg, 'error');
    };

    // Store utterance reference
    state.ttsState.currentUtterance = utterance;

    // Speak with a small delay
    setTimeout(() => {
        if (state.ttsState.currentUtterance === utterance) {
            ttsEngine.speak(utterance);
        }
    }, 100);
}

function pauseTTS() {
    if (!state.ttsState.isPlaying || state.ttsState.isPaused) {
        return;
    }

    if (ttsEngine) {
        ttsEngine.pause();
        state.ttsState.isPaused = true;
        showNotification('Paused', 'info');
    }
}

function stopTTS() {
    if (ttsEngine) {
        try {
            ttsEngine.cancel();
        } catch (error) {
            console.error('Error canceling TTS:', error);
        }
    }

    state.ttsState.isPlaying = false;
    state.ttsState.isPaused = false;
    state.ttsState.currentUtterance = null;
    state.ttsState.currentWordIndex = 0;
    state.ttsState.words = [];
    state.ttsState.textContent = '';

    clearTTSHighlight();
    showNotification('Speech stopped', 'info');
}

function extractReadableContent() {
    // Try to find main content area
    const selectors = [
        'article',
        'main',
        '[role="main"]',
        '.main-content',
        '#content',
        '.content',
        '.post-content',
        '.article-content'
    ];

    let contentElement = null;
    for (const selector of selectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
    }

    // Fall back to body if no main content found
    if (!contentElement) {
        contentElement = document.body;
    }

    // Extract text from paragraphs and headings
    const textElements = contentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    let text = '';

    textElements.forEach(el => {
        // Skip hidden elements
        if (el.offsetParent === null) return;

        const elementText = el.textContent.trim();
        if (elementText.length > 0) {
            text += elementText + ' ';
        }
    });

    return text.trim();
}

function highlightCurrentWord(charIndex) {
    // Find the word at this character index
    let currentIndex = 0;
    let wordIndex = 0;
    const words = state.ttsState.words;

    for (let i = 0; i < words.length; i++) {
        if (charIndex >= currentIndex && charIndex < currentIndex + words[i].length) {
            wordIndex = i;
            break;
        }
        currentIndex += words[i].length + 1; // +1 for space
    }

    state.ttsState.currentWordIndex = wordIndex;

    // Visual highlighting (simplified - highlights entire viewport)
    clearTTSHighlight();

    // Create a floating highlight indicator
    let indicator = document.getElementById('ir-tts-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'ir-tts-indicator';
        indicator.className = 'ir-tts-indicator';
        document.body.appendChild(indicator);
    }

    const currentWord = words[wordIndex];
    indicator.textContent = currentWord;
    indicator.style.display = 'flex';
}

function clearTTSHighlight() {
    const indicator = document.getElementById('ir-tts-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

/**
 * Progress Loader UI - Animated "Generating" Sphere
 */
function showProgressLoader(text = 'Processing...', feature = 'jargon') {
    // Remove existing loader if any
    hideProgressLoader();

    const overlay = document.createElement('div');
    overlay.className = 'ir-progress-overlay';
    overlay.innerHTML = `
        <div class="loader-wrapper">
            <span class="loader-letter">G</span>
            <span class="loader-letter">e</span>
            <span class="loader-letter">n</span>
            <span class="loader-letter">e</span>
            <span class="loader-letter">r</span>
            <span class="loader-letter">a</span>
            <span class="loader-letter">t</span>
            <span class="loader-letter">i</span>
            <span class="loader-letter">n</span>
            <span class="loader-letter">g</span>
            <div class="loader"></div>
        </div>
    `;

    const styles = `
        .ir-progress-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 28px;
            z-index: 10000000;
            animation: ir-overlay-in 0.4s ease-out;
        }
        
        @keyframes ir-overlay-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .loader-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 180px;
            height: 180px;
            font-family: "Inter", sans-serif;
            font-size: 1.2em;
            font-weight: 300;
            color: white;
            border-radius: 50%;
            background-color: transparent;
            user-select: none;
        }
        
        .loader {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            aspect-ratio: 1 / 1;
            border-radius: 50%;
            background-color: transparent;
            animation: loader-rotate 2s linear infinite;
            z-index: 0;
        }
        
        @keyframes loader-rotate {
            0% {
                transform: rotate(90deg);
                box-shadow:
                    0 10px 20px 0 #fff inset,
                    0 20px 30px 0 #ad5fff inset,
                    0 60px 60px 0 #471eec inset;
            }
            50% {
                transform: rotate(270deg);
                box-shadow:
                    0 10px 20px 0 #fff inset,
                    0 20px 10px 0 #d60a47 inset,
                    0 40px 60px 0 #311e80 inset;
            }
            100% {
                transform: rotate(450deg);
                box-shadow:
                    0 10px 20px 0 #fff inset,
                    0 20px 30px 0 #ad5fff inset,
                    0 60px 60px 0 #471eec inset;
            }
        }
        
        .loader-letter {
            display: inline-block;
            opacity: 0.4;
            transform: translateY(0);
            animation: loader-letter-anim 2s infinite;
            z-index: 1;
            border-radius: 50ch;
            border: none;
        }
        
        .loader-letter:nth-child(1) { animation-delay: 0s; }
        .loader-letter:nth-child(2) { animation-delay: 0.1s; }
        .loader-letter:nth-child(3) { animation-delay: 0.2s; }
        .loader-letter:nth-child(4) { animation-delay: 0.3s; }
        .loader-letter:nth-child(5) { animation-delay: 0.4s; }
        .loader-letter:nth-child(6) { animation-delay: 0.5s; }
        .loader-letter:nth-child(7) { animation-delay: 0.6s; }
        .loader-letter:nth-child(8) { animation-delay: 0.7s; }
        .loader-letter:nth-child(9) { animation-delay: 0.8s; }
        .loader-letter:nth-child(10) { animation-delay: 0.9s; }
        
        @keyframes loader-letter-anim {
            0%, 100% {
                opacity: 0.4;
                transform: translateY(0);
            }
            20% {
                opacity: 1;
                transform: scale(1.15);
            }
            40% {
                opacity: 0.7;
                transform: translateY(0);
            }
        }
        
        .ir-loader-status {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.5);
            letter-spacing: 0.3px;
            text-align: center;
        }
    `;

    injectCSS(styles, 'ir-progress-styles');
    document.body.appendChild(overlay);
}

function updateProgress(percentage) {
    // Progress bar removed - keeping function for compatibility
}

function updateProgressText(text) {
    // Status text removed - keeping function for compatibility
}

function hideProgressLoader() {
    const overlay = document.querySelector('.ir-progress-overlay');
    if (overlay) {
        overlay.style.animation = 'ir-overlay-out 0.3s ease-out forwards';
        const outStyles = `
            @keyframes ir-overlay-out {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        injectCSS(outStyles, 'ir-progress-out-styles');
        setTimeout(() => {
            overlay.remove();
            removeCSS('ir-progress-styles');
            removeCSS('ir-progress-out-styles');
        }, 300);
    }
}

/**
 * Notification Toast
 */
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.ir-notification');
    if (existing) existing.remove();

    const icons = {
        success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const colors = {
        success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' },
        error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' },
        info: { bg: 'rgba(250, 250, 250, 0.1)', border: 'rgba(250, 250, 250, 0.2)', text: '#fafafa' }
    };

    const color = colors[type] || colors.info;

    const notification = document.createElement('div');
    notification.className = 'ir-notification';
    notification.innerHTML = `
        <div class="ir-notification-icon">${icons[type] || icons.info}</div>
        <span class="ir-notification-text">${message}</span>
    `;

    const styles = `
        .ir-notification {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #111111;
            border: 1px solid ${color.border};
            border-radius: 12px;
            padding: 14px 18px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 10000001;
            animation: ir-notif-in 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            max-width: 360px;
        }
        
        @keyframes ir-notif-in {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .ir-notification-icon {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        }
        
        .ir-notification-icon svg {
            width: 100%;
            height: 100%;
            color: ${color.text};
        }
        
        .ir-notification-text {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 13px;
            font-weight: 500;
            color: ${color.text};
            letter-spacing: -0.2px;
        }
    `;

    injectCSS(styles, 'ir-notification-styles');
    document.body.appendChild(notification);

    // Auto-hide after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'ir-notif-out 0.3s ease-out forwards';
        const outStyles = `
            @keyframes ir-notif-out {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(10px); }
            }
        `;
        injectCSS(outStyles, 'ir-notification-out-styles');
        setTimeout(() => {
            notification.remove();
            removeCSS('ir-notification-styles');
            removeCSS('ir-notification-out-styles');
        }, 300);
    }, 3000);
}

/**
 * CSS Injection Helpers
 */
function injectCSS(css, id) {
    // Remove existing style with same ID
    removeCSS(id);

    const style = document.createElement('style');
    style.id = `ir-style-${id}`;
    style.textContent = css;
    document.head.appendChild(style);
}

function removeCSS(id) {
    const existingStyle = document.getElementById(`ir-style-${id}`);
    if (existingStyle) {
        existingStyle.remove();
    }
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Utility: Detect animations
 */
function detectAnimations() {
    const animated = [];
    document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.animationName !== 'none' || style.transition !== 'none') {
            animated.push(el);
        }
    });
    return animated;
}

/**
 * Utility: Extract readable content for TTS
 */
function extractReadableContent() {
    // Try to find main content area
    const mainSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.main-content',
        '#content',
        '#main',
        '.content'
    ];

    let contentElement = null;
    for (const selector of mainSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
    }

    // Fallback to body if no main content found
    if (!contentElement) {
        contentElement = document.body;
    }

    // Extract text, excluding scripts, styles, and hidden elements
    const textNodes = [];
    const walker = document.createTreeWalker(
        contentElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                // Skip non-content elements
                const tagName = parent.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'iframe', 'object'].includes(tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }

                // Skip hidden elements
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }

                // Skip empty/whitespace-only nodes
                if (!node.textContent.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node.textContent);
    }

    return textNodes.join(' ').replace(/\s+/g, ' ').trim();
}

console.log('InclusiveRead content script loaded');
