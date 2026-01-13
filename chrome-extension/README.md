# AI Context Bridge

A Chrome Extension that allows you to capture, store, manage, and inject project context when switching between different AI chat platforms (ChatGPT, Claude, Gemini, etc.).

## The Problem

AI tools do not share memory. Every time you switch between AI platforms, you lose your project context and have to re-explain everything. This extension acts as a **portable memory layer** owned by you.

## Features

### Context Capture
- **Manual Input**: Write context directly in the extension
- **Selection Capture**: Grab highlighted text from any AI conversation
- **Conversation Capture**: Extract full visible chat from supported platforms

### Project Management
- Create unlimited projects with structured context
- Each project stores: Goal, Progress, Constraints, Tech Stack, Notes
- Quick switching between projects
- Visual active project indicator

### Context Injection
- One-click inject context into any AI chat
- Automatic clipboard fallback if injection fails
- Formatted prompt optimized for AI understanding

### Supported Platforms
- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)
- Google Gemini (gemini.google.com)
- Microsoft Copilot (copilot.microsoft.com)
- Poe (poe.com)
- Perplexity (perplexity.ai)

## Installation

1. Download or clone this folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `chrome-extension` folder
6. The extension icon will appear in your toolbar

## Usage

### Creating a Project
1. Click the extension icon
2. Click the "+" button
3. Fill in your project details
4. Click "Save Project"

### Capturing Context
1. Select text on any AI chat page
2. Click "Capture" → "Capture Selection"
3. Edit the captured text if needed
4. Choose where to save it (Goal, Progress, Notes, etc.)
5. Click "Save to Project"

### Injecting Context
1. Open any supported AI chat platform
2. Click the extension icon
3. Ensure your project is active (indicated by purple dot)
4. Click "Inject Context"
5. The context will be inserted into the AI's input field

## File Structure

```
chrome-extension/
├── manifest.json      # Extension configuration (MV3)
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic and storage management
├── content.js         # DOM interactions on AI platforms
├── background.js      # Service worker for lifecycle management
├── icons/             # Extension icons (16, 32, 48, 128px)
└── README.md          # This file
```

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Storage**: Uses `chrome.storage.local` for persistence
- **Permissions**: Minimal required permissions
- **No Backend**: Entirely client-side, no external APIs

## Future Roadmap

- [ ] AI-powered auto-summarization
- [ ] Chrome sync storage for cross-device access
- [ ] End-to-end encryption for sensitive projects
- [ ] Export/import projects as JSON
- [ ] Keyboard shortcuts for quick actions

## Privacy

This extension:
- Stores all data locally on your device
- Does not transmit any data to external servers
- Does not track usage or analytics
- Does not require any account or login

## License

MIT License - Use freely, modify as needed.
