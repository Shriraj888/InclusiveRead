// DOM Elements
const simplifyBtn = document.getElementById('simplify-btn');
const statusEl = document.getElementById('status');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('api-key');
const toggleVisibilityBtn = document.getElementById('toggle-visibility');
const saveSettingsBtn = document.getElementById('save-settings');
const displayModeInputs = document.querySelectorAll('input[name="displayMode"]');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
});

// Load saved settings
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['apiKey', 'displayMode']);
    
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    
    if (result.displayMode) {
      const modeInput = document.querySelector(`input[value="${result.displayMode}"]`);
      if (modeInput) {
        modeInput.checked = true;
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const displayMode = document.querySelector('input[name="displayMode"]:checked').value;
  
  try {
    await chrome.storage.local.set({ apiKey, displayMode });
    showStatus('Settings saved!', 'success');
  } catch (error) {
    showStatus('Failed to save settings', 'error');
  }
});

// Toggle settings panel
settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
  settingsToggle.classList.toggle('active');
});

// Toggle API key visibility
toggleVisibilityBtn.addEventListener('click', () => {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
  } else {
    apiKeyInput.type = 'password';
  }

  // Keep SVG icon (do not replace button contents)
  const svg = toggleVisibilityBtn.querySelector('svg');
  if (!svg) return;

  if (apiKeyInput.type === 'text') {
    // Eye-off icon
    svg.innerHTML = `
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.81 21.81 0 0 1 5.06-6.88"/>
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.88 21.88 0 0 1-2.83 4.2"/>
      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"/>
      <path d="M1 1l22 22"/>
    `;
  } else {
    // Eye icon
    svg.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
  }
});

// Save display mode on change
displayModeInputs.forEach(input => {
  input.addEventListener('change', async (e) => {
    try {
      await chrome.storage.local.set({ displayMode: e.target.value });
    } catch (error) {
      console.error('Error saving display mode:', error);
    }
  });
});

// Debounce to prevent rapid clicking
let isProcessing = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between requests

// Main simplify action
simplifyBtn.addEventListener('click', async () => {
  // Prevent rapid-fire requests
  const now = Date.now();
  if (isProcessing) {
    showStatus('Already processing, please wait...', 'error');
    return;
  }
  
  if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    const waitTime = Math.ceil((MIN_REQUEST_INTERVAL - (now - lastRequestTime)) / 1000);
    showStatus(`Please wait ${waitTime} seconds before the next request`, 'error');
    return;
  }
  
  // Check for API key
  const result = await chrome.storage.local.get(['apiKey', 'displayMode']);
  
  if (!result.apiKey) {
    showStatus('Please add your Gemini API key in Settings', 'error');
    settingsPanel.classList.remove('hidden');
    settingsToggle.classList.add('active');
    return;
  }
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    showStatus('No active tab found', 'error');
    return;
  }
  
  // Check if we can inject into this page
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
    showStatus('Cannot simplify browser internal pages', 'error');
    return;
  }
  
  // Set processing state
  isProcessing = true;
  lastRequestTime = now;
  
  // Show loading state
  setLoadingState(true);
  showStatus('Extracting page content...', 'success');
  
  try {
    // Inject content script if needed and extract content
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js']
    });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    // Send message to content script to extract and simplify
    const displayMode = result.displayMode || 'overlay';
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'simplify',
      displayMode: displayMode,
      apiKey: result.apiKey
    });
    
    // Close popup after initiating
    setTimeout(() => {
      window.close();
    }, 500);
    
  } catch (error) {
    console.error('Error:', error);
    showStatus('Failed to process page: ' + error.message, 'error');
    setLoadingState(false);
    isProcessing = false;
  }
});

// Helper functions
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
}

function setLoadingState(loading) {
  if (loading) {
    simplifyBtn.disabled = true;
    simplifyBtn.classList.add('loading');
    const label = simplifyBtn.querySelector('.btn-label');
    if (label) label.textContent = 'Processing...';
  } else {
    simplifyBtn.disabled = false;
    simplifyBtn.classList.remove('loading');
    const label = simplifyBtn.querySelector('.btn-label');
    if (label) label.textContent = 'Simplify This Page';
  }
}
