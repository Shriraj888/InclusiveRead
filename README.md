# InclusiveRead 🏛️

**The AI-Powered Cognitive Bridge for Public Web Services**

InclusiveRead is a Chrome extension that reduces cognitive friction on government and public service websites for neurodivergent users (ADHD, Dyslexia, ASD) using Google Gemini 1.5 Flash AI.

## 🎯 The Problem

Essential digital public services—healthcare portals, tax platforms, school enrollment—are built with "cognitive friction": cluttered layouts, legal jargon, and dark patterns that make navigation nearly impossible for neurodivergent citizens.

## ✨ The Solution

InclusiveRead uses AI to understand page intent and dynamically simplify the UI with three core features:

### 1. **Action Spotlight** 🎯
- AI identifies the primary action on the page
- Dims non-essential elements
- Highlights the main action with a visual spotlight
- Guides users to the most important task

### 2. **Jargon Decoder** 📖
- Detects complex legal/bureaucratic terms
- Replaces them with plain-English tooltips
- Makes content actionable and understandable

### 3. **Sensory Shield** 🛡️
- Freezes distracting animations
- Pauses auto-playing videos
- Prevents sensory overload from flashing elements

## 🚀 Installation

### 1. Get a Google AI API Key (Free)
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your key (starts with `AIzaSy...`)

### 2. Load the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `Inclusive Read` folder
5. The extension icon should appear in your toolbar

### 3. Configure the Extension
1. Click the InclusiveRead extension icon
2. Click "⚙️ API Settings"
3. Paste your API key
4. Click "Save API Key"

## 📖 Usage

1. Navigate to any public service website
2. Click the InclusiveRead icon
3. Toggle the features you want:
   - **Action Spotlight**: Highlights the main action
   - **Jargon Decoder**: Simplifies complex terms
   - **Sensory Shield**: Freezes animations

4. Adjust spotlight intensity if needed
5. Watch as the page becomes more accessible!

## 🎨 Features

- **Zero-Install for Websites**: Works on any site without requiring changes
- **Privacy-First**: All processing happens locally or through Google's secure API
- **Customizable**: Adjust spotlight intensity and toggle features individually
- **Instant**: Real-time AI analysis and page modification
- **Accessible Design**: The extension itself follows accessibility best practices

## 🛠️ Technical Stack

- **Chrome Extension**: Manifest V3
- **AI**: Google Gemini 1.5 Flash (via AI Studio API)
- **Languages**: JavaScript (ES6+), HTML5, CSS3
- **Architecture**: Content scripts + Background service worker

## 🏆 Hackathon Context

Built for a 4-day hackathon focusing on:
- **Open Innovation**: Solving real-world accessibility barriers
- **Google Technology**: Leveraging Gemini 1.5 Flash for semantic understanding
- **Social Impact**: Empowering 20% of the population (neurodivergent users)

## 📝 Project Structure

```
Inclusive Read/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup logic
├── content.js            # Main content script
├── content.css           # Content styles
├── background.js         # Service worker
├── dom-utils.js          # DOM manipulation utilities
├── gemini-service.js     # Gemini API integration
├── icons/                # Extension icons
└── README.md            # This file
```

## 🔒 Privacy & Security

- API keys are stored securely in Chrome's sync storage
- No user data is collected or transmitted except to Google's AI API
- All page analysis happens in real-time; nothing is stored
- Open source and auditable

## 🤝 Contributing

This is a hackathon project. Feel free to:
- Report issues
- Suggest features
- Submit pull requests
- Use as a learning resource

## 📄 License

MIT License - Feel free to use for educational or personal projects

## 🌟 Impact

By reducing cognitive friction, InclusiveRead:
- Enables independent access to essential services
- Reduces task abandonment
- Empowers neurodivergent citizens
- Demonstrates the power of AI for accessibility

---

**Made with 💜 for neurodivergent accessibility**

*"No one should be locked out of civic participation because of how their brain processes information"*
