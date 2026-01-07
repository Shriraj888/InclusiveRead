// Popup.js - Extension popup logic

// DOM elements
const spotlightToggle = document.getElementById('spotlightToggle');
const jargonToggle = document.getElementById('jargonToggle');
const sensoryToggle = document.getElementById('sensoryToggle');
const spotlightIntensity = document.getElementById('spotlightIntensity');
const spotlightValue = document.getElementById('spotlightValue');
const spotlightSettings = document.getElementById('spotlightSettings');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const saveKeyBtn = document.getElementById('saveKey');
const apiStatus = document.getElementById('apiStatus');
const statusText = document.getElementById('statusText');

// Load saved settings
chrome.storage.sync.get([
  'spotlightEnabled',
  'jargonEnabled',
  'sensoryEnabled',
  'spotlightIntensity',
  'apiKey'
], (result) => {
  spotlightToggle.checked = result.spotlightEnabled || false;
  jargonToggle.checked = result.jargonEnabled || false;
  sensoryToggle.checked = result.sensoryEnabled || false;
  spotlightIntensity.value = result.spotlightIntensity || 70;
  spotlightValue.textContent = `${spotlightIntensity.value}%`;

  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
    showApiStatus('API key configured', 'success');
  }

  // Show spotlight settings if enabled
  if (result.spotlightEnabled) {
    spotlightSettings.style.display = 'block';
  }
});

// Spotlight toggle
spotlightToggle.addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.sync.set({ spotlightEnabled: enabled });
  spotlightSettings.style.display = enabled ? 'block' : 'none';
  await sendMessageToActiveTab({ action: 'toggleSpotlight', enabled });
  updateMainStatus();
});

// Jargon toggle
jargonToggle.addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.sync.set({ jargonEnabled: enabled });
  await sendMessageToActiveTab({ action: 'toggleJargon', enabled });
  updateMainStatus();
});

// Sensory toggle
sensoryToggle.addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.sync.set({ sensoryEnabled: enabled });
  await sendMessageToActiveTab({ action: 'toggleSensory', enabled });
  updateMainStatus();
});

// Spotlight intensity slider
spotlightIntensity.addEventListener('input', (e) => {
  const value = e.target.value;
  spotlightValue.textContent = `${value}%`;
  // Update gradient
  e.target.style.background = `linear-gradient(to right, #667eea 0%, #667eea ${value}%, #e2e8f0 ${value}%, #e2e8f0 100%)`;
});

spotlightIntensity.addEventListener('change', async (e) => {
  const value = parseInt(e.target.value);
  await chrome.storage.sync.set({ spotlightIntensity: value });
  await sendMessageToActiveTab({ action: 'updateSpotlightIntensity', value });
});

// Settings panel toggle
settingsBtn.addEventListener('click', () => {
  const isOpen = settingsPanel.style.display === 'block';
  settingsPanel.style.display = isOpen ? 'none' : 'block';
  settingsBtn.classList.toggle('active', !isOpen);
});

// Toggle API key visibility
toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyBtn.textContent = isPassword ? '🙈' : '👁️';
});

// Save API key
saveKeyBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showApiStatus('Please enter an API key', 'error');
    return;
  }

  // Validate API key format (basic check)
  if (apiKey.length < 10) {
    showApiStatus('API key looks too short', 'error');
    return;
  }

  // Save to storage
  await chrome.storage.sync.set({ apiKey });
  showApiStatus('API key saved successfully!', 'success');
  updateMainStatus();

  // Test the API key
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testApiKey',
      apiKey
    });

    if (response.success) {
      showApiStatus('API key validated ✓', 'success');
    } else {
      showApiStatus(`API key error: ${response.error}`, 'error');
    }
  } catch (error) {
    showApiStatus('Could not validate API key', 'error');
  }
});

// Helper: Send message to active tab
async function sendMessageToActiveTab(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we can inject scripts or if it's a restricted URL
    if (!tab?.id || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      console.log('Cannot inject into this page');
      return;
    }

    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.error('Error sending message to tab:', error);

    // Check for specific connection error
    if (error.message.includes('Receiving end does not exist')) {
      // Show user-friendly message in the status area
      statusText.textContent = 'Please refresh the page!';
      statusText.style.color = '#e53e3e'; // Red color

      // Also show a toast/status
      showApiStatus('Please refresh this page to enable the extension', 'error');
    }
  }
}

// Helper: Show API status message
function showApiStatus(message, type) {
  apiStatus.textContent = message;
  apiStatus.className = `status-message ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      apiStatus.style.display = 'none';
    }, 3000);
  }
}

// Helper: Update main status
function updateMainStatus() {
  const anyEnabled = spotlightToggle.checked || jargonToggle.checked || sensoryToggle.checked;

  if (anyEnabled) {
    const features = [];
    if (spotlightToggle.checked) features.push('Spotlight');
    if (jargonToggle.checked) features.push('Jargon');
    if (sensoryToggle.checked) features.push('Sensory');
    statusText.textContent = `Active: ${features.join(', ')}`;
  } else {
    statusText.textContent = 'Ready to simplify';
  }
}

// Initialize intensity slider gradient
const initialValue = spotlightIntensity.value;
spotlightIntensity.style.background = `linear-gradient(to right, #667eea 0%, #667eea ${initialValue}%, #e2e8f0 ${initialValue}%, #e2e8f0 100%)`;
