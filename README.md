# InclusiveRead 🏛️

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome](https://img.shields.io/badge/chrome-extension-orange.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-yellow.svg)

**The AI-Powered Cognitive Bridge for Web Accessibility**

InclusiveRead is a Chrome extension that reduces cognitive friction on websites for neurodivergent users (ADHD, Dyslexia, ASD) using AI-powered features to simplify complex content and improve readability.

---

## 📋 Table of Contents

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Installation](#-installation)
- [Usage](#-usage)
- [Features](#-features)
- [Technical Stack](#️-technical-stack)
- [Impact & Use Cases](#-impact--use-cases)
- [Project Structure](#-project-structure)
- [Privacy & Security](#-privacy--security)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 The Problem

Many websites—government portals, educational platforms, healthcare services—present significant barriers to neurodivergent users through complex jargon, distracting animations, and overwhelming text layouts that create cognitive friction.

## ✨ The Solution

InclusiveRead leverages AI and advanced accessibility features to make any webpage more accessible with four powerful modes:

### 1. **Jargon Decoder** 📖
AI-powered text simplification that makes complex content understandable:
- **Full Page Decode**: Toggle on to automatically detect and simplify complex legal, financial, technical, medical, government, and academic terms across the entire page
- **Selection Decoder**: Select any text (10-5000 characters) and click "Decode" in the floating toolbar to decode just that portion with inline tooltips
- **Text Simplification**: Select text and click "Simplify" to get a complete plain-English rewrite
- Replaces jargon with plain-English definitions in interactive tooltips
- Preserves original formatting while adding helpful hover explanations
- Smart context-aware simplifications with category labels and difficulty ratings
- Visual progress indicator during AI analysis

### 2. **Dyslexia Reading Mode** 📚
Comprehensive reading support optimized for dyslexic users:
- **Dyslexia-Friendly Fonts**: OpenDyslexic, Arial, or Comic Sans
- **Customizable Letter Spacing**: Adjustable spacing for easier character recognition (0-5px)
- **Enhanced Line Height**: Configurable line spacing to reduce crowding (1.0-3.0)
- **Word Spacing Control**: Increased word spacing for better word distinction (0-10px)
- **Color Overlays**: Tinted overlays (beige, light blue, light green, light yellow) to reduce visual stress
- **Bionic Reading**: Bold first letters to guide eye movement and improve reading speed
- All settings persist across sessions

### 3. **Sensory Shield** 🛡️
Reduces sensory overload and distractions:
- Freezes CSS animations and transitions
- Pauses auto-playing videos and GIFs
- Stops flashing and blinking elements
- Prevents sensory overwhelm from moving content
- Creates a calmer browsing experience

### 4. **Text-to-Speech** 🔊
Advanced read-aloud functionality with visual tracking:
- **Playback Controls**: Play, pause, and stop reading
- **Voice Selection**: Choose from available system voices (auto-selects best quality)
- **Adjustable Speed**: Choose from very slow to very fast (0.5x - 1.5x)
- **Volume Control**: Adjustable volume level (0-100%)
- **Smart Punctuation Pauses**: Natural pauses at commas, periods, and other punctuation
- **Word Highlighting**: Visual tracking that highlights the current word being read
- **Content Selection**: Automatically reads main page content
- Browser-native TTS engine (no external dependencies)

## 🚀 Installation

### 1. Get an API Key (Choose One - Both Free)

**Option A: OpenRouter (Default)**
1. Visit [OpenRouter](https://openrouter.ai/keys)
2. Sign in or create an account
3. Click "Create Key"
4. Copy your key (starts with `sk-or-...`)
5. Uses Google's Gemma 3 27B model (free tier available)

**Option B: Google Gemini**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create an API key
4. Copy your key (starts with `AIza...`)

### 2. Load the Extension
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `InclusiveRead` folder
6. The extension icon should appear in your toolbar

### 3. Configure the Extension
1. Click the InclusiveRead extension icon in your toolbar
2. Click "⚙️ API Settings" at the bottom
3. Select your AI provider (OpenRouter or Google Gemini)
4. Paste your API key in the appropriate field
5. Click "Save API Key"
6. You're ready to go!

## 📖 Usage

### Quick Start
1. Navigate to any webpage
2. Click the InclusiveRead icon in your toolbar
3. Toggle the features you want to enable:
   - **Jargon Decoder** - Simplifies complex terms
   - **Sensory Shield** - Freezes animations
   - **Dyslexia Reading Mode** - Optimizes fonts and spacing
   - **Text-to-Speech** - Reads content aloud

### Popup Interface Features
- **Theme Toggle**: Switch between light and dark mode
- **Size Controls**: Small (S), Medium (M), or Large (L) popup sizes
- **API Provider Badge**: Shows which AI provider is currently active

### Using Jargon Decoder
- **Full Page**: Toggle "Jargon Decoder" on to analyze and simplify the entire page
- **Selected Text**: Highlight any text (10+ characters), then use the floating toolbar:
  - Click "Decode" to identify and explain complex terms inline
  - Click "Simplify" to get a complete plain-English rewrite
- Hover over underlined terms to see simple explanations with category labels
- Automatic fallback between API providers if one key is missing

### Using Dyslexia Mode
1. Toggle "Dyslexia Reading Mode" on
2. Expand options to customize:
   - Choose your preferred font (OpenDyslexic, Arial, Comic Sans)
   - Adjust letter, line, and word spacing with sliders
   - Select a color overlay for reduced eye strain
   - Enable bionic reading for improved focus
3. Settings are saved automatically and persist across sessions

### Using Sensory Shield
- Toggle "Sensory Shield" on to instantly freeze all animations
- Works on CSS animations, transitions, auto-playing videos, and GIFs
- Toggle off to restore normal page behavior

### Using Text-to-Speech
1. Toggle "Text-to-Speech" on
2. Expand options to configure:
   - Select your preferred voice
   - Adjust reading speed
   - Set volume level
   - Enable/disable punctuation pauses
   - Enable/disable word highlighting
3. Click "Play" to start reading the page content
4. Use "Pause" to temporarily stop, "Stop" to end reading

## 🎨 Features

### Core Capabilities
- **Dual AI Provider Support**: Choose between OpenRouter (Gemma 3 27B) or Google Gemini with automatic fallback
- **Works Everywhere**: Compatible with any website without requiring site modifications
- **Privacy-First**: API keys stored locally on your device only (Chrome local storage)
- **Customizable Experience**: Extensive customization options for each feature
- **Instant Processing**: Real-time AI analysis with visual progress indicators
- **Persistent Settings**: Your preferences are saved across browsing sessions (Chrome sync storage)
- **Accessible UI**: Dark/light theme support and multiple popup sizes
- **Modern Design**: Clean, accessible interface with Inter font family

### Selection-Based Tools
- **Floating Toolbar**: Appears automatically when text is selected (10-5000 characters)
- **Decode Button**: Identifies complex terms and adds interactive tooltips
- **Simplify Button**: Rewrites selected text in plain English
- **Smart Positioning**: Toolbar positions itself optimally near the selection

### Visual Enhancements
- **Multiple Font Options**: Specialized dyslexia fonts plus standard alternatives
- **Color Customization**: Overlay colors to reduce visual strain
- **Bionic Reading Mode**: Enhanced fixation points for faster comprehension
- **Word Highlighting**: Visual tracking during text-to-speech playback

### AI Categories Detected
The Jargon Decoder identifies terms in these categories:
- **Legal**: Contracts, agreements, liability, terms of service
- **Financial**: Fees, payments, billing, transactions
- **Technical**: Software, digital, computing terms
- **Medical**: Health, conditions, treatments
- **Government**: Regulations, policies, bureaucratic language
- **Academic**: Formal, scholarly language

## 🛠️ Technical Stack

- **Extension Platform**: Chrome Extension (Manifest V3)
- **AI Models**: 
  - Google Gemma 3 27B IT (via OpenRouter API - free tier)
  - Google Gemini (via Google AI Studio API - free tier)
- **Languages**: JavaScript (ES6+), HTML5, CSS3
- **Architecture**: 
  - Content scripts for page manipulation (`content.js`, `dom-utils.js`)
  - Background service worker for API communication (`background.js`)
  - Unified API service layer (`gemini-service.js`)
  - Popup UI for user controls (`popup.html`, `popup.js`, `popup.css`)
- **Fonts**: OpenDyslexic (bundled), Inter (Google Fonts), system fonts
- **Storage**: 
  - Chrome Sync Storage (settings/preferences)
  - Chrome Local Storage (API keys - privacy-first)
- **APIs**: 
  - Chrome Extension API (Manifest V3)
  - OpenRouter API
  - Google Gemini API
  - Web Speech API (for TTS)

## 🏆 Impact & Use Cases

### Target Audience
- **Neurodivergent Users**: ADHD, Dyslexia, Autism Spectrum users (20% of population)
- **Learning Disabilities**: Reading comprehension support
- **ESL Learners**: Simplifying complex English text
- **Elderly Users**: Larger text, clearer formatting
- **Anyone**: Dealing with complex legal/bureaucratic websites

### Ideal Websites
- Government and public service portals
- Healthcare and insurance websites
- Tax and financial platforms
- Educational enrollment systems
- Legal document repositories
- Any site with complex terminology

## 📁 Project Structure

```
InclusiveRead/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html             # Extension popup interface
├── popup.css              # Popup styling (dark/light themes, responsive sizes)
├── popup.js               # Popup logic and event handlers
├── content.js             # Main content script (page manipulation, TTS, dyslexia mode)
├── content.css            # Content styles, overlays, and floating toolbar
├── background.js          # Service worker for API calls and message routing
├── dom-utils.js           # DOM manipulation utilities
├── gemini-service.js      # Unified API service (OpenRouter + Gemini support)
├── fonts/
│   └── opendyslexic.css   # OpenDyslexic font definitions
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── favicon.ico
├── privacy_policy.md      # Privacy policy
└── README.md              # This file
```

## 🔒 Privacy & Security

- **Local Storage Only**: API keys are stored locally on your device using Chrome's local storage
- **Sync Storage for Settings**: User preferences sync across your Chrome browsers
- **No Data Collection**: InclusiveRead does not collect, store, or transmit any personal user data
- **API Communication**: Only page text content is sent to your chosen AI provider for processing
- **Dual Provider Support**: Choose between OpenRouter or Google Gemini based on your preference
- **Secure Transmission**: All API calls use HTTPS encryption
- **No Tracking**: No analytics, cookies, or third-party tracking
- **Open Source**: Code is transparent and auditable

## 🛣️ Future Roadmap

- [ ] Support for additional languages
- [ ] Custom jargon dictionary for domain-specific terms
- [ ] Reading ruler/focus mode
- [ ] Syllable highlighting for dyslexia mode
- [ ] Firefox and Edge compatibility
- [ ] Collaborative definitions (community-sourced simplifications)
- [ ] Integration with screen readers
- [ ] Export simplified versions of pages
- [x] ~~Voice selection for text-to-speech~~ ✅ Implemented
- [x] ~~Dark mode support~~ ✅ Implemented (theme toggle)

## 🤝 Contributing

Contributions are welcome! This project aims to improve web accessibility for neurodivergent users.

Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Quick Start for Contributors
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Areas for Contribution
- Additional dyslexia-friendly features
- UI/UX improvements
- Performance optimizations
- Bug fixes
- Documentation improvements
- Accessibility testing

See our [GitHub Issues](https://github.com/Shriraj888/InclusiveRead/issues) for current tasks and feature requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenDyslexic Font**: Free, open-source font designed for dyslexic readers
- **OpenRouter**: Providing access to open-source AI models
- **Google Gemma**: Powerful open-source language model
- **Neurodivergent Community**: For inspiration and feedback

## 📞 Support

For issues, questions, or feedback:
- Open an issue on GitHub
- Check existing issues for solutions
- Contribute improvements via pull requests

---

**Made with ❤️ for neurodivergent accessibility**

*Empowering neurodivergent users to navigate the web with confidence*
