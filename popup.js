// Popup.js - Extension popup logic

// DOM elements
const jargonToggle = document.getElementById('jargonToggle');
const sensoryToggle = document.getElementById('sensoryToggle');
const dyslexiaToggle = document.getElementById('dyslexiaToggle');
const dyslexiaOptions = document.getElementById('dyslexiaOptions');
const dyslexiaFont = document.getElementById('dyslexiaFont');
const letterSpacing = document.getElementById('letterSpacing');
const letterSpacingValue = document.getElementById('letterSpacingValue');
const lineHeight = document.getElementById('lineHeight');
const lineHeightValue = document.getElementById('lineHeightValue');
const wordSpacing = document.getElementById('wordSpacing');
const wordSpacingValue = document.getElementById('wordSpacingValue');
const overlayColor = document.getElementById('overlayColor');
const syllableHighlight = document.getElementById('syllableHighlight');
const bionicReading = document.getElementById('bionicReading');
const ttsToggle = document.getElementById('ttsToggle');
const ttsOptions = document.getElementById('ttsOptions');
const ttsPlay = document.getElementById('ttsPlay');
const ttsPause = document.getElementById('ttsPause');
const ttsStop = document.getElementById('ttsStop');
const ttsSpeed = document.getElementById('ttsSpeed');
const ttsPauseOnPunctuation = document.getElementById('ttsPauseOnPunctuation');
const ttsWordHighlight = document.getElementById('ttsWordHighlight');
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
  'ttsWordHighlight'
], (result) => {
  jargonToggle.checked = result.jargonEnabled || false;
  sensoryToggle.checked = result.sensoryEnabled || false;
  dyslexiaToggle.checked = result.dyslexiaEnabled || false;

  // Dyslexia settings
  dyslexiaFont.value = result.dyslexiaFont || 'opendyslexic';
  letterSpacing.value = result.letterSpacing || 1;
  lineHeight.value = result.lineHeight || 1.6;
  wordSpacing.value = result.wordSpacing || 3;
  overlayColor.value = result.overlayColor || 'none';
  syllableHighlight.checked = result.syllableHighlight || false;
  bionicReading.checked = result.bionicReading || false;

  // TTS settings
  ttsToggle.checked = result.ttsEnabled || false;
  ttsSpeed.value = result.ttsSpeed || 1;
  ttsPauseOnPunctuation.checked = result.ttsPauseOnPunctuation !== false;
  ttsWordHighlight.checked = result.ttsWordHighlight !== false;

  // Update range value displays
  updateRangeValues();

  // Show/hide options
  dyslexiaOptions.style.display = dyslexiaToggle.checked ? 'flex' : 'none';
  ttsOptions.style.display = ttsToggle.checked ? 'flex' : 'none';
});

// Load API key separately from LOCAL storage (privacy-first)
chrome.storage.local.get(['apiKey'], (result) => {
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
    showApiStatus('API key configured (local only)', 'success');
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

// Dyslexia toggle
dyslexiaToggle.addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.sync.set({ dyslexiaEnabled: enabled });
  dyslexiaOptions.style.display = enabled ? 'flex' : 'none';

  await sendMessageToActiveTab({
    action: 'toggleDyslexia',
    enabled,
    settings: getDyslexiaSettings()
  });
  updateMainStatus();
});

// Dyslexia font change
dyslexiaFont.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ dyslexiaFont: e.target.value });
  await sendMessageToActiveTab({
    action: 'updateDyslexia',
    settings: getDyslexiaSettings()
  });
});

// Letter spacing
letterSpacing.addEventListener('input', (e) => {
  updateRangeValues();
});

letterSpacing.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ letterSpacing: parseFloat(e.target.value) });
  await sendMessageToActiveTab({
    action: 'updateDyslexia',
    settings: getDyslexiaSettings()
  });
});

// Line height
lineHeight.addEventListener('input', (e) => {
  updateRangeValues();
});

lineHeight.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ lineHeight: parseFloat(e.target.value) });
  await sendMessageToActiveTab({
    action: 'updateDyslexia',
    settings: getDyslexiaSettings()
  });
});

// Word spacing
wordSpacing.addEventListener('input', (e) => {
  updateRangeValues();
});

wordSpacing.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ wordSpacing: parseInt(e.target.value) });
  await sendMessageToActiveTab({
    action: 'updateDyslexia',
    settings: getDyslexiaSettings()
  });
});

// Overlay color
overlayColor.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ overlayColor: e.target.value });
  await sendMessageToActiveTab({
    action: 'updateDyslexia',
    settings: getDyslexiaSettings()
  });
});

// Syllable highlighting
syllableHighlight.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ syllableHighlight: e.target.checked });
  await sendMessageToActiveTab({
    action: 'updateDyslexia',
    settings: getDyslexiaSettings()
  });
});

// Bionic reading
bionicReading.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ bionicReading: e.target.checked });
  await sendMessageToActiveTab({
    action: 'updateDyslexia',
    settings: getDyslexiaSettings()
  });
});

// TTS toggle
ttsToggle.addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.sync.set({ ttsEnabled: enabled });
  ttsOptions.style.display = enabled ? 'flex' : 'none';

  await sendMessageToActiveTab({
    action: 'toggleTTS',
    enabled,
    settings: getTTSSettings()
  });
  updateMainStatus();
});

// TTS Play
ttsPlay.addEventListener('click', async () => {
  await sendMessageToActiveTab({ action: 'ttsPlay' });
});

// TTS Pause
ttsPause.addEventListener('click', async () => {
  await sendMessageToActiveTab({ action: 'ttsPause' });
});

// TTS Stop
ttsStop.addEventListener('click', async () => {
  await sendMessageToActiveTab({ action: 'ttsStop' });
});

// TTS Speed
ttsSpeed.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ ttsSpeed: parseFloat(e.target.value) });
  await sendMessageToActiveTab({
    action: 'updateTTS',
    settings: getTTSSettings()
  });
});

// TTS Pause on Punctuation
ttsPauseOnPunctuation.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ ttsPauseOnPunctuation: e.target.checked });
  await sendMessageToActiveTab({
    action: 'updateTTS',
    settings: getTTSSettings()
  });
});

// TTS Word Highlight
ttsWordHighlight.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ ttsWordHighlight: e.target.checked });
  await sendMessageToActiveTab({
    action: 'updateTTS',
    settings: getTTSSettings()
  });
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

  // Save to LOCAL storage (device-only, never syncs)
  await chrome.storage.local.set({ apiKey });
  showApiStatus('API key saved locally (device-only) ✓', 'success');
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
      showApiStatus('Cannot run on this page (system page)', 'error');
      return;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      // If content script not loaded, inject it first
      if (error.message.includes('Receiving end does not exist')) {
        try {
          // Inject content script
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });

          // Inject content CSS
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content.css']
          });

          // Wait a bit for script to initialize
          await new Promise(resolve => setTimeout(resolve, 500));

          // Try sending message again
          await chrome.tabs.sendMessage(tab.id, message);
          showApiStatus('Extension loaded successfully', 'success');
        } catch (injectError) {
          console.error('Error injecting content script:', injectError);
          showApiStatus('Could not load extension on this page', 'error');
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error sending message to tab:', error);
    showApiStatus('Error communicating with page', 'error');
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
  const anyEnabled = jargonToggle.checked || sensoryToggle.checked || dyslexiaToggle.checked || ttsToggle.checked;

  if (anyEnabled) {
    const features = [];
    if (jargonToggle.checked) features.push('Jargon');
    if (sensoryToggle.checked) features.push('Sensory');
    if (dyslexiaToggle.checked) features.push('Dyslexia');
    if (ttsToggle.checked) features.push('TTS');
    statusText.textContent = `Active: ${features.join(', ')}`;
  } else {
    statusText.textContent = 'Ready to simplify';
  }
}

// Helper: Get dyslexia settings
function getDyslexiaSettings() {
  return {
    font: dyslexiaFont.value,
    letterSpacing: parseFloat(letterSpacing.value),
    lineHeight: parseFloat(lineHeight.value),
    wordSpacing: parseInt(wordSpacing.value),
    overlayColor: overlayColor.value,
    syllableHighlight: syllableHighlight.checked,
    bionicReading: bionicReading.checked
  };
}

// Helper: Get TTS settings
function getTTSSettings() {
  return {
    speed: parseFloat(ttsSpeed.value),
    pauseOnPunctuation: ttsPauseOnPunctuation.checked,
    wordHighlight: ttsWordHighlight.checked
  };
}

// Helper: Update range value displays
function updateRangeValues() {
  const letterValue = parseFloat(letterSpacing.value);
  letterSpacingValue.textContent = letterValue === 0 ? 'None' :
    letterValue < 2 ? 'Normal' :
      letterValue < 4 ? 'Wide' : 'Extra Wide';

  lineHeightValue.textContent = lineHeight.value;

  const wordValue = parseInt(wordSpacing.value);
  wordSpacingValue.textContent = wordValue === 0 ? 'None' :
    wordValue < 4 ? 'Normal' :
      wordValue < 7 ? 'Wide' : 'Extra Wide';
}
