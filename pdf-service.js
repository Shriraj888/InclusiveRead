// PDF Service - Handles PDF detection, loading, and text extraction for InclusiveRead

/**
 * PDF State management
 */
const pdfState = {
    isPDF: false,
    pdfDocument: null,
    pdfPages: [],
    textContent: [],
    currentScale: 1.5,
    containerElement: null,
    isRendering: false,
    pdfjsLib: null
};

/**
 * Check if current page is a PDF
 */
function isPDFDocument() {
    const url = window.location.href.toLowerCase();
    
    // Check URL extension
    if (url.endsWith('.pdf')) {
        return true;
    }
    
    // Check if viewing PDF in browser's built-in viewer
    if (document.contentType === 'application/pdf') {
        return true;
    }
    
    // Check for Chrome PDF viewer
    if (document.querySelector('embed[type="application/pdf"]')) {
        return true;
    }
    
    // Check for Firefox PDF.js viewer
    if (document.getElementById('viewer') && document.querySelector('.page[data-page-number]')) {
        return true;
    }
    
    return false;
}

/**
 * Check if we're in Chrome's built-in PDF viewer (which blocks content scripts)
 */
function isChromePDFViewer() {
    return document.contentType === 'application/pdf' || 
           document.querySelector('embed[type="application/pdf"]') !== null;
}

/**
 * Dynamically load PDF.js library
 */
async function loadPDFJS() {
    if (pdfState.pdfjsLib) {
        return pdfState.pdfjsLib;
    }
    
    return new Promise((resolve, reject) => {
        // Create a script element to load PDF.js
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('lib/pdf.mjs');
        script.type = 'module';
        
        // We need to use a different approach since ES modules have scope issues
        // Instead, we'll use the legacy build or inline the necessary code
        
        // For now, let's try dynamic import
        import(chrome.runtime.getURL('lib/pdf.mjs'))
            .then(pdfjsModule => {
                pdfState.pdfjsLib = pdfjsModule;
                // Set worker source
                pdfState.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.mjs');
                console.log('InclusiveRead: PDF.js loaded successfully');
                resolve(pdfState.pdfjsLib);
            })
            .catch(error => {
                console.error('InclusiveRead: Failed to load PDF.js:', error);
                reject(error);
            });
    });
}

/**
 * Initialize PDF.js library
 */
async function initPDFJS() {
    try {
        await loadPDFJS();
        return true;
    } catch (error) {
        console.error('InclusiveRead: Failed to initialize PDF.js:', error);
        return false;
    }
}

/**
 * Load and render PDF document
 * @param {string} url - URL of the PDF to load
 */
async function loadPDFDocument(url) {
    try {
        await initPDFJS();
        
        if (!pdfState.pdfjsLib) {
            throw new Error('PDF.js library not loaded');
        }
        
        const loadingTask = pdfState.pdfjsLib.getDocument(url);
        pdfState.pdfDocument = await loadingTask.promise;
        pdfState.isPDF = true;
        
        console.log(`InclusiveRead: PDF loaded with ${pdfState.pdfDocument.numPages} pages`);
        
        return pdfState.pdfDocument;
    } catch (error) {
        console.error('InclusiveRead: Failed to load PDF:', error);
        throw error;
    }
}

/**
 * Create the PDF viewer container that replaces the default viewer
 */
function createPDFViewerContainer() {
    // Clear existing content
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin: 0; padding: 0; background: #525659; overflow: auto;';
    
    // Create main container
    const container = document.createElement('div');
    container.id = 'ir-pdf-container';
    container.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        min-height: 100vh;
        box-sizing: border-box;
    `;
    
    document.body.appendChild(container);
    pdfState.containerElement = container;
    
    // Inject PDF viewer styles
    injectPDFStyles();
    
    return container;
}

/**
 * Render a single PDF page with text layer
 * @param {number} pageNum - Page number to render (1-indexed)
 */
async function renderPDFPage(pageNum) {
    const page = await pdfState.pdfDocument.getPage(pageNum);
    const scale = pdfState.currentScale;
    const viewport = page.getViewport({ scale });
    
    // Create page container
    const pageContainer = document.createElement('div');
    pageContainer.className = 'ir-pdf-page';
    pageContainer.dataset.pageNumber = pageNum;
    pageContainer.style.cssText = `
        position: relative;
        margin-bottom: 20px;
        background: white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.className = 'ir-pdf-canvas';
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.style.cssText = 'display: block;';
    
    // Create text layer container
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'ir-pdf-text-layer';
    textLayerDiv.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
        opacity: 1;
        line-height: 1.0;
        pointer-events: none;
        background: transparent;
    `;
    
    pageContainer.appendChild(canvas);
    pageContainer.appendChild(textLayerDiv);
    pdfState.containerElement.appendChild(pageContainer);
    
    // Render the page to canvas
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Get text content and render text layer
    const textContent = await page.getTextContent();
    pdfState.textContent[pageNum - 1] = textContent;
    
    await renderTextLayer(textLayerDiv, textContent, viewport);
    
    // Store page reference
    pdfState.pdfPages[pageNum - 1] = {
        page,
        viewport,
        canvas,
        textLayerDiv,
        textContent
    };
    
    return pageContainer;
}

/**
 * Render text layer with selectable, stylable text spans
 */
async function renderTextLayer(container, textContent, viewport) {
    const textItems = textContent.items;
    
    for (const item of textItems) {
        if (!item.str || item.str.trim() === '') continue;
        
        const tx = pdfState.pdfjsLib.Util.transform(
            viewport.transform,
            item.transform
        );
        
        const span = document.createElement('span');
        span.className = 'ir-pdf-text-span';
        span.textContent = item.str;
        span.dataset.irText = 'true';
        
        // Calculate position and size - slightly reduce font for better matching
        const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
        const fontAscent = fontHeight;
        
        // Try to extract font family from PDF
        let fontFamily = 'sans-serif';
        let fontWeight = 'normal';
        let fontStyle = 'normal';
        
        if (item.fontName) {
            // Clean up font name and try to map to system fonts
            const cleanFont = item.fontName.toLowerCase();
            
            // Detect font weight and style
            if (cleanFont.includes('bold')) fontWeight = 'bold';
            if (cleanFont.includes('italic') || cleanFont.includes('oblique')) fontStyle = 'italic';
            
            // Common PDF font mappings with better matching
            if (cleanFont.includes('times') || cleanFont.includes('serif')) {
                fontFamily = 'Comic Sans';
            } else if (cleanFont.includes('helvetica') || cleanFont.includes('arial')) {
                fontFamily = 'Comic Sans';
            } else if (cleanFont.includes('courier')) {
                fontFamily = 'Comic Sans';
            } else {
                // Default to a neutral sans-serif for better matching
                fontFamily = 'Comic Sans';
            }
        }
        
        span.style.cssText = `
            position: absolute;
            left: ${tx[4]}px;
            top: ${tx[5] - fontAscent}px;
            font-size: ${fontHeight}px;
            font-family: ${fontFamily};
            font-weight: ${fontWeight};
            font-style: ${fontStyle};
            transform-origin: 0% 0%;
            white-space: pre;
            color: transparent;
            pointer-events: auto;
            cursor: text;
            user-select: text;
            line-height: 1;
            margin: 0;
            padding: 0;
            letter-spacing: 0;
            word-spacing: 0;
            height: ${fontHeight}px;
            display: inline-block;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        `;
        
        // Add to container first to measure
        container.appendChild(span);
        
        // Apply rotation and width scaling if needed
        const angle = Math.atan2(tx[1], tx[0]);
        let transform = '';
        
        if (angle !== 0) {
            transform += `rotate(${angle}rad) `;
        }
        
        // Scale width to match exact PDF text width
        if (item.width) {
            const textWidth = item.width * viewport.scale;
            const actualWidth = span.getBoundingClientRect().width;
            
            if (actualWidth > 0) {
                const scaleX = textWidth / actualWidth;
                transform += `scaleX(${scaleX})`;
                span.style.width = `${actualWidth}px`;
            }
        }
        
        if (transform) {
            span.style.transform = transform.trim();
        }
    }
}

/**
 * Render all pages of the PDF
 */
async function renderAllPages() {
    if (!pdfState.pdfDocument || pdfState.isRendering) return;
    
    pdfState.isRendering = true;
    const numPages = pdfState.pdfDocument.numPages;
    
    for (let i = 1; i <= numPages; i++) {
        await renderPDFPage(i);
    }
    
    pdfState.isRendering = false;
    console.log('InclusiveRead: All PDF pages rendered');
}

/**
 * Extract all text from the PDF for analysis
 */
function extractPDFText() {
    if (!pdfState.textContent || pdfState.textContent.length === 0) {
        return '';
    }
    
    let fullText = '';
    
    for (const pageContent of pdfState.textContent) {
        if (!pageContent || !pageContent.items) continue;
        
        for (const item of pageContent.items) {
            if (item.str) {
                fullText += item.str + ' ';
            }
        }
        fullText += '\n\n'; // Page break
    }
    
    return fullText.trim();
}

/**
 * Get all text spans from PDF text layer (for feature application)
 */
function getPDFTextSpans() {
    return document.querySelectorAll('.ir-pdf-text-span');
}

/**
 * Get text nodes from PDF for compatibility with existing DOM functions
 */
function getPDFTextNodes() {
    const spans = getPDFTextSpans();
    const textNodes = [];
    
    spans.forEach(span => {
        if (span.firstChild && span.firstChild.nodeType === Node.TEXT_NODE) {
            textNodes.push(span.firstChild);
        }
    });
    
    return textNodes;
}

/**
 * Apply styles to PDF text layer (for dyslexia mode, etc.)
 */
function applyPDFTextStyles(styles) {
//    const spans = getPDFTextSpans();
    
  //  spans.forEach(span => {
    //    Object.assign(span.style, styles);
        // Make text visible when styles are applied
      //  span.style.color = styles.color || '#000';
        //span.style.opacity = '0';
   // });
}

/**
 * Reset PDF text layer styles
 */
function resetPDFTextStyles() {
//    const spans = getPDFTextSpans();
    
  //  spans.forEach(span => {
    //    span.style.color = 'transparent';
      //  span.style.opacity = '1';
   // });
}

/**
 * Inject PDF viewer styles
 */
function injectPDFStyles() {
    const css = `
        #ir-pdf-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .ir-pdf-page {
            position: relative;
            margin-bottom: 20px;
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        .ir-pdf-text-layer {
            position: absolute;
            left: 0;
            top: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
            line-height: 1.0;
        }
        
        .ir-pdf-text-span {
            position: absolute;
            white-space: pre;
            pointer-events: auto;
            cursor: text;
            color: transparent;
            user-select: text;
        }
        
        .ir-pdf-text-span::selection {
            background: rgb(100, 149, 237);
            color: #fff !important;
            text-shadow: none;
        }
        
        .ir-pdf-text-span::-moz-selection {
            background: rgb(100, 149, 237);
            color: #fff !important;
            text-shadow: none;
        }
        
        /* Jargon terms remain interactive */
        .ir-jargon-term {
            pointer-events: auto;
            cursor: pointer;
        }
        
        /* When dyslexia mode or other features are active */
        .ir-pdf-text-layer.ir-active .ir-pdf-text-span {
            color: #000 !important;
            opacity: 1 !important;
        }
        
        /* Jargon highlighting in PDF */
        .ir-pdf-text-span.ir-jargon-highlight {
            background: rgba(255, 235, 59, 0.5) !important;
            color: #000 !important;
            opacity: 1 !important;
            border-radius: 2px;
            cursor: pointer;
        }
        
        .ir-pdf-text-span.ir-jargon-highlight:hover {
            background: rgba(255, 193, 7, 0.7) !important;
        }
        
        /* Bionic reading in PDF */
        .ir-pdf-text-span .ir-bionic-bold {
            font-weight: 700 !important;
        }
        
        /* TTS word highlight in PDF */
        .ir-pdf-text-span.ir-tts-highlight {
            background: rgba(33, 150, 243, 0.4) !important;
            color: #000 !important;
            opacity: 1 !important;
        }
        
        /* PDF toolbar */
        #ir-pdf-toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 48px;
            background: #323639;
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 12px;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        
        #ir-pdf-toolbar button {
            background: transparent;
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }
        
        #ir-pdf-toolbar button:hover {
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.4);
        }
        
        #ir-pdf-toolbar .ir-toolbar-title {
            color: white;
            font-size: 14px;
            font-weight: 500;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        #ir-pdf-toolbar .ir-page-info {
            color: rgba(255,255,255,0.7);
            font-size: 13px;
        }
    `;
    
    injectCSS(css, 'ir-pdf-styles');
}

/**
 * Create PDF toolbar with zoom controls
 */
function createPDFToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'ir-pdf-toolbar';
    toolbar.innerHTML = `
        <span class="ir-toolbar-title">InclusiveRead PDF Viewer</span>
        <span class="ir-page-info">${pdfState.pdfDocument?.numPages || 0} pages</span>
        <button id="ir-pdf-zoom-out" title="Zoom Out">−</button>
        <button id="ir-pdf-zoom-in" title="Zoom In">+</button>
        <button id="ir-pdf-fit-width" title="Fit Width">Fit</button>
    `;
    
    document.body.insertBefore(toolbar, document.body.firstChild);
    
    // Adjust container padding for toolbar
    if (pdfState.containerElement) {
        pdfState.containerElement.style.paddingTop = '68px';
    }
    
    // Add event listeners
    document.getElementById('ir-pdf-zoom-out').addEventListener('click', () => {
        pdfState.currentScale = Math.max(0.5, pdfState.currentScale - 0.25);
        reRenderPDF();
    });
    
    document.getElementById('ir-pdf-zoom-in').addEventListener('click', () => {
        pdfState.currentScale = Math.min(3, pdfState.currentScale + 0.25);
        reRenderPDF();
    });
    
    document.getElementById('ir-pdf-fit-width').addEventListener('click', () => {
        const containerWidth = pdfState.containerElement.clientWidth - 40;
        if (pdfState.pdfPages[0]) {
            const pageWidth = pdfState.pdfPages[0].viewport.width / pdfState.currentScale;
            pdfState.currentScale = containerWidth / pageWidth;
            reRenderPDF();
        }
    });
}

/**
 * Re-render PDF with new scale
 */
async function reRenderPDF() {
    if (!pdfState.pdfDocument || pdfState.isRendering) return;
    
    // Clear existing pages
    const pages = pdfState.containerElement.querySelectorAll('.ir-pdf-page');
    pages.forEach(page => page.remove());
    
    pdfState.pdfPages = [];
    pdfState.textContent = [];
    
    await renderAllPages();
}

/**
 * Initialize PDF viewer for current page
 */
async function initPDFViewer() {
    if (!isPDFDocument()) {
        return false;
    }
    
    // Check if we're in Chrome's PDF viewer
    if (isChromePDFViewer()) {
        console.log('InclusiveRead: Chrome PDF viewer detected, creating custom viewer');
        
        try {
            const pdfUrl = window.location.href;
            
            // Create custom viewer
            createPDFViewerContainer();
            
            // Load the PDF
            await loadPDFDocument(pdfUrl);
            
            // Create toolbar
            createPDFToolbar();
            
            // Render all pages
            await renderAllPages();
            
            pdfState.isPDF = true;
            return true;
        } catch (error) {
            console.error('InclusiveRead: Failed to initialize PDF viewer:', error);
            return false;
        }
    }
    
    return false;
}

/**
 * Check if PDF mode is active
 */
function isPDFMode() {
    return pdfState.isPDF;
}

/**
 * Get PDF state
 */
function getPDFState() {
    return pdfState;
}

// Export for content script
if (typeof window !== 'undefined') {
    window.pdfService = {
        isPDFDocument,
        isChromePDFViewer,
        initPDFViewer,
        loadPDFDocument,
        extractPDFText,
        getPDFTextSpans,
        getPDFTextNodes,
        applyPDFTextStyles,
        resetPDFTextStyles,
        isPDFMode,
        getPDFState,
        reRenderPDF
    };
}
