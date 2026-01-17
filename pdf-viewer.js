// PDF Viewer JavaScript - InclusiveRead
import * as pdfjsLib from './lib/pdf.mjs';

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.mjs';

// State
const state = {
    pdfDocument: null,
    pages: [],
    textContent: [],
    currentScale: 1.5,
    container: null
};

// Get PDF URL from query params
const urlParams = new URLSearchParams(window.location.search);
const pdfUrl = urlParams.get('url');

// Initialize
init();

async function init() {
    state.container = document.getElementById('ir-pdf-container');
    
    if (!pdfUrl) {
        showError('No PDF URL provided');
        return;
    }

    try {
        updateLoadingProgress('Fetching PDF...');
        
        // Decode the URL
        const decodedUrl = decodeURIComponent(pdfUrl);
        
        // Update title
        const fileName = decodedUrl.split('/').pop().split('?')[0] || 'PDF Document';
        document.getElementById('pdfTitle').textContent = fileName;
        document.title = `${fileName} - InclusiveRead PDF Viewer`;

        updateLoadingProgress('Loading PDF document...');
        
        // Load PDF
        const loadingTask = pdfjsLib.getDocument(decodedUrl);
        state.pdfDocument = await loadingTask.promise;

        document.getElementById('pageInfo').textContent = `${state.pdfDocument.numPages} pages`;

        updateLoadingProgress('Rendering pages...');
        
        // Render all pages
        await renderAllPages();

        // Hide loading overlay
        document.getElementById('ir-loading-overlay').style.display = 'none';

        // Setup controls
        setupControls();

    } catch (error) {
        console.error('Failed to load PDF:', error);
        showError(`Failed to load PDF: ${error.message}`);
    }
}

async function renderAllPages() {
    const numPages = state.pdfDocument.numPages;

    for (let i = 1; i <= numPages; i++) {
        updateLoadingProgress(`Rendering page ${i} of ${numPages}...`);
        await renderPage(i);
    }
}

async function renderPage(pageNum) {
    const page = await state.pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.currentScale });

    // Create page container
    const pageContainer = document.createElement('div');
    pageContainer.className = 'ir-pdf-page';
    pageContainer.dataset.pageNumber = pageNum;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'ir-pdf-canvas';
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Create text layer
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'ir-pdf-text-layer';

    pageContainer.appendChild(canvas);
    pageContainer.appendChild(textLayerDiv);
    state.container.appendChild(pageContainer);

    // Render to canvas
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    // Get and render text content
    const textContent = await page.getTextContent();
    state.textContent[pageNum - 1] = textContent;
    renderTextLayer(textLayerDiv, textContent, viewport);

    // Store reference
    state.pages[pageNum - 1] = {
        page,
        viewport,
        canvas,
        textLayerDiv,
        pageContainer
    };
}

function renderTextLayer(container, textContent, viewport) {
    for (const item of textContent.items) {
        if (!item.str || item.str.trim() === '') continue;

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

        const span = document.createElement('span');
        span.className = 'ir-pdf-text-span';
        span.textContent = item.str;

        const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));

        span.style.position = 'absolute';
        span.style.left = `${tx[4]}px`;
        span.style.top = `${tx[5] - fontHeight}px`;
        span.style.fontSize = `${fontHeight}px`;
        span.style.fontFamily = 'sans-serif';
        span.style.transformOrigin = '0% 0%';
        span.style.whiteSpace = 'pre';

        const angle = Math.atan2(tx[1], tx[0]);
        if (angle !== 0) {
            span.style.transform = `rotate(${angle}rad)`;
        }

        container.appendChild(span);
    }
}

async function reRenderAllPages() {
    // Clear container
    state.container.innerHTML = '';
    state.pages = [];
    state.textContent = [];

    // Re-render
    await renderAllPages();
}

function setupControls() {
    // Zoom out
    document.getElementById('zoomOut').addEventListener('click', async () => {
        state.currentScale = Math.max(0.5, state.currentScale - 0.25);
        document.getElementById('zoomValue').textContent = `${Math.round(state.currentScale * 100)}%`;
        await reRenderAllPages();
    });

    // Zoom in
    document.getElementById('zoomIn').addEventListener('click', async () => {
        state.currentScale = Math.min(3, state.currentScale + 0.25);
        document.getElementById('zoomValue').textContent = `${Math.round(state.currentScale * 100)}%`;
        await reRenderAllPages();
    });

    // Fit width
    document.getElementById('fitWidth').addEventListener('click', async () => {
        if (state.pages[0]) {
            const containerWidth = state.container.clientWidth - 40;
            const pageWidth = state.pages[0].viewport.width / state.currentScale;
            state.currentScale = containerWidth / pageWidth;
            document.getElementById('zoomValue').textContent = `${Math.round(state.currentScale * 100)}%`;
            await reRenderAllPages();
        }
    });

    // Download
    document.getElementById('downloadPdf').addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = decodeURIComponent(pdfUrl);
        link.download = document.getElementById('pdfTitle').textContent;
        link.click();
    });

    // Update zoom display
    document.getElementById('zoomValue').textContent = `${Math.round(state.currentScale * 100)}%`;
}

function updateLoadingProgress(text) {
    document.getElementById('loadingProgress').textContent = text;
}

function showError(message) {
    document.getElementById('ir-loading-overlay').style.display = 'none';
    state.container.innerHTML = `
        <div class="ir-error-container">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h2>Unable to Load PDF</h2>
            <p>${message}</p>
        </div>
    `;
}

// Extract all text (for TTS, Jargon decoder, etc.)
window.extractPDFText = function() {
    let fullText = '';
    for (const pageContent of state.textContent) {
        if (!pageContent || !pageContent.items) continue;
        for (const item of pageContent.items) {
            if (item.str) fullText += item.str + ' ';
        }
        fullText += '\n\n';
    }
    return fullText.trim();
};

// Extract text per page for readable view
window.extractPDFTextByPage = function() {
    const pages = [];
    for (let i = 0; i < state.textContent.length; i++) {
        const pageContent = state.textContent[i];
        if (!pageContent || !pageContent.items) {
            pages.push('');
            continue;
        }
        
        let pageText = '';
        let lastY = null;
        
        for (const item of pageContent.items) {
            if (item.str) {
                // Check if this is a new line (Y position changed significantly)
                if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                    pageText += '\n';
                }
                pageText += item.str;
                lastY = item.transform[5];
            }
        }
        pages.push(pageText.trim());
    }
    return pages;
};

// Get all text spans (for feature application)
window.getPDFTextSpans = function() {
    return document.querySelectorAll('.ir-pdf-text-span');
};

// Expose state for extension features
window.pdfViewerState = state;

// Create readable text view for dyslexia mode
function createReadableView() {
    // Check if already exists
    let readableContainer = document.getElementById('ir-readable-view');
    if (readableContainer) {
        readableContainer.style.display = 'block';
        document.getElementById('ir-pdf-container').style.display = 'none';
        return readableContainer;
    }
    
    readableContainer = document.createElement('div');
    readableContainer.id = 'ir-readable-view';
    readableContainer.className = 'ir-readable-view';
    
    const pageTexts = window.extractPDFTextByPage();
    
    pageTexts.forEach((text, index) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'ir-readable-page';
        
        const pageHeader = document.createElement('div');
        pageHeader.className = 'ir-readable-page-header';
        pageHeader.textContent = `Page ${index + 1}`;
        pageDiv.appendChild(pageHeader);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'ir-readable-content';
        
        // Split text into paragraphs and create spans for each word (for bionic reading)
        const paragraphs = text.split('\n\n');
        paragraphs.forEach(para => {
            if (para.trim()) {
                const p = document.createElement('p');
                p.className = 'ir-readable-paragraph';
                p.textContent = para.trim();
                contentDiv.appendChild(p);
            }
        });
        
        pageDiv.appendChild(contentDiv);
        readableContainer.appendChild(pageDiv);
    });
    
    document.body.appendChild(readableContainer);
    document.getElementById('ir-pdf-container').style.display = 'none';
    
    return readableContainer;
}

// Hide readable view and show PDF
function hideReadableView() {
    const readableContainer = document.getElementById('ir-readable-view');
    if (readableContainer) {
        readableContainer.style.display = 'none';
    }
    document.getElementById('ir-pdf-container').style.display = 'flex';
}

// Create pdfService compatibility layer for content.js features
window.pdfService = {
    isPDFDocument: function() {
        return true; // We're always in PDF mode in this viewer
    },
    getPDFTextSpans: function() {
        // Return readable view paragraphs if in dyslexia mode, otherwise text layer spans
        const readableView = document.getElementById('ir-readable-view');
        if (readableView && readableView.style.display !== 'none') {
            return document.querySelectorAll('.ir-readable-paragraph');
        }
        return document.querySelectorAll('.ir-pdf-text-span');
    },
    extractPDFText: function() {
        return window.extractPDFText();
    },
    resetPDFTextStyles: function() {
        // Hide readable view
        hideReadableView();
        
        // Reset text layer spans
        const spans = document.querySelectorAll('.ir-pdf-text-span');
        spans.forEach(span => {
            span.style.fontFamily = '';
            span.style.letterSpacing = '';
            span.style.wordSpacing = '';
            span.style.color = 'transparent';
            span.style.opacity = '';
            if (span.dataset.bionicApplied) {
                const text = span.textContent;
                span.innerHTML = '';
                span.textContent = text;
                delete span.dataset.bionicApplied;
            }
        });
        
        // Reset readable paragraphs
        const paragraphs = document.querySelectorAll('.ir-readable-paragraph');
        paragraphs.forEach(p => {
            p.style.fontFamily = '';
            p.style.letterSpacing = '';
            p.style.wordSpacing = '';
            p.style.lineHeight = '';
            if (p.dataset.bionicApplied) {
                const text = p.textContent;
                p.innerHTML = '';
                p.textContent = text;
                delete p.dataset.bionicApplied;
            }
        });
    },
    // Activate readable view for dyslexia mode
    activateReadableView: function() {
        return createReadableView();
    },
    hideReadableView: hideReadableView
};

console.log('InclusiveRead PDF Viewer: pdfService compatibility layer initialized');
