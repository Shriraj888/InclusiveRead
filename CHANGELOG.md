# Changelog

All notable changes to InclusiveRead will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-11

### Added
- **Jargon Decoder**: AI-powered text simplification with full page and selection-based decoding
  - Full page mode: Automatically detects and simplifies complex terms across entire pages
  - Selection decoder: Decode specific text selections (10-5000 characters)
  - Text simplification: Complete plain-English rewrites of selected content
  - Interactive tooltips with category labels and difficulty ratings
  - Support for legal, financial, technical, medical, government, and academic jargon

- **Dyslexia Reading Mode**: Comprehensive reading support
  - Multiple dyslexia-friendly fonts (OpenDyslexic, Arial, Comic Sans)
  - Customizable letter spacing (0-5px)
  - Adjustable line height (1.0-3.0)
  - Word spacing control (0-10px)
  - Color overlays (beige, light blue, light green, light yellow)
  - Bionic reading mode with bold first letters
  - Persistent settings across sessions

- **Sensory Shield**: Reduce sensory overload
  - Freeze CSS animations and transitions
  - Pause auto-playing videos and GIFs
  - Stop flashing and blinking elements
  - Create calmer browsing experience

- **Text-to-Speech**: Advanced read-aloud functionality
  - Playback controls (play, pause, stop)
  - Voice selection from system voices
  - Adjustable speed (0.5x - 1.5x)
  - Volume control (0-100%)
  - Smart punctuation pauses
  - Word highlighting with visual tracking
  - Automatic content selection

- **Dual AI Provider Support**: Choose between OpenRouter or Google Gemini
  - Automatic fallback between providers
  - Secure local storage of API keys

- **Modern UI/UX**:
  - Dark/light theme toggle
  - Responsive popup sizes (S, M, L)
  - Clean, accessible interface with Inter font
  - API provider badge
  - Visual progress indicators

### Technical
- Chrome Extension Manifest V3 architecture
- Content scripts for page manipulation
- Background service worker for API communication
- Unified API service layer supporting multiple providers
- Chrome Sync Storage for settings persistence
- Chrome Local Storage for secure API key storage

### Security & Privacy
- Local-only API key storage
- No data collection or tracking
- HTTPS-encrypted API communications
- Open source and auditable code

[1.0.0]: https://github.com/Shriraj888/InclusiveRead/releases/tag/v1.0.0
