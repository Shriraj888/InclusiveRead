// PDF Text Processor - Enhanced Decode & Simplify Features for PDF Viewer
// This file contains the decode and simplify functionality specifically optimized for PDF documents

/**
 * PDF Text Processor State
 */
const pdfTextState = {
    jargonMap: [],
    jargonCache: new Map(),
    isProcessing: false,
    abortController: null,
    currentPage: 1
};

/**
 * ===============================================
 * JARGON DECODER FOR PDF
 * ===============================================
 * Detects and highlights complex terminology in PDF documents
 */

/**
 * Activate Jargon Decoder for PDF
 * @param {string} apiKey - API key for the AI service
 * @param {Object} options - Configuration options
 */
async function activatePDFJargonDecoder(apiKey, options = {}) {
    const {
        currentPage = 1,
        analyzeFullDocument = false,
        onProgress = null,
        onComplete = null,
        onError = null
    } = options;

    pdfTextState.currentPage = currentPage;

    // Show progress
    if (onProgress) onProgress({ stage: 'init', progress: 5 });

    // Create abort controller
    pdfTextState.abortController = new AbortController();
    pdfTextState.isProcessing = true;

    try {
        // Extract text from PDF
        if (onProgress) onProgress({ stage: 'extracting', progress: 15 });
        const pdfText = analyzeFullDocument 
            ? extractFullPDFText() 
            : extractPDFPageText(currentPage);

        if (!pdfText || pdfText.length < 50) {
            throw new Error('Not enough text content to analyze');
        }

        // Check cache
        if (onProgress) onProgress({ stage: 'checking_cache', progress: 25 });
        const cacheKey = hashString(pdfText.slice(0, 1000));
        
        if (pdfTextState.jargonCache.has(cacheKey)) {
            const cachedJargon = pdfTextState.jargonCache.get(cacheKey);
            if (onProgress) onProgress({ stage: 'applying', progress: 80 });
            await applyJargonToPDF(cachedJargon, currentPage);
            if (onProgress) onProgress({ stage: 'complete', progress: 100 });
            if (onComplete) onComplete({ jargonCount: cachedJargon.length, cached: true });
            pdfTextState.isProcessing = false;
            return cachedJargon;
        }

        // Detect jargon using AI
        if (onProgress) onProgress({ stage: 'analyzing', progress: 35 });
        const jargonList = await detectJargonInText(pdfText, apiKey);

        // Check if aborted
        if (pdfTextState.abortController.signal.aborted) {
            pdfTextState.isProcessing = false;
            return null;
        }

        if (!jargonList || jargonList.length === 0) {
            if (onComplete) onComplete({ jargonCount: 0, cached: false });
            pdfTextState.isProcessing = false;
            return [];
        }

        // Cache results
        pdfTextState.jargonCache.set(cacheKey, jargonList);
        pdfTextState.jargonMap = jargonList;

        // Apply jargon highlighting
        if (onProgress) onProgress({ stage: 'applying', progress: 80 });
        await applyJargonToPDF(jargonList, currentPage);

        if (onProgress) onProgress({ stage: 'complete', progress: 100 });
        if (onComplete) onComplete({ jargonCount: jargonList.length, cached: false });

        pdfTextState.isProcessing = false;
        pdfTextState.abortController = null;

        return jargonList;

    } catch (error) {
        console.error('PDF Jargon Decoder error:', error);
        pdfTextState.isProcessing = false;
        pdfTextState.abortController = null;
        if (onError) onError(error);
        throw error;
    }
}

/**
 * Detect jargon in text using AI
 * @param {string} text - Text to analyze
 * @param {string} apiKey - API key
 */
async function detectJargonInText(text, apiKey) {
    const cleanText = text
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s.,;:'"()-]/g, '')
        .trim()
        .slice(0, 4000);

    // Send to background script for AI processing
    const response = await chrome.runtime.sendMessage({
        action: 'detectJargon',
        pageText: cleanText,
        apiKey: apiKey
    });

    if (!response.success || !response.data) {
        return [];
    }

    return response.data;
}

/**
 * Apply jargon highlighting to PDF
 * @param {Array} jargonList - List of jargon terms
 * @param {number} pageNumber - Page number to apply to (null for all pages)
 */
async function applyJargonToPDF(jargonList, pageNumber = null) {
    if (!window.pdfService) {
        console.warn('PDF service not available');
        return;
    }

    const totalTerms = jargonList.length;
    let processed = 0;

    for (const item of jargonList) {
        const { jargon, simple, explanation, category, difficulty } = item;
        const regex = new RegExp(`\\b${escapeRegex(jargon)}\\b`, 'gi');

        // Escape for HTML attributes
        const safeSimple = escapeHtml(simple);
        const safeExplanation = escapeHtml(explanation || '');
        const safeCategory = escapeHtml(category || 'general');

        // Get text spans for the page
        const textSpans = window.pdfService.getPDFTextSpans(pageNumber);

        textSpans.forEach(span => {
            // Skip if already processed for this term
            const dataKey = `jargon_${escapeDataAttr(jargon)}`;
            if (span.dataset[dataKey]) return;

            const text = span.textContent;
            if (!regex.test(text)) return;

            // Reset regex
            regex.lastIndex = 0;

            // Highlight matching terms with subtle visibility
            const html = text.replace(regex, (match) => {
                return `<span class="ir-jargon-term" 
                    data-simple="${safeSimple}" 
                    data-explanation="${safeExplanation}"
                    data-category="${safeCategory}"
                    data-original="${escapeHtml(match)}"
                    data-difficulty="${difficulty}"
                    style="background: rgba(255, 235, 59, 0.4); color: #000; font-weight: 400; padding: 1px 0; border-bottom: 1px solid rgba(234, 179, 8, 0.6); cursor: pointer; transition: all 0.2s;">${match}</span>`;
            });

            span.innerHTML = html;
            span.dataset[dataKey] = 'true';
            span.classList.add('ir-jargon-processed');
            span.style.opacity = '1';

            // Add click handlers
            span.querySelectorAll('.ir-jargon-term').forEach(term => {
                term.addEventListener('click', (e) => showJargonTooltip(e, term));
            });
        });

        processed++;
        // Small delay for visual feedback
        if (processed < totalTerms) {
            await new Promise(r => setTimeout(r, 30));
        }
    }
}

/**
 * Show tooltip for jargon term
 */
function showJargonTooltip(event, termElement) {
    event.stopPropagation();
    
    const simple = termElement.dataset.simple;
    const explanation = termElement.dataset.explanation;
    const category = termElement.dataset.category;
    const original = termElement.dataset.original;

    // Remove existing tooltip
    const existingTooltip = document.getElementById('ir-pdf-jargon-tooltip');
    if (existingTooltip) existingTooltip.remove();

    // Inject tooltip styles if not already present
    injectPDFJargonTooltipStyles();
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'ir-pdf-jargon-tooltip';
    tooltip.className = 'ir-pdf-jargon-tooltip';
    tooltip.innerHTML = `
        <div class="ir-tooltip-header">
            <span class="ir-tooltip-term">${original}</span>
            <span class="ir-tooltip-category">${category}</span>
        </div>
        <div class="ir-tooltip-simple">${simple}</div>
        ${explanation ? `<div class="ir-tooltip-explanation">${explanation}</div>` : ''}
        <button class="ir-tooltip-close">×</button>
    `;

    // Position tooltip
    const rect = termElement.getBoundingClientRect();
    const tooltipWidth = 300;
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    let top = rect.bottom + 8;

    // Keep within viewport
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
    if (top + 150 > window.innerHeight) {
        top = rect.top - 150;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    document.body.appendChild(tooltip);

    // Animate
    requestAnimationFrame(() => {
        tooltip.classList.add('ir-visible');
    });

    // Close button
    tooltip.querySelector('.ir-tooltip-close').addEventListener('click', () => {
        tooltip.classList.remove('ir-visible');
        setTimeout(() => tooltip.remove(), 200);
    });

    // Auto-close on click outside
    const closeOnClickOutside = (e) => {
        if (!tooltip.contains(e.target) && !termElement.contains(e.target)) {
            tooltip.classList.remove('ir-visible');
            setTimeout(() => tooltip.remove(), 200);
            document.removeEventListener('click', closeOnClickOutside);
        }
    };
    setTimeout(() => document.addEventListener('click', closeOnClickOutside), 100);
}

/**
 * Clear all jargon highlighting from PDF
 */
function clearPDFJargonHighlighting(pageNumber = null) {
    if (!window.pdfService) return;

    const textSpans = window.pdfService.getPDFTextSpans(pageNumber);

    textSpans.forEach(span => {
        if (span.classList.contains('ir-jargon-processed')) {
            // Restore original text
            const text = span.textContent;
            span.innerHTML = '';
            span.textContent = text;
            span.classList.remove('ir-jargon-processed');

            // Remove data attributes
            Object.keys(span.dataset).forEach(key => {
                if (key.startsWith('jargon_')) {
                    delete span.dataset[key];
                }
            });
        }
    });

    // Remove tooltip if visible
    const tooltip = document.getElementById('ir-pdf-jargon-tooltip');
    if (tooltip) tooltip.remove();
}

/**
 * ===============================================
 * TEXT SIMPLIFIER FOR PDF
 * ===============================================
 * Simplifies selected text into plain English
 */

/**
 * Simplify selected text in PDF
 * @param {string} selectedText - Text to simplify
 * @param {string} apiKey - API key
 * @param {Object} options - Options
 */
async function simplifyPDFSelection(selectedText, apiKey, options = {}) {
    const {
        onProgress = null,
        onComplete = null,
        onError = null
    } = options;

    try {
        if (onProgress) onProgress({ stage: 'init', progress: 10 });

        const cleanText = selectedText
            .replace(/\s+/g, ' ')
            .trim();

        if (cleanText.length < 10) {
            throw new Error('Text too short to simplify');
        }

        if (onProgress) onProgress({ stage: 'simplifying', progress: 40 });

        // Send to background script
        const response = await chrome.runtime.sendMessage({
            action: 'simplifyText',
            text: cleanText,
            apiKey: apiKey
        });

        if (!response.success || !response.data || !response.data.simplified) {
            throw new Error('Failed to simplify text');
        }

        if (onProgress) onProgress({ stage: 'complete', progress: 100 });
        if (onComplete) onComplete(response.data);

        return response.data;

    } catch (error) {
        console.error('PDF Text Simplification error:', error);
        if (onError) onError(error);
        throw error;
    }
}

/**
 * Show simplified text popup in PDF viewer
 * @param {string} originalText - Original text
 * @param {Object} simplifiedData - Simplified data from AI
 * @param {DOMRect|Range} rectOrRange - Position rectangle or selection range
 */
function showPDFSimplifyPopup(originalText, simplifiedData, rectOrRange) {
    // Ensure CSS is injected
    injectPDFSimplifyPopupStyles();
    
    // Remove existing popup
    const existingPopup = document.getElementById('ir-pdf-simplify-popup');
    if (existingPopup) existingPopup.remove();

    // Convert Range to DOMRect if needed
    let rect = rectOrRange;
    if (rectOrRange && typeof rectOrRange.getBoundingClientRect === 'function') {
        rect = rectOrRange.getBoundingClientRect();
    }

    const popup = document.createElement('div');
    popup.id = 'ir-pdf-simplify-popup';
    popup.className = 'ir-simplify-popup';
    popup.innerHTML = `
        <div class="ir-simplify-popup-header ir-draggable-header">
            <span class="ir-simplify-popup-title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Simplified Version
                <span class="ir-drag-hint">⋮⋮</span>
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
            <div class="ir-simplify-text">${escapeHtml(simplifiedData.simplified)}</div>
            <div class="ir-simplify-meta">
                <span class="ir-simplify-level">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    Reading level: ${escapeHtml(simplifiedData.readingLevel)}
                </span>
            </div>
            ${simplifiedData.keyChanges && simplifiedData.keyChanges.length > 0 ? `
                <div class="ir-simplify-changes">
                    <div class="ir-simplify-changes-title">Key simplifications:</div>
                    <ul>
                        ${simplifiedData.keyChanges.map(change => `<li>${escapeHtml(change)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;

    // Position popup
    let left = rect.left + (rect.width / 2) - 180;
    let top = rect.bottom + 15;

    left = Math.max(10, Math.min(left, window.innerWidth - 370));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    document.body.appendChild(popup);

    // Make popup draggable
    makeDraggablePDF(popup, '.ir-simplify-popup-header');

    // Animate
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
            await navigator.clipboard.writeText(simplifiedData.simplified);
            showNotification('Copied to clipboard!', 'success');
        } catch (err) {
            showNotification('Failed to copy', 'error');
        }
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
 * ===============================================
 * UTILITY FUNCTIONS
 * ===============================================
 */

/**
 * Extract text from a specific PDF page
 */
function extractPDFPageText(pageNumber) {
    if (!window.pdfService || !window.pdfService.getPDFTextSpans) {
        return '';
    }

    const spans = window.pdfService.getPDFTextSpans(pageNumber);
    let text = '';
    spans.forEach(span => {
        text += span.textContent + ' ';
    });
    return text.trim();
}

/**
 * Extract all text from PDF
 */
function extractFullPDFText() {
    if (!window.pdfService || !window.pdfService.extractPDFText) {
        return '';
    }
    return window.pdfService.extractPDFText();
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
 * Escape regex special characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Escape string for data attribute
 */
function escapeDataAttr(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

/**
 * Make an element draggable by its header
 * @param {HTMLElement} popup - The popup element to make draggable
 * @param {string} headerSelector - CSS selector for the drag handle (header)
 */
function makeDraggablePDF(popup, headerSelector) {
    const header = popup.querySelector(headerSelector);
    if (!header) return;

    let isDragging = false;
    let startX, startY, initialX, initialY;

    // Add drag cursor to header
    header.style.cursor = 'grab';
    header.style.userSelect = 'none';

    const onMouseDown = (e) => {
        // Don't start drag if clicking on buttons
        if (e.target.closest('button')) return;

        isDragging = true;
        header.style.cursor = 'grabbing';

        // Get current position
        const rect = popup.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        startX = e.clientX;
        startY = e.clientY;

        // Prevent text selection while dragging
        e.preventDefault();

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newX = initialX + deltaX;
        let newY = initialY + deltaY;

        // Keep popup within viewport bounds
        const popupRect = popup.getBoundingClientRect();
        const maxX = window.innerWidth - popupRect.width;
        const maxY = window.innerHeight - popupRect.height;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        // Update position (use fixed positioning for smoother dragging)
        popup.style.position = 'fixed';
        popup.style.left = `${newX}px`;
        popup.style.top = `${newY}px`;
        popup.style.transform = 'none'; // Remove any transform
    };

    const onMouseUp = () => {
        isDragging = false;
        header.style.cursor = 'grab';

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    header.addEventListener('mousedown', onMouseDown);

    // Touch support for mobile
    header.addEventListener('touchstart', (e) => {
        if (e.target.closest('button')) return;

        isDragging = true;
        const touch = e.touches[0];

        const rect = popup.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        startX = touch.clientX;
        startY = touch.clientY;
    }, { passive: true });

    header.addEventListener('touchmove', (e) => {
        if (!isDragging) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        let newX = initialX + deltaX;
        let newY = initialY + deltaY;

        const popupRect = popup.getBoundingClientRect();
        const maxX = window.innerWidth - popupRect.width;
        const maxY = window.innerHeight - popupRect.height;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        popup.style.position = 'fixed';
        popup.style.left = `${newX}px`;
        popup.style.top = `${newY}px`;
        popup.style.transform = 'none';
    }, { passive: true });

    header.addEventListener('touchend', () => {
        isDragging = false;
    });
}

/**
 * Inject CSS for the jargon tooltip
 */
function injectPDFJargonTooltipStyles() {
    // Check if already injected
    if (document.getElementById('ir-pdf-jargon-tooltip-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ir-pdf-jargon-tooltip-styles';
    style.textContent = `
        .ir-pdf-jargon-tooltip {
            position: fixed;
            width: 300px;
            background: #1a1a1a;
            border: 2px solid #0a702f;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(34, 197, 94, 0.3);
            z-index: 10000002;
            overflow: hidden;
            opacity: 0;
            transform: translateY(-5px);
            transition: opacity 0.2s, transform 0.2s;
        }
        
        .ir-pdf-jargon-tooltip.ir-visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        .ir-tooltip-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            background: linear-gradient(135deg, #166534 0%, #15803d 100%);
            border-bottom: 1px solid rgba(34, 197, 94, 0.3);
        }
        
        .ir-tooltip-term {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 15px;
            font-weight: 700;
            color: #fff;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        .ir-tooltip-category {
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.7);
            background: rgba(0, 0, 0, 0.3);
            padding: 3px 8px;
            border-radius: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .ir-tooltip-simple {
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 600;
            line-height: 1.6;
            color: #22c55e;
            padding: 14px;
            background: rgba(34, 197, 94, 0.05);
            border-bottom: 1px solid rgba(34, 197, 94, 0.1);
        }
        
        .ir-tooltip-explanation {
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            line-height: 1.6;
            color: #d4d4d4;
            padding: 12px 14px;
        }
        
        .ir-tooltip-close {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: #fff;
            font-size: 20px;
            font-weight: 400;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .ir-tooltip-close:hover {
            background: rgba(220, 38, 38, 0.8);
            border-color: rgba(220, 38, 38, 0.9);
            transform: scale(1.05);
        }
        
        .ir-jargon-term:hover {
            background: rgba(255, 235, 59, 1) !important;
            border-bottom-color: rgba(234, 179, 8, 1) !important;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * Inject CSS for the simplify popup
 */
function injectPDFSimplifyPopupStyles() {
    // Check if already injected
    if (document.getElementById('ir-pdf-simplify-popup-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ir-pdf-simplify-popup-styles';
    style.textContent = `
        .ir-simplify-popup {
            position: fixed;
            width: 360px;
            background: #0a0a0a;
            border: 1px solid #262626;
            border-radius: 14px;
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
            z-index: 10000001;
            overflow: hidden;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
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
            cursor: grab;
            user-select: none;
        }
        
        .ir-simplify-popup-header:active {
            cursor: grabbing;
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
            drag-hint {
            font-size: 12px;
            color: #444;
            margin-left: 6px;
            letter-spacing: 2px;
            opacity: 0.6;
            transition: opacity 0.2s;
        }
        
        .ir-simplify-popup-header:hover .ir-drag-hint {
            opacity: 1;
            color: #666;
        }
        
        .ir-height: 18px;
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
    
    document.head.appendChild(style);
}

/**
 * Show notification (placeholder - implement your own)
 */
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // TODO: Implement actual notification UI
}

/**
 * Stop current processing
 */
function stopPDFProcessing() {
    if (pdfTextState.abortController) {
        pdfTextState.abortController.abort();
    }
    pdfTextState.isProcessing = false;
    pdfTextState.abortController = null;
}

/**
 * Get current processing state
 */
function getPDFProcessingState() {
    return {
        isProcessing: pdfTextState.isProcessing,
        jargonCount: pdfTextState.jargonMap.length,
        currentPage: pdfTextState.currentPage
    };
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.pdfTextProcessor = {
        activatePDFJargonDecoder,
        clearPDFJargonHighlighting,
        simplifyPDFSelection,
        showPDFSimplifyPopup,
        stopPDFProcessing,
        getPDFProcessingState,
        extractPDFPageText,
        extractFullPDFText
    };
    
    // Export showPDFSimplifyPopup as the showSimplifiedTextPopup for PDF mode
    // This ensures it's used instead of the content.js version
    window.showSimplifiedTextPopup = showPDFSimplifyPopup;
}
