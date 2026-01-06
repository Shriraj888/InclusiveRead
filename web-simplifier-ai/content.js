// Content Script for Web Simplifier AI
// Handles content extraction and UI injection

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.__webSimplifierAILoaded) {
    return;
  }
  window.__webSimplifierAILoaded = true;
  
  // Cache for storing simplified content
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  let cachedData = null;
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'simplify') {
      handleSimplify(message.displayMode, message.apiKey);
    }
  });
  
  // Generate cache key for current page
  function generateCacheKey() {
    const url = window.location.href;
    const title = document.title;
    return `${url}_${title}`;
  }
  
  // Main simplify handler
  async function handleSimplify(displayMode, apiKey) {
    try {
      // Show loading indicator
      showLoadingOverlay();
      
      // Extract page content
      const pageContent = extractPageContent();
      
      if (!pageContent.content || pageContent.content.trim().length < 100) {
        throw new Error('Not enough content found on this page to simplify');
      }
      
      // Check cache first
      const cacheKey = generateCacheKey();
      const cachedResult = await checkCache(cacheKey);
      
      if (cachedResult) {
        // Use cached result (saves API call!)
        removeLoadingOverlay();
        displaySimplifiedContent(cachedResult.data, pageContent.title, displayMode);
        showCacheNotice();
        return;
      }
      
      // Update loading message
      updateLoadingMessage('Analyzing with AI... (This may take a moment)');
      
      // Call Gemini API via background script
      const response = await chrome.runtime.sendMessage({
        action: 'callGemini',
        content: pageContent.content,
        title: pageContent.title,
        apiKey: apiKey
      });
      
      // Remove loading overlay
      removeLoadingOverlay();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get AI response');
      }
      
      // Cache the result
      await saveToCache(cacheKey, response.data);
      
      // Display the simplified content
      displaySimplifiedContent(response.data, pageContent.title, displayMode);
      
    } catch (error) {
      removeLoadingOverlay();
      showErrorMessage(error.message);
    }
  }
  
  // Cache helper functions to reduce API calls
  async function checkCache(cacheKey) {
    try {
      const result = await chrome.storage.local.get(['simplifierCache']);
      const cache = result.simplifierCache || {};
      
      if (cache[cacheKey]) {
        const cachedItem = cache[cacheKey];
        const now = Date.now();
        
        // Check if cache is still valid (30 minutes)
        if (now - cachedItem.timestamp < CACHE_DURATION) {
          console.log('✅ Using cached result (saving API call)');
          return cachedItem;
        } else {
          // Cache expired, remove it
          delete cache[cacheKey];
          await chrome.storage.local.set({ simplifierCache: cache });
        }
      }
      
      return null;
    } catch (error) {
      console.error('Cache check error:', error);
      return null;
    }
  }
  
  async function saveToCache(cacheKey, data) {
    try {
      const result = await chrome.storage.local.get(['simplifierCache']);
      const cache = result.simplifierCache || {};
      
      // Add new cache entry
      cache[cacheKey] = {
        data: data,
        timestamp: Date.now()
      };
      
      // Clean old cache entries (keep only last 10)
      const cacheKeys = Object.keys(cache);
      if (cacheKeys.length > 10) {
        // Sort by timestamp and remove oldest
        const sortedKeys = cacheKeys.sort((a, b) => 
          cache[a].timestamp - cache[b].timestamp
        );
        for (let i = 0; i < sortedKeys.length - 10; i++) {
          delete cache[sortedKeys[i]];
        }
      }
      
      await chrome.storage.local.set({ simplifierCache: cache });
      console.log('✅ Result cached for future use');
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }
  
  function showCacheNotice() {
    // Show a brief notice that cached result was used
    const notice = document.createElement('div');
    notice.textContent = 'Loaded from cache (no API call used)';
    notice.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(34, 197, 94, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notice);
    
    setTimeout(() => {
      notice.style.opacity = '0';
      notice.style.transition = 'opacity 0.3s ease';
      setTimeout(() => notice.remove(), 300);
    }, 3000);
  }
  
  // Extract page content using Readability or fallback
  function extractPageContent() {
    let content = '';
    let title = document.title;
    
    // Try using Readability if available
    if (typeof Readability !== 'undefined') {
      try {
        const documentClone = document.cloneNode(true);
        const reader = new Readability(documentClone, {
          charThreshold: 100
        });
        const article = reader.parse();
        
        if (article && article.textContent) {
          return {
            title: article.title || title,
            content: article.textContent,
            excerpt: article.excerpt || ''
          };
        }
      } catch (e) {
        console.log('Readability failed, using fallback:', e);
      }
    }
    
    // Fallback: Extract main content manually
    content = extractMainContent();
    
    return {
      title: title,
      content: content,
      excerpt: ''
    };
  }
  
  // Fallback content extraction
  function extractMainContent() {
    // Priority selectors for main content
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content',
      '.post',
      '.article'
    ];
    
    let mainElement = null;
    
    // Find the best content container
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 200) {
        mainElement = element;
        break;
      }
    }
    
    // Fallback to body
    if (!mainElement) {
      mainElement = document.body;
    }
    
    // Clone and clean up
    const clone = mainElement.cloneNode(true);
    
    // Remove unwanted elements
    const removeSelectors = [
      'script', 'style', 'noscript', 'iframe', 'svg',
      'nav', 'header', 'footer', 'aside',
      '.nav', '.navigation', '.menu', '.sidebar',
      '.advertisement', '.ad', '.ads', '.social-share',
      '.comments', '.comment', '.related-posts',
      '[role="navigation"]', '[role="banner"]', '[role="complementary"]'
    ];
    
    removeSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Get clean text
    return clone.textContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
  
  // Display simplified content based on mode
  function displaySimplifiedContent(content, title, mode) {
    const formattedContent = formatMarkdown(content);
    
    switch (mode) {
      case 'sidebar':
        createSidebar(formattedContent, title);
        break;
      case 'replace':
        replacePageContent(formattedContent, title);
        break;
      case 'overlay':
      default:
        createOverlay(formattedContent, title);
        break;
    }
  }
  
  // Create overlay mode (full screen modal)
  function createOverlay(content, title) {
    removeExistingUI();
    
    const host = document.createElement('div');
    host.id = 'web-simplifier-ai-host';
    
    const shadow = host.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = `
      <style>${getInjectedStyles()}</style>
      <div class="wsa-overlay" id="wsa-overlay">
        <div class="wsa-overlay-backdrop"></div>
        <div class="wsa-modal">
          <div class="wsa-modal-header">
            <div class="wsa-modal-title">
              <span class="wsa-logo">🧠</span>
              <span>Simplified: ${escapeHtml(title)}</span>
            </div>
            <button class="wsa-close-btn" id="wsa-close">✕</button>
          </div>
          <div class="wsa-modal-content">
            ${content}
          </div>
          <div class="wsa-modal-footer">
            <span class="wsa-powered">Powered by Web Simplifier AI</span>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(host);
    
    // Add close handlers
    const closeBtn = shadow.getElementById('wsa-close');
    const backdrop = shadow.querySelector('.wsa-overlay-backdrop');
    
    closeBtn.addEventListener('click', removeExistingUI);
    backdrop.addEventListener('click', removeExistingUI);
    
    // Close on Escape key
    document.addEventListener('keydown', handleEscapeKey);
  }
  
  // Create sidebar mode
  function createSidebar(content, title) {
    removeExistingUI();
    
    const host = document.createElement('div');
    host.id = 'web-simplifier-ai-host';
    
    const shadow = host.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = `
      <style>${getInjectedStyles()}</style>
      <div class="wsa-sidebar" id="wsa-sidebar">
        <div class="wsa-sidebar-header">
          <div class="wsa-sidebar-title">
            <span class="wsa-logo">🧠</span>
            <span>Simplified View</span>
          </div>
          <button class="wsa-close-btn" id="wsa-close">✕</button>
        </div>
        <div class="wsa-sidebar-content">
          <h2 class="wsa-page-title">${escapeHtml(title)}</h2>
          ${content}
        </div>
        <div class="wsa-sidebar-footer">
          <span class="wsa-powered">Powered by Web Simplifier AI</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(host);
    document.body.style.marginRight = '420px';
    document.body.style.transition = 'margin-right 0.3s ease';
    
    // Add close handler
    shadow.getElementById('wsa-close').addEventListener('click', () => {
      document.body.style.marginRight = '0';
      removeExistingUI();
    });
    
    document.addEventListener('keydown', handleEscapeKey);
  }
  
  // Create replace page mode
  function replacePageContent(content, title) {
    // Store original content
    if (!sessionStorage.getItem('wsa-original-html')) {
      sessionStorage.setItem('wsa-original-html', document.body.innerHTML);
      sessionStorage.setItem('wsa-original-styles', document.body.getAttribute('style') || '');
    }
    
    document.body.innerHTML = `
      <style>${getReplaceModeStyles()}</style>
      <div class="wsa-replace-container">
        <header class="wsa-replace-header">
          <div class="wsa-replace-logo">
            <span>🧠</span>
            <span>Web Simplifier AI</span>
          </div>
          <button class="wsa-restore-btn" id="wsa-restore">
            ↩️ Show Original Page
          </button>
        </header>
        <main class="wsa-replace-main">
          <h1 class="wsa-replace-title">${escapeHtml(title)}</h1>
          <div class="wsa-replace-content">
            ${content}
          </div>
        </main>
        <footer class="wsa-replace-footer">
          <p>Content simplified by Web Simplifier AI • Powered by Google Gemini</p>
        </footer>
      </div>
    `;
    
    // Add restore handler
    document.getElementById('wsa-restore').addEventListener('click', restoreOriginalPage);
  }
  
  // Restore original page
  function restoreOriginalPage() {
    const originalHtml = sessionStorage.getItem('wsa-original-html');
    const originalStyles = sessionStorage.getItem('wsa-original-styles');
    
    if (originalHtml) {
      document.body.innerHTML = originalHtml;
      if (originalStyles) {
        document.body.setAttribute('style', originalStyles);
      }
      sessionStorage.removeItem('wsa-original-html');
      sessionStorage.removeItem('wsa-original-styles');
    }
  }
  
  // Loading overlay
  function showLoadingOverlay() {
    removeExistingUI();
    
    const host = document.createElement('div');
    host.id = 'web-simplifier-ai-host';
    
    const shadow = host.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = `
      <style>${getInjectedStyles()}</style>
      <div class="wsa-loading-overlay">
        <div class="wsa-loading-content">
          <div class="wsa-spinner"></div>
          <p class="wsa-loading-text" id="wsa-loading-text">Extracting page content...</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(host);
  }
  
  function updateLoadingMessage(message) {
    const host = document.getElementById('web-simplifier-ai-host');
    if (host && host.shadowRoot) {
      const textEl = host.shadowRoot.getElementById('wsa-loading-text');
      if (textEl) {
        textEl.textContent = message;
      }
    }
  }
  
  function removeLoadingOverlay() {
    removeExistingUI();
  }
  
  // Error message
  function showErrorMessage(message) {
    const host = document.createElement('div');
    host.id = 'web-simplifier-ai-host';
    
    const shadow = host.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = `
      <style>${getInjectedStyles()}</style>
      <div class="wsa-error-toast">
        <span class="wsa-error-icon">⚠️</span>
        <span class="wsa-error-text">${escapeHtml(message)}</span>
        <button class="wsa-error-close" id="wsa-error-close">✕</button>
      </div>
    `;
    
    document.body.appendChild(host);
    
    shadow.getElementById('wsa-error-close').addEventListener('click', removeExistingUI);
    
    // Auto remove after 5 seconds
    setTimeout(removeExistingUI, 5000);
  }
  
  // Helper functions
  function removeExistingUI() {
    const existing = document.getElementById('web-simplifier-ai-host');
    if (existing) {
      existing.remove();
    }
    document.removeEventListener('keydown', handleEscapeKey);
  }
  
  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      document.body.style.marginRight = '0';
      removeExistingUI();
    }
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Simple markdown to HTML converter
  function formatMarkdown(text) {
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Bullet points
      .replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>')
      // Wrap consecutive li elements in ul
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      // Numbered lists
      .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      // Wrap in paragraphs
      .replace(/^(.+)$/gim, function(match) {
        if (match.startsWith('<')) return match;
        return `<p>${match}</p>`;
      })
      // Clean up empty paragraphs
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<[hul])/g, '$1')
      .replace(/(<\/[hul]\d?>)<\/p>/g, '$1');
  }
  
  // Injected styles
  function getInjectedStyles() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      /* Loading Overlay */
      .wsa-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }
      
      .wsa-loading-content {
        text-align: center;
        color: white;
      }
      
      .wsa-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: wsa-spin 1s linear infinite;
        margin: 0 auto 16px;
      }
      
      @keyframes wsa-spin {
        to { transform: rotate(360deg); }
      }
      
      .wsa-loading-text {
        font-size: 16px;
        opacity: 0.9;
      }
      
      /* Error Toast */
      .wsa-error-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 2147483647;
        font-family: 'Segoe UI', system-ui, sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: wsa-slideIn 0.3s ease;
      }
      
      @keyframes wsa-slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      .wsa-error-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
        padding: 4px;
      }
      
      /* Overlay Mode */
      .wsa-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483647;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }
      
      .wsa-overlay-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
      }
      
      .wsa-modal {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 800px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        animation: wsa-modalIn 0.3s ease;
      }
      
      @keyframes wsa-modalIn {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }
      
      .wsa-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #eee;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 16px 16px 0 0;
      }
      
      .wsa-modal-title {
        display: flex;
        align-items: center;
        gap: 10px;
        color: white;
        font-size: 16px;
        font-weight: 600;
      }
      
      .wsa-logo {
        font-size: 24px;
      }
      
      .wsa-close-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s;
      }
      
      .wsa-close-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .wsa-modal-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        line-height: 1.7;
        color: #333;
      }
      
      .wsa-modal-content h1,
      .wsa-modal-content h2,
      .wsa-modal-content h3 {
        color: #667eea;
        margin: 20px 0 12px;
      }
      
      .wsa-modal-content h1 { font-size: 24px; }
      .wsa-modal-content h2 { font-size: 20px; }
      .wsa-modal-content h3 { font-size: 17px; }
      
      .wsa-modal-content p {
        margin-bottom: 12px;
      }
      
      .wsa-modal-content ul {
        margin: 12px 0;
        padding-left: 24px;
      }
      
      .wsa-modal-content li {
        margin-bottom: 8px;
      }
      
      .wsa-modal-content strong {
        color: #444;
      }
      
      .wsa-modal-footer {
        padding: 12px 20px;
        border-top: 1px solid #eee;
        text-align: center;
      }
      
      .wsa-powered {
        font-size: 12px;
        color: #999;
      }
      
      /* Sidebar Mode */
      .wsa-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100vh;
        background: white;
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        font-family: 'Segoe UI', system-ui, sans-serif;
        animation: wsa-slideInRight 0.3s ease;
      }
      
      @keyframes wsa-slideInRight {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }
      
      .wsa-sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      
      .wsa-sidebar-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
        font-weight: 600;
      }
      
      .wsa-sidebar-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        line-height: 1.6;
        color: #333;
      }
      
      .wsa-page-title {
        font-size: 18px;
        color: #667eea;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 2px solid #667eea;
      }
      
      .wsa-sidebar-content h2 { font-size: 17px; margin: 16px 0 10px; color: #667eea; }
      .wsa-sidebar-content h3 { font-size: 15px; margin: 14px 0 8px; color: #667eea; }
      .wsa-sidebar-content p { margin-bottom: 10px; font-size: 14px; }
      .wsa-sidebar-content ul { margin: 10px 0; padding-left: 20px; }
      .wsa-sidebar-content li { margin-bottom: 6px; font-size: 14px; }
      
      .wsa-sidebar-footer {
        padding: 12px;
        border-top: 1px solid #eee;
        text-align: center;
      }
    `;
  }
  
  function getReplaceModeStyles() {
    return `
      body {
        margin: 0;
        padding: 0;
        font-family: 'Segoe UI', system-ui, sans-serif;
        background: #f5f5f5;
        color: #333;
        line-height: 1.7;
      }
      
      .wsa-replace-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      
      .wsa-replace-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 100;
      }
      
      .wsa-replace-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        color: white;
        font-size: 18px;
        font-weight: 600;
      }
      
      .wsa-restore-btn {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      .wsa-restore-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .wsa-replace-main {
        flex: 1;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 24px;
        background: white;
        min-height: calc(100vh - 140px);
      }
      
      .wsa-replace-title {
        font-size: 28px;
        color: #667eea;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 3px solid #667eea;
      }
      
      .wsa-replace-content h1 { font-size: 24px; margin: 24px 0 14px; color: #444; }
      .wsa-replace-content h2 { font-size: 20px; margin: 20px 0 12px; color: #667eea; }
      .wsa-replace-content h3 { font-size: 17px; margin: 18px 0 10px; color: #667eea; }
      .wsa-replace-content p { margin-bottom: 14px; }
      .wsa-replace-content ul { margin: 14px 0; padding-left: 28px; }
      .wsa-replace-content li { margin-bottom: 10px; }
      .wsa-replace-content strong { color: #444; }
      
      .wsa-replace-footer {
        background: #333;
        color: #999;
        text-align: center;
        padding: 20px;
        font-size: 13px;
      }
    `;
  }
  
})();
