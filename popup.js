// Popup.js - Extension popup logic

// DOM elements
const jargonToggle = document.getElementById('jargonToggle');
const sensoryToggle = document.getElementById('sensoryToggle');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const saveKeyBtn = document.getElementById('saveKey');
const apiStatus = document.getElementById('apiStatus');
const statusText = document.getElementById('statusText');

// Load saved settings
chrome.storage.sync.get([
  'jargonEnabled',
  'sensoryEnabled',
  'apiKey'
], (result) => {
  jargonToggle.checked = result.jargonEnabled || false;
  sensoryToggle.checked = result.sensoryEnabled || false;

  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
    showApiStatus('API key configured', 'success');
  }
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
  const eyeIcon = toggleKeyBtn.querySelector('svg');
  if (isPassword) {
    eyeIcon.innerHTML = '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>';
  } else {
    eyeIcon.innerHTML = '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
  }
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
      showApiStatus('API key validated successfully', 'success');
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
  const anyEnabled = jargonToggle.checked || sensoryToggle.checked;

  if (anyEnabled) {
    const features = [];
    if (jargonToggle.checked) features.push('Jargon');
    if (sensoryToggle.checked) features.push('Sensory');
    statusText.textContent = `Active: ${features.join(', ')}`;
  } else {
    statusText.textContent = 'Ready to simplify';
  }
}
