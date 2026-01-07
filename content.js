// Content Script - Main page manipulation logic

// State
let state = {
    spotlightEnabled: false,
    jargonEnabled: false,
    sensoryEnabled: false,
    spotlightIntensity: 70,
    apiKey: null,
    primaryElement: null,
    jargonMap: [],
    animatedElements: []
};

// Initialize
init();

async function init() {
    // Load settings
    const settings = await chrome.storage.sync.get([
        'spotlightEnabled',
        'jargonEnabled',
        'sensoryEnabled',
        'spotlightIntensity',
        'apiKey'
    ]);

    Object.assign(state, settings);

    // Apply enabled features
    if (state.spotlightEnabled) {
        await activateSpotlight();
    }

    if (state.jargonEnabled) {
        await activateJargonDecoder();
    }

    if (state.sensoryEnabled) {
        activateSensoryShield();
    }
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

async function handleMessage(request) {
    switch (request.action) {
        case 'toggleSpotlight':
            state.spotlightEnabled = request.enabled;
            if (request.enabled) {
                await activateSpotlight();
            } else {
                deactivateSpotlight();
            }
            break;

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

        case 'updateSpotlightIntensity':
            state.spotlightIntensity = request.value;
            if (state.spotlightEnabled) {
                updateSpotlightEffect();
            }
            break;
    }

    return { success: true };
}

/**
 * FEATURE 1: Action Spotlight
 * Dims non-essential elements and highlights primary action
 */
async function activateSpotlight() {
    // Get API key
    const { apiKey } = await chrome.storage.sync.get('apiKey');
    if (!apiKey) {
        console.warn('InclusiveRead: No API key configured');
        return;
    }

    // Analyze page
    const domStructure = serializeDOM();
    const response = await chrome.runtime.sendMessage({
        action: 'analyzePageIntent',
        domStructure,
        apiKey
    });

    if (!response.success || !response.data) {
        console.warn('InclusiveRead: Could not analyze page');
        return;
    }

    const { primaryElement } = response.data;

    if (primaryElement) {
        state.primaryElement = primaryElement;
        applySpotlightEffect(primaryElement);
    }
}

function applySpotlightEffect(xpath) {
    const element = getElementByXPath(xpath);
    if (!element) {
        console.warn('InclusiveRead: Could not find element at', xpath);
        return;
    }

    // Convert intensity (30-90) to reasonable opacity (0.5-0.9)
    // Higher intensity = darker background
    const dimAmount = state.spotlightIntensity;
    const opacity = 1 - (dimAmount / 200); // Range: 0.55-0.85
    const grayscale = dimAmount / 2; // Range: 15-45%

    const css = `
    /* InclusiveRead Spotlight Effect */
    body * {
      transition: opacity 0.3s ease, filter 0.3s ease !important;
    }
    
    body *:not(.ir-spotlight):not(.ir-spotlight *) {
      opacity: ${opacity} !important;
      filter: grayscale(${grayscale}%) !important;
      pointer-events: auto !important;
    }
    
    .ir-spotlight {
      opacity: 1 !important;
      filter: none !important;
      position: relative !important;
      z-index: 999999 !important;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.5), 
                  0 0 30px rgba(102, 126, 234, 0.3) !important;
      border-radius: 8px !important;
      animation: ir-pulse 2s ease-in-out infinite !important;
    }
    
    @keyframes ir-pulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.5), 0 0 30px rgba(102, 126, 234, 0.3); }
      50% { box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.8), 0 0 40px rgba(102, 126, 234, 0.5); }
    }
    
    /* Tooltip */
    .ir-spotlight::before {
      content: "👆 Start here";
      position: absolute;
      top: -35px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      z-index: 1000000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: ir-float 2s ease-in-out infinite;
    }
    
    @keyframes ir-float {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-5px); }
    }
  `;

    injectCSS(css, 'ir-spotlight-styles');
    element.classList.add('ir-spotlight');

    // Scroll to element
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateSpotlightEffect() {
    if (state.primaryElement) {
        applySpotlightEffect(state.primaryElement);
    }
}

function deactivateSpotlight() {
    removeCSS('ir-spotlight-styles');
    document.querySelectorAll('.ir-spotlight').forEach(el => {
        el.classList.remove('ir-spotlight');
    });
}

/**
 * FEATURE 2: Jargon Decoder
 * Replaces complex terms with simple explanations
 */
async function activateJargonDecoder() {
    // Get API key
    const { apiKey } = await chrome.storage.sync.get('apiKey');
    if (!apiKey) {
        console.warn('InclusiveRead: No API key configured');
        return;
    }

    // Get page text
    const pageText = document.body.innerText;

    // Detect jargon
    const response = await chrome.runtime.sendMessage({
        action: 'detectJargon',
        pageText,
        apiKey
    });

    if (!response.success || !response.data) {
        console.warn('InclusiveRead: Could not detect jargon');
        return;
    }

    state.jargonMap = response.data;
    applyJargonReplacements(response.data);
}

function applyJargonReplacements(jargonList) {
    jargonList.forEach(({ jargon, simple, explanation }) => {
        // Find all text nodes containing jargon
        const regex = new RegExp(`\\b${escapeRegex(jargon)}\\b`, 'gi');

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: node => {
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
            if (!parent || parent.classList.contains('ir-jargon-wrapper')) return;

            const html = textNode.textContent.replace(regex, (match) => {
                return `<span class="ir-jargon" data-simple="${simple}" data-explanation="${explanation}">${match}</span>`;
            });

            const wrapper = document.createElement('span');
            wrapper.className = 'ir-jargon-wrapper';
            wrapper.innerHTML = html;
            textNode.replaceWith(wrapper);
        });
    });

    // Add tooltip CSS
    const css = `
    .ir-jargon {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
      border-bottom: 2px dotted #667eea;
      cursor: help;
      position: relative;
      padding: 2px 0;
      transition: all 0.2s ease;
    }
    
    .ir-jargon:hover {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
    }
    
    .ir-jargon::after {
      content: attr(data-simple) " - " attr(data-explanation);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(-8px);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      white-space: nowrap;
      max-width: 300px;
      white-space: normal;
      z-index: 1000000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .ir-jargon:hover::after {
      opacity: 1;
    }
  `;

    injectCSS(css, 'ir-jargon-styles');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deactivateJargonDecoder() {
    removeCSS('ir-jargon-styles');
    document.querySelectorAll('.ir-jargon-wrapper').forEach(wrapper => {
        wrapper.replaceWith(wrapper.textContent);
    });
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

console.log('InclusiveRead content script loaded');
