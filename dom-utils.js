// DOM Utilities - Helper functions for DOM manipulation

/**
 * Serialize DOM to a simplified structure for AI analysis
 * Removes script tags, styles, and other noise
 */
function serializeDOM() {
    const clone = document.body.cloneNode(true);

    // Remove noise elements
    const selectorsToRemove = [
        'script',
        'style',
        'iframe',
        'noscript',
        '[aria-hidden="true"]',
        '.ad',
        '.advertisement',
        '[class*="cookie"]',
        '[class*="banner"]'
    ];

    selectorsToRemove.forEach(selector => {
        clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Extract meaningful structure
    const structure = extractStructure(clone);
    return structure;
}

/**
 * Extract meaningful structure from DOM
 */
function extractStructure(element) {
    const items = [];
    const important = ['button', 'a', 'input', 'select', 'textarea', 'h1', 'h2', 'h3', 'form'];

    function traverse(el, depth = 0) {
        if (depth > 10) return; // Limit depth

        const tag = el.tagName?.toLowerCase();
        if (!tag) return;

        // Extract important elements
        if (important.includes(tag)) {
            const text = el.textContent?.trim().slice(0, 200) || '';
            const id = el.id || '';
            const classes = Array.from(el.classList).join(' ');
            const type = el.type || '';
            const href = el.href || '';

            if (text || id || type) {
                items.push({
                    tag,
                    text,
                    id,
                    classes,
                    type,
                    href,
                    visible: isVisible(el),
                    xpath: getXPath(el)
                });
            }
        }

        // Recurse
        Array.from(el.children).forEach(child => traverse(child, depth + 1));
    }

    traverse(element);
    return items;
}

/**
 * Check if element is visible
 */
function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;

    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        el.offsetWidth > 0 &&
        el.offsetHeight > 0;
}

/**
 * Get XPath for an element
 */
function getXPath(element) {
    if (!element) {
        return '';
    }

    if (element.id) {
        return `//*[@id="${element.id}"]`;
    }

    if (element === document.body) {
        return '/html/body';
    }

    // Check for parentNode before recursion
    if (!element.parentNode) {
        return element.tagName ? '/' + element.tagName.toLowerCase() : '';
    }

    let ix = 0;
    const siblings = element.parentNode.childNodes || [];

    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === element) {
            return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }

    return '';
}

/**
 * Get element by XPath
 */
function getElementByXPath(xpath) {
    return document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    ).singleNodeValue;
}

/**
 * Find all text nodes containing specific text
 */
function findTextNodes(searchText, rootElement = document.body) {
    const matches = [];
    const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (node.textContent?.toLowerCase().includes(searchText.toLowerCase())) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        }
    );

    let node;
    while (node = walker.nextNode()) {
        matches.push(node);
    }

    return matches;
}

/**
 * Detect animated elements
 */
function detectAnimations() {
    const animated = [];
    const allElements = document.querySelectorAll('*');

    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const hasAnimation = style.animationName !== 'none' && style.animationName !== '';
        const hasTransition = style.transition !== 'all 0s ease 0s' && style.transition !== '';

        // Check for problematic animations (fast, flashing)
        if (hasAnimation) {
            const duration = parseFloat(style.animationDuration);
            const iterationCount = style.animationIterationCount;

            if (duration < 2 || iterationCount === 'infinite') {
                animated.push({
                    element: el,
                    type: 'animation',
                    animation: style.animationName,
                    duration
                });
            }
        }

        // Check for auto-playing videos/gifs
        if (el.tagName === 'VIDEO' || el.tagName === 'IFRAME') {
            animated.push({
                element: el,
                type: 'media'
            });
        }
    });

    return animated;
}

/**
 * Inject CSS safely
 */
function injectCSS(css, id = 'inclusiveread-styles') {
    let styleEl = document.getElementById(id);

    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = id;
        document.head.appendChild(styleEl);
    }

    styleEl.textContent = css;
}

/**
 * Remove injected CSS
 */
function removeCSS(id = 'inclusiveread-styles') {
    const styleEl = document.getElementById(id);
    if (styleEl) {
        styleEl.remove();
    }
}

/**
 * Wrap text node with span for replacement
 */
function wrapTextNode(textNode, className = 'ir-jargon') {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = textNode.textContent;
    textNode.parentNode.replaceChild(span, textNode);
    return span;
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        serializeDOM,
        extractStructure,
        isVisible,
        getXPath,
        getElementByXPath,
        findTextNodes,
        detectAnimations,
        injectCSS,
        removeCSS,
        wrapTextNode
    };
}
