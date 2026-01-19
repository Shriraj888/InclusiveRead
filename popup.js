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

const bionicReading = document.getElementById('bionicReading');
const ttsToggle = document.getElementById('ttsToggle');
const ttsOptions = document.getElementById('ttsOptions');
const ttsPlay = document.getElementById('ttsPlay');
const ttsPause = document.getElementById('ttsPause');
const ttsStop = document.getElementById('ttsStop');
const ttsSpeed = document.getElementById('ttsSpeed');
const ttsPauseOnPunctuation = document.getElementById('ttsPauseOnPunctuation');
const ttsWordHighlight = document.getElementById('ttsWordHighlight');
const ttsVolume = document.getElementById('ttsVolume');
const ttsVolumeValue = document.getElementById('ttsVolumeValue');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const saveKeyBtn = document.getElementById('saveKey');
const apiStatus = document.getElementById('apiStatus');
const statusText = document.getElementById('statusText');
const apiProvider = document.getElementById('apiProvider');
const geminiKeyInput = document.getElementById('geminiKey');
const toggleGeminiKeyBtn = document.getElementById('toggleGeminiKey');
const ttsVoiceSelect = document.getElementById('ttsVoice');
const apiProviderBadge = document.getElementById('apiProviderBadge');

// Theme & Size Controls
const themeToggle = document.getElementById('themeToggle');
const themeLabel = document.getElementById('themeLabel');
const sizeButtons = document.querySelectorAll('.size-btn');

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

  'bionicReading',
  'ttsEnabled',
  'ttsSpeed',
  'ttsPauseOnPunctuation',
  'ttsWordHighlight',
  'ttsVolume',
  'theme',
  'popupSize',
  'apiProvider',
  'ttsVoice',
  'tourCompleted'
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
  bionicReading.checked = result.bionicReading || false;

  // TTS settings
  ttsToggle.checked = result.ttsEnabled || false;
  ttsSpeed.value = result.ttsSpeed || 1;
  ttsPauseOnPunctuation.checked = result.ttsPauseOnPunctuation !== false;
  ttsWordHighlight.checked = result.ttsWordHighlight !== false;
  ttsVolume.value = result.ttsVolume !== undefined ? result.ttsVolume : 70;
  ttsVolumeValue.textContent = (result.ttsVolume !== undefined ? result.ttsVolume : 70) + '%';

  // API Provider - Default to Gemini for new users
  const selectedProvider = result.apiProvider || 'gemini';
  apiProvider.value = selectedProvider;

  // Update badge directly
  if (apiProviderBadge) {
    apiProviderBadge.textContent = selectedProvider === 'gemini' ? 'Gemini' : 'OpenRouter';
    apiProviderBadge.className = 'api-provider-badge ' + selectedProvider;
  }

  // Show/hide correct key sections
  const openrouterSection = document.getElementById('openrouterSection');
  const geminiSection = document.getElementById('geminiSection');
  if (geminiSection) geminiSection.style.display = selectedProvider === 'gemini' ? 'block' : 'none';
  if (openrouterSection) openrouterSection.style.display = selectedProvider === 'openrouter' ? 'block' : 'none';

  updateRangeValues();

  // Show/hide options
  dyslexiaOptions.style.display = dyslexiaToggle.checked ? 'flex' : 'none';
  ttsOptions.style.display = ttsToggle.checked ? 'flex' : 'none';

  // Apply theme and size
  applyTheme(result.theme || 'dark');
  applySize(result.popupSize || 'normal');

  // Populate TTS voices
  populateTTSVoices(result.ttsVoice);

  // Check if tour should be shown (first time users)
  if (!result.tourCompleted) {
    setTimeout(() => startTour(), 500);
  }
});

// Load API keys separately from LOCAL storage (privacy-first)
chrome.storage.local.get(['apiKey', 'geminiKey'], (result) => {
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  if (result.geminiKey) {
    geminiKeyInput.value = result.geminiKey;
  }
  if (result.apiKey || result.geminiKey) {
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

// TTS Volume
ttsVolume.addEventListener('input', (e) => {
  const volume = parseInt(e.target.value);
  ttsVolumeValue.textContent = volume + '%';
});

ttsVolume.addEventListener('change', async (e) => {
  const volume = parseInt(e.target.value);
  await chrome.storage.sync.set({ ttsVolume: volume });
  // Volume applies to next playback - don't interrupt current TTS
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
  const provider = apiProvider.value;
  const key = provider === 'gemini' ? geminiKeyInput.value.trim() : apiKeyInput.value.trim();

  if (!key) {
    showApiStatus('Please enter an API key', 'error');
    return;
  }

  // Validate API key format (basic check)
  if (key.length < 10) {
    showApiStatus('API key looks too short', 'error');
    return;
  }

  // Save to LOCAL storage (device-only, never syncs)
  const storageKey = provider === 'gemini' ? 'geminiKey' : 'apiKey';
  await chrome.storage.local.set({ [storageKey]: key });
  showApiStatus(`${provider === 'gemini' ? 'Gemini' : 'OpenRouter'} API key saved locally (device-only) ✓`, 'success');
  updateMainStatus();

  // Test the API key with the appropriate provider
  try {
    showApiStatus('Validating API key...', 'info');
    const response = await chrome.runtime.sendMessage({
      action: 'testApiKey',
      apiKey: key,
      provider: provider
    });

    if (response.success) {
      showApiStatus(`${provider === 'gemini' ? 'Gemini' : 'OpenRouter'} API key validated successfully`, 'success');
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
  // Always reset display to ensure visibility
  apiStatus.style.display = 'block';
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
    bionicReading: bionicReading.checked
  };
}

// Helper: Get TTS settings
function getTTSSettings() {
  return {
    speed: parseFloat(ttsSpeed.value),
    pauseOnPunctuation: ttsPauseOnPunctuation.checked,
    wordHighlight: ttsWordHighlight.checked,
    volume: parseInt(ttsVolume.value),
    voice: ttsVoiceSelect.value
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

// Theme Toggle
themeToggle.addEventListener('click', async () => {
  const currentTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
  applyTheme(currentTheme);
  await chrome.storage.sync.set({ theme: currentTheme });
});

// Size Controls
sizeButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const size = btn.dataset.size;
    applySize(size);
    await chrome.storage.sync.set({ popupSize: size });
  });
});

// Helper: Apply theme
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    themeLabel.textContent = 'Dark';
    document.querySelector('.theme-icon-dark').style.display = 'none';
    document.querySelector('.theme-icon-light').style.display = 'block';
  } else {
    document.body.classList.remove('light-theme');
    themeLabel.textContent = 'Light';
    document.querySelector('.theme-icon-dark').style.display = 'block';
    document.querySelector('.theme-icon-light').style.display = 'none';
  }
}

// Helper: Apply size
function applySize(size) {
  // Remove all size classes
  document.body.classList.remove('size-compact', 'size-expanded');

  // Add the selected size class
  if (size === 'compact') {
    document.body.classList.add('size-compact');
  } else if (size === 'expanded') {
    document.body.classList.add('size-expanded');
  }

  // Update active button
  sizeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });
}

// API Provider Selection
apiProvider.addEventListener('change', async (e) => {
  const provider = e.target.value;
  await chrome.storage.sync.set({ apiProvider: provider });
  updateProviderUI(provider);
});

// Update provider badge and key fields
function updateProviderUI(provider) {
  // Update badge
  if (apiProviderBadge) {
    apiProviderBadge.textContent = provider === 'gemini' ? 'Gemini' : 'OpenRouter';
    apiProviderBadge.className = 'api-provider-badge ' + provider;
  }

  // Show/hide correct key field sections
  const openrouterSection = document.getElementById('openrouterSection');
  const geminiSection = document.getElementById('geminiSection');

  if (openrouterSection) {
    openrouterSection.style.display = provider === 'openrouter' ? 'block' : 'none';
  }
  if (geminiSection) {
    geminiSection.style.display = provider === 'gemini' ? 'block' : 'none';
  }
}

// Toggle Gemini Key Visibility
toggleGeminiKeyBtn.addEventListener('click', () => {
  const isPassword = geminiKeyInput.type === 'password';
  geminiKeyInput.type = isPassword ? 'text' : 'password';
  const eyeIcon = toggleGeminiKeyBtn.querySelector('svg');
  if (isPassword) {
    eyeIcon.innerHTML = '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>';
  } else {
    eyeIcon.innerHTML = '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
  }
});

// Voice Selection
ttsVoiceSelect.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ ttsVoice: e.target.value });
  // Notify content script of voice change
  await sendMessageToActiveTab({
    action: 'updateTTS',
    settings: { ...getTTSSettings(), voice: e.target.value }
  });
});

// Helper: Populate TTS Voices
function populateTTSVoices(selectedVoice) {
  // Get available voices
  const voices = window.speechSynthesis.getVoices();

  if (voices.length === 0) {
    // Voices not loaded yet, wait for them
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      populateTTSVoices(selectedVoice);
    }, { once: true });
    return;
  }

  // Clear existing options except the first "Auto" option
  ttsVoiceSelect.innerHTML = '<option value="auto">Auto (Best Quality)</option>';

  // Filter for English voices and rank by quality
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));

  // Rank voices by quality indicators
  const rankedVoices = englishVoices.sort((a, b) => {
    const getScore = (voice) => {
      let score = 0;
      const name = voice.name.toLowerCase();

      // Premium indicators
      if (name.includes('neural') || name.includes('natural')) score += 100;
      if (name.includes('premium') || name.includes('enhanced')) score += 80;
      if (name.includes('google')) score += 60;
      if (name.includes('microsoft')) score += 50;
      if (voice.lang === 'en-US') score += 30;
      if (voice.localService) score -= 10; // Prefer server voices

      return score;
    };

    return getScore(b) - getScore(a);
  });

  // Add voices to dropdown
  rankedVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.name === selectedVoice) {
      option.selected = true;
    }
    ttsVoiceSelect.appendChild(option);
  });
}

// ==========================================
// ONBOARDING TOUR SYSTEM
// ==========================================

const tourSteps = [
  {
    target: '.logo',
    title: 'Welcome to InclusiveRead! 👋',
    content: 'Your AI-powered cognitive bridge for easier web reading. Let\'s take a quick tour of the features.',
    position: 'bottom'
  },
  {
    target: '.feature-card:nth-child(1)',
    title: 'Jargon Decoder 📖',
    content: 'Simplifies complex terminology on any webpage.',
    position: 'bottom'
  },
  {
    target: '.feature-card:nth-child(2)',
    title: 'Sensory Shield 🛡️',
    content: 'Freezes distracting GIFs and animations.',
    position: 'bottom'
  },
  {
    target: '.feature-card:nth-child(3)',
    title: 'Dyslexia Reading Mode 📚',
    content: 'Optimized fonts and spacing for easier reading.',
    position: 'bottom'
  },
  {
    target: '.feature-card:nth-child(4)',
    title: 'Text-to-Speech 🔊',
    content: 'Listen to any webpage with word highlighting.',
    position: 'bottom'
  },
  {
    target: '.settings-btn',
    title: 'API Configuration ⚙️',
    content: 'Set up your free Gemini API key here.',
    position: 'top'
  }
];

let currentTourStep = 0;
const tourOverlay = document.getElementById('tourOverlay');
const tourSpotlight = document.getElementById('tourSpotlight');
const tourTooltip = document.getElementById('tourTooltip');
const tourArrow = document.getElementById('tourArrow');
const restartTourBtn = document.getElementById('restartTour');

function startTour() {
  currentTourStep = 0;
  tourOverlay.classList.add('active');
  showTourStep(currentTourStep);
}

function showTourStep(stepIndex) {
  const step = tourSteps[stepIndex];
  const targetElement = document.querySelector(step.target);

  if (!targetElement) {
    nextTourStep();
    return;
  }

  // Position spotlight
  const rect = targetElement.getBoundingClientRect();
  const padding = 8;

  tourSpotlight.style.display = 'block';
  tourSpotlight.style.left = `${rect.left - padding}px`;
  tourSpotlight.style.top = `${rect.top - padding}px`;
  tourSpotlight.style.width = `${rect.width + padding * 2}px`;
  tourSpotlight.style.height = `${rect.height + padding * 2}px`;

  // Create tooltip content
  const isLastStep = stepIndex === tourSteps.length - 1;
  const dotsHtml = tourSteps.map((_, i) =>
    `<div class="tour-dot ${i === stepIndex ? 'active' : ''}"></div>`
  ).join('');

  tourTooltip.innerHTML = `
    <div class="tour-step-counter">Step ${stepIndex + 1} of ${tourSteps.length}</div>
    <h4>${step.title}</h4>
    <p>${step.content}</p>
    <div class="tour-nav">
      <button class="tour-btn skip" data-action="skip">Skip</button>
      <div class="tour-dots">${dotsHtml}</div>
      ${isLastStep
      ? '<button class="tour-btn finish" data-action="finish">Get Started!</button>'
      : '<button class="tour-btn next" data-action="next">Next</button>'
    }
    </div>
  `;

  // Attach event listeners (CSP-compliant - no inline onclick)
  tourTooltip.querySelector('[data-action="skip"]')?.addEventListener('click', () => endTour());
  tourTooltip.querySelector('[data-action="next"]')?.addEventListener('click', () => nextTourStep());
  tourTooltip.querySelector('[data-action="finish"]')?.addEventListener('click', () => endTour(true));

  // Position tooltip
  tourTooltip.style.display = 'block';
  positionTooltip(rect, step.position);
}

function positionTooltip(targetRect, position) {
  const tooltipRect = tourTooltip.getBoundingClientRect();
  const gap = 16;
  let left, top;

  switch (position) {
    case 'bottom':
      left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
      top = targetRect.bottom + gap;
      break;
    case 'top':
      left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
      top = targetRect.top - tooltipRect.height - gap;
      break;
    case 'right':
      left = targetRect.right + gap;
      top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
      break;
    case 'left':
      left = targetRect.left - tooltipRect.width - gap;
      top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
      break;
    default:
      left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
      top = targetRect.bottom + gap;
  }

  // Keep within viewport
  const viewportPadding = 10;
  left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));
  top = Math.max(viewportPadding, Math.min(top, window.innerHeight - tooltipRect.height - viewportPadding));

  tourTooltip.style.left = `${left}px`;
  tourTooltip.style.top = `${top}px`;
}

function nextTourStep() {
  currentTourStep++;
  if (currentTourStep < tourSteps.length) {
    showTourStep(currentTourStep);
  } else {
    endTour(true);
  }
}

function endTour(completed = false) {
  tourOverlay.classList.remove('active');
  tourSpotlight.style.display = 'none';
  tourTooltip.style.display = 'none';
  if (tourArrow) tourArrow.style.display = 'none';

  if (completed) {
    chrome.storage.sync.set({ tourCompleted: true });
  }
}

// Make tour functions globally accessible for onclick handlers
window.nextTourStep = nextTourStep;
window.endTour = endTour;

// Restart tour button
if (restartTourBtn) {
  restartTourBtn.addEventListener('click', () => {
    startTour();
  });
}

// Close tour on overlay click (outside spotlight)
tourOverlay.addEventListener('click', (e) => {
  if (e.target === tourOverlay) {
    endTour();
  }
});
